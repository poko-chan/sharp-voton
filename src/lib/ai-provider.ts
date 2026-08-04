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
import { cpuAiStatus, cpuAiDiagnostics, cpuAiEnsureLoaded, createCpuAiSession } from "@/lib/cpu-ai";
import { aiRunStart, aiRunChars, aiRunDone, aiRunError, aiRunModelLoading, aiRunIdle } from "@/lib/ai-status";

export type AiEnginePref = "auto" | "nano" | "webllm" | "cpu";
export type AiEngine = "nano" | "webllm" | "cpu" | "none";

export const AI_ENGINE_LABELS: Record<AiEngine, string> = {
  nano: "Gemini Nano (端末内)",
  webllm: "WebLLM (端末内)",
  cpu: "CPU AI (端末内)",
  none: "利用不可",
};

const LS_KEY = "ai.engine.pref";

export function getAiEnginePref(): AiEnginePref {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(LS_KEY) as AiEnginePref | null;
  return v === "nano" || v === "webllm" || v === "cpu" || v === "auto" ? v : "auto";
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
  const [nano, web, cpu] = await Promise.all([chromeAiStatus(), webLlmStatus(), cpuAiStatus()]);
  const pref = getAiEnginePref();

  // 1. ユーザー指定があり、かつ利用可能（ダウンロード中/可を含む）ならそれを使う
  if (pref === "nano" && isNanoUsable(nano)) return "nano";
  if (pref === "webllm" && isWebLlmUsable(web)) return "webllm";
  if (pref === "cpu" && cpu !== "unavailable") return "cpu";

  // 2. 自動選択: すでに利用可能なものを優先
  if (pref === "auto") {
    if (nano === "available") return "nano";
    if (web === "available") return "webllm";
    if (cpu === "available") return "cpu";
    // なければダウンロードが必要なものから選ぶ
    if (isNanoUsable(nano)) return "nano";
    if (isWebLlmUsable(web)) return "webllm";
    if (cpu !== "unavailable") return "cpu";
  }

  // 3. フォールバック
  if (nano === "available") return "nano";
  if (web === "available") return "webllm";
  if (cpu === "available") return "cpu";
  if (isNanoUsable(nano)) return "nano";
  if (isWebLlmUsable(web)) return "webllm";
  if (cpu !== "unavailable") return "cpu";

  return "none";
}

export type AiDiagnostics = {
  active: AiEngine;
  pref: AiEnginePref;
  nano: Awaited<ReturnType<typeof chromeAiDiagnostics>>;
  webllm: Awaited<ReturnType<typeof webLlmDiagnostics>>;
  cpu: Awaited<ReturnType<typeof cpuAiDiagnostics>>;
};

export async function aiDiagnostics(): Promise<AiDiagnostics> {
  const [nano, webllm, cpu] = await Promise.all([
    chromeAiDiagnostics(),
    webLlmDiagnostics(),
    cpuAiDiagnostics(),
  ]);
  const active = await resolveAiEngine();
  return { active, pref: getAiEnginePref(), nano, webllm, cpu };
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
  try {
    if (engine === "nano") {
      const status = await chromeAiStatus();
      if (status !== "available") {
        await chromeAiEnsureDownloaded((l, t) => {
          onProgress?.(l, t);
          aiRunModelLoading("nano", t > 0 ? Math.round((l / t) * 100) : null, "Gemini Nano を取得中…");
        });
      }
    } else if (engine === "webllm") {
      await webLlmEnsureLoaded((p, text) => {
        onProgress?.(Math.round(p * 1000), 1000, text);
        aiRunModelLoading("webllm", Math.round(p * 100), text || "WebLLM モデルを取得中…");
      });
    } else if (engine === "cpu") {
      await cpuAiEnsureLoaded((p, text) => {
        onProgress?.(p, 100, text);
        aiRunModelLoading("cpu", p, text || "CPU AI モデルを取得中…");
      });
    }
    // 成功したら一旦状態を done にする（Indicator が消えるように）
    aiRunDone(0);
    // 少し待ってから完全に消す（done の表示時間を確保）
    setTimeout(() => aiRunIdle(), 2000);
    return engine;
  } catch (e: any) {
    aiRunError(e?.message ?? "AI モデルの準備に失敗しました");
    throw e;
  }
}

export type AiSession = ChromeAiSession;

export async function createAiSession(opts?: {
  system?: string;
  temperature?: number;
  topK?: number;
}): Promise<AiSession & { engine: AiEngine }> {
  const engine = await resolveAiEngine();

  if (engine === "nano") {
    try {
      // Nano は明示的に ensure を呼ぶ（ダウンロード中なら待つ）
      const status = await chromeAiStatus();
      if (status !== "available") {
        aiRunModelLoading("nano", null, "Gemini Nano を準備中…");
        await chromeAiEnsureDownloaded((l, t) => aiRunModelLoading("nano", t > 0 ? Math.round((l / t) * 100) : null, "Gemini Nano を取得中…"));
      }
      const s = await createChromeAiSession(opts);
      return Object.assign(withStatus(s, "nano"), { engine: "nano" as const });
    } catch {
      if ((await cpuAiStatus()) !== "unavailable") {
        const s = await createCpuAiSession({ system: opts?.system, temperature: opts?.temperature });
        return Object.assign(withStatus(s, "cpu"), { engine: "cpu" as const });
      }
      throw new Error("Gemini Nano のセッション作成に失敗しました");
    }
  }

  if (engine === "webllm") {
    try {
      aiRunModelLoading("webllm", null, "WebLLM を準備中…");
      await webLlmEnsureLoaded((p, text) => aiRunModelLoading("webllm", Math.round(p * 100), text));
      const s = await createWebLlmSession({ system: opts?.system, temperature: opts?.temperature });
      return Object.assign(withStatus(s, "webllm"), { engine: "webllm" as const });
    } catch (err: any) {
      if ((await cpuAiStatus()) !== "unavailable") {
        const s = await createCpuAiSession({ system: opts?.system, temperature: opts?.temperature });
        return Object.assign(withStatus(s, "cpu"), { engine: "cpu" as const });
      }
      throw new Error("WebLLM の読み込みに失敗しました: " + err.message);
    }
  }

  if (engine === "cpu") {
    try {
      aiRunModelLoading("cpu", null, "CPU AI を準備中…");
      const s = await createCpuAiSession({ system: opts?.system, temperature: opts?.temperature });
      return Object.assign(withStatus(s, "cpu"), { engine: "cpu" as const });
    } catch (err: any) {
      throw new Error("CPU AI の読み込みに失敗しました: " + err.message);
    }
  }
  throw new Error("利用可能な端末内 AI がありません（Gemini Nano / WebLLM / CPU AI）");
}

/** セッションをラップして、生成状況をグローバルに通知する */
function withStatus(s: AiSession, engine: AiEngine): AiSession {
  return {
    prompt: async (t) => {
      aiRunStart(engine);
      try {
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
