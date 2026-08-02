// 統一 AI プロバイダ: Gemini Nano (Chrome Built-in AI) → WebLLM → クラウド AI の順にフォールバック。
// 使えるものが複数あればユーザーが選択できる (localStorage: ai.engine.pref)。

import {
  chromeAiStatus,
  chromeAiDiagnostics,
  chromeAiEnsureDownloaded,
  createChromeAiSession,
  extractJSON,
  type ChromeAiSession,
} from "@/lib/chrome-ai";
import {
  webLlmStatus,
  webLlmDiagnostics,
  webLlmEnsureLoaded,
  createWebLlmSession,
} from "@/lib/web-llm";
import { cloudAiStatus, cloudAiDiagnostics, createCloudAiSession } from "@/lib/ai-cloud";
import { aiRunStart, aiRunChars, aiRunDone, aiRunError, aiRunModelLoading } from "@/lib/ai-status";

export type AiEnginePref = "auto" | "nano" | "webllm" | "cloud";
export type AiEngine = "nano" | "webllm" | "cloud" | "none";

export const AI_ENGINE_LABELS: Record<AiEngine, string> = {
  nano: "Gemini Nano (端末内)",
  webllm: "WebLLM (端末内)",
  cloud: "クラウド AI",
  none: "利用不可",
};

const LS_KEY = "ai.engine.pref";

export function getAiEnginePref(): AiEnginePref {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(LS_KEY) as AiEnginePref | null;
  return v === "nano" || v === "webllm" || v === "cloud" || v === "auto" ? v : "auto";
}

export function setAiEnginePref(pref: AiEnginePref) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, pref);
  try {
    window.dispatchEvent(new CustomEvent("ai-engine-pref-changed", { detail: pref }));
  } catch { /* noop */ }
}

function isNanoUsable(s: string) {
  return s === "available" || s === "downloadable" || s === "downloading";
}
function isWebLlmUsable(s: string) {
  return s === "available" || s === "downloadable" || s === "downloading";
}

/** 現在の設定 + 実際の可用性を突き合わせて、使うエンジンを決定 */
export async function resolveAiEngine(): Promise<AiEngine> {
  const [nano, web, cloud] = await Promise.all([chromeAiStatus(), webLlmStatus(), cloudAiStatus()]);
  const pref = getAiEnginePref();
  const cloudOk = cloud === "available";
  if (pref === "cloud" && cloudOk) return "cloud";
  if (pref === "nano" && isNanoUsable(nano)) return "nano";
  if (pref === "webllm" && isWebLlmUsable(web)) return "webllm";
  // auto / 選択したものが使えない場合: 端末内 → クラウドの順にフォールバック
  if (pref === "auto" && isNanoUsable(nano)) return "nano";
  if (pref === "auto" && isWebLlmUsable(web)) return "webllm";
  if (cloudOk) return "cloud";
  if (isNanoUsable(nano)) return "nano";
  if (isWebLlmUsable(web)) return "webllm";
  return "none";
}

export type AiDiagnostics = {
  active: AiEngine;
  pref: AiEnginePref;
  nano: Awaited<ReturnType<typeof chromeAiDiagnostics>>;
  webllm: Awaited<ReturnType<typeof webLlmDiagnostics>>;
  cloud: Awaited<ReturnType<typeof cloudAiDiagnostics>>;
};

export async function aiDiagnostics(): Promise<AiDiagnostics> {
  const [nano, webllm, cloud, active] = await Promise.all([
    chromeAiDiagnostics(),
    webLlmDiagnostics(),
    cloudAiDiagnostics(),
    resolveAiEngine(),
  ]);
  return { active, pref: getAiEnginePref(), nano, webllm, cloud };
}

export async function aiStatus(): Promise<AiEngine> {
  return resolveAiEngine();
}

export async function isAiUsable(): Promise<boolean> {
  const e = await resolveAiEngine();
  return e !== "none";
}

export async function aiEnsureReady(
  onProgress?: (loaded: number, total: number, text?: string) => void,
): Promise<AiEngine> {
  const engine = await resolveAiEngine();
  if (engine === "nano") {
    await chromeAiEnsureDownloaded((l, t) => {
      onProgress?.(l, t);
      aiRunModelLoading("nano", t > 0 ? Math.round((l / t) * 100) : null, "Gemini Nano を取得中…");
    });
  } else if (engine === "webllm") {
    await webLlmEnsureLoaded((p, text) => {
      onProgress?.(Math.round(p * 1000), 1000, text);
      aiRunModelLoading("webllm", Math.round(p * 100), text || "WebLLM モデルを取得中…");
    });
  }
  return engine;
}

export type AiSession = ChromeAiSession;

export async function createAiSession(opts?: {
  system?: string;
  temperature?: number;
  topK?: number;
}): Promise<AiSession & { engine: AiEngine }> {
  const engine = await resolveAiEngine();
  const cloudFallback = () =>
    Object.assign(withStatus(createCloudAiSession({ system: opts?.system, temperature: opts?.temperature }), "cloud"), {
      engine: "cloud" as const,
    });

  if (engine === "nano") {
    try {
      const s = await createChromeAiSession(opts);
      return Object.assign(withStatus(s, "nano"), { engine: "nano" as const });
    } catch {
      if ((await cloudAiStatus()) === "available") return cloudFallback();
      throw new Error("Gemini Nano のセッション作成に失敗しました");
    }
  }
  if (engine === "webllm") {
    try {
      aiRunModelLoading("webllm", null, "WebLLM を準備中…");
      await webLlmEnsureLoaded((p, text) => aiRunModelLoading("webllm", Math.round(p * 100), text));
      const s = await createWebLlmSession({ system: opts?.system, temperature: opts?.temperature });
      return Object.assign(withStatus(s, "webllm"), { engine: "webllm" as const });
    } catch {
      if ((await cloudAiStatus()) === "available") return cloudFallback();
      throw new Error("WebLLM の読み込みに失敗しました");
    }
  }
  if (engine === "cloud") return cloudFallback();
  throw new Error("利用可能な AI エンジンがありません（Gemini Nano / WebLLM / クラウドいずれも利用不可）");
}

/** セッションをラップして、生成状況をグローバルに通知する */
function withStatus(s: AiSession, engine: AiEngine): AiSession {
  return {
    prompt: async (t) => {
      aiRunStart(engine);
      try {
        // 可能ならストリーミングで進捗を出す
        const out = await s.promptStreaming(t, (p) => aiRunChars(p.length));
        aiRunDone(out.length);
        return out;
      } catch (e: any) {
        aiRunError(e?.message ?? "生成に失敗しました");
        throw e;
      }
    },
    promptJSON: async <T,>(t: string): Promise<T> => {
      aiRunStart(engine);
      try {
        const raw = await s.promptStreaming(t, (p) => aiRunChars(p.length));
        const parsed = extractJSON<T>(raw);
        aiRunDone(raw.length);
        return parsed;
      } catch (e: any) {
        aiRunError(e?.message ?? "生成に失敗しました");
        throw e;
      }
    },
    promptStreaming: async (t, onChunk) => {
      aiRunStart(engine);
      try {
        const out = await s.promptStreaming(t, (p) => { aiRunChars(p.length); onChunk(p); });
        aiRunDone(out.length);
        return out;
      } catch (e: any) {
        aiRunError(e?.message ?? "生成に失敗しました");
        throw e;
      }
    },
    destroy: () => s.destroy(),
  };
}

export async function aiPrompt(text: string, system?: string): Promise<string> {
  const s = await createAiSession({ system });
  try { return await s.prompt(text); } finally { s.destroy(); }
}

export async function aiJSON<T = unknown>(text: string, system?: string): Promise<T> {
  const s = await createAiSession({ system });
  try { return await s.promptJSON<T>(text); } finally { s.destroy(); }
}

export { extractJSON };
