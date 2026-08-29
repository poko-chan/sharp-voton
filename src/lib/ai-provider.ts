// 統一 AI プロバイダ: 端末内で動く AI（Gemini Nano / WebLLM / Ollama）をまとめて扱う。
// 選択は「モデル単位」で localStorage(ai.engine.pref) に保存する。
//   "auto"                … ダウンロード済みの中からおすすめを自動選択
//   "nano"                … Chrome 内蔵 Gemini Nano
//   "webllm:<modelId>"    … ブラウザ内 WebLLM の特定モデル
//   "ollama:<modelName>"  … パソコンの Ollama の特定モデル

import { sanitizeAiText, hasMeaningfulContent } from "@/lib/ai-degenerate";
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
  webLlmCachedModelIds,
  hasWebGpuSupport,
  getWebLlmModelId,
  setWebLlmModelId,
  WEBLLM_MODELS,
} from "@/lib/web-llm";
import { ollamaModels, ollamaDiagnostics, createOllamaSession } from "@/lib/ollama";
import { aiRunStart, aiRunChars, aiRunDone, aiRunError, aiRunModelLoading, aiRunIdle } from "@/lib/ai-status";

export type AiEngine = "nano" | "webllm" | "ollama" | "none";

export const AI_ENGINE_LABELS: Record<AiEngine, string> = {
  nano: "Gemini Nano (Chrome内蔵)",
  webllm: "WebLLM (ブラウザ内)",
  ollama: "Ollama (パソコン内)",
  none: "利用不可",
};

/** 保存される選択値。"auto" | "nano" | "webllm:<id>" | "ollama:<name>" */
export type AiSelection = string;
export type AiTarget = { engine: AiEngine; modelId: string; modelLabel: string };

const LS_KEY = "ai.engine.pref";

export function getAiSelection(): AiSelection {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(LS_KEY);
  if (!v || v === "cpu") return "auto"; // CPU AI は廃止
  if (v === "webllm") return `webllm:${getWebLlmModelId()}`;
  return v;
}

export function setAiSelection(sel: AiSelection) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, sel);
  if (sel.startsWith("webllm:")) setWebLlmModelId(sel.slice("webllm:".length));
  try {
    window.dispatchEvent(new CustomEvent("ai-engine-pref-changed", { detail: sel }));
  } catch { /* noop */ }
}

// 旧 API 互換
export const getAiEnginePref = getAiSelection;
export const setAiEnginePref = setAiSelection;

export type AiModelEntry = {
  /** 選択値。setAiSelection にそのまま渡せる */
  key: string;
  engine: AiEngine;
  modelId: string;
  /** モデル名 */
  name: string;
  /** 動かしている仕組みの名前（WebLLM / Ollama / Chrome内蔵） */
  engineLabel: string;
  sizeLabel: string;
  note: string;
  /** すぐ使える（ダウンロード済み） */
  ready: boolean;
  /** ダウンロードすれば使える */
  installable: boolean;
  /** おすすめ度（大きいほど優先） */
  score: number;
};

/** 端末で扱える AI モデルを全部並べる（使える／ダウンロードが必要 の両方） */
export async function listAiModels(): Promise<AiModelEntry[]> {
  const [nano, ollama] = await Promise.all([chromeAiStatus(), ollamaModels()]);
  const cached = new Set(webLlmCachedModelIds());
  const gpu = hasWebGpuSupport();
  const out: AiModelEntry[] = [];

  out.push({
    key: "nano",
    engine: "nano",
    modelId: "gemini-nano",
    name: "Gemini Nano",
    engineLabel: "Chrome内蔵",
    sizeLabel: "約 2GB（Chromeが管理）",
    note: "Chrome / Edge に内蔵された AI。ダウンロードはブラウザ側で行われ、最も軽快に動きます。",
    ready: nano === "available",
    installable: nano === "downloadable" || nano === "downloading",
    score: 80,
  });

  for (const m of ollama) {
    out.push({
      key: `ollama:${m.name}`,
      engine: "ollama",
      modelId: m.name,
      name: m.name,
      engineLabel: "Ollama",
      sizeLabel: m.sizeBytes ? `${(m.sizeBytes / 1e9).toFixed(1)}GB` : "—",
      note: "パソコンにインストールされた Ollama のモデル。ブラウザの容量を使わず、最も高品質です。",
      ready: true,
      installable: false,
      score: 100,
    });
  }

  for (const m of WEBLLM_MODELS) {
    out.push({
      key: `webllm:${m.id}`,
      engine: "webllm",
      modelId: m.id,
      name: m.label,
      engineLabel: "WebLLM",
      sizeLabel: m.sizeLabel,
      note: m.note,
      ready: gpu && cached.has(m.id),
      installable: gpu && !cached.has(m.id),
      score: 50 + (m.sizeLabel.includes("4.") || m.sizeLabel.includes("5.") ? 5 : 0),
    });
  }

  return out;
}

function labelFor(engine: AiEngine, modelId: string): string {
  if (engine === "nano") return "Gemini Nano";
  if (engine === "ollama") return modelId;
  return WEBLLM_MODELS.find((m) => m.id === modelId)?.label ?? modelId;
}

/** 現在の設定 + 実際の可用性から、使うモデルを決定 */
export async function resolveAiTarget(): Promise<AiTarget> {
  const sel = getAiSelection();
  const models = await listAiModels();
  const pick = (e: AiModelEntry): AiTarget => ({ engine: e.engine, modelId: e.modelId, modelLabel: labelFor(e.engine, e.modelId) });

  if (sel !== "auto") {
    const exact = models.find((m) => m.key === sel);
    if (exact && (exact.ready || exact.installable)) return pick(exact);
  }

  // オート: すぐ使えるものの中でおすすめ順
  const ready = models.filter((m) => m.ready).sort((a, b) => b.score - a.score);
  if (ready[0]) return pick(ready[0]);

  const installable = models.filter((m) => m.installable).sort((a, b) => b.score - a.score);
  if (installable[0]) return pick(installable[0]);

  return { engine: "none", modelId: "", modelLabel: "利用不可" };
}

export async function resolveAiEngine(): Promise<AiEngine> {
  return (await resolveAiTarget()).engine;
}

export type AiDiagnostics = {
  active: AiEngine;
  target: AiTarget;
  pref: AiSelection;
  nano: Awaited<ReturnType<typeof chromeAiDiagnostics>>;
  webllm: Awaited<ReturnType<typeof webLlmDiagnostics>>;
  ollama: Awaited<ReturnType<typeof ollamaDiagnostics>>;
};

export async function aiDiagnostics(): Promise<AiDiagnostics> {
  const [nano, webllm, ollama, target] = await Promise.all([
    chromeAiDiagnostics(),
    webLlmDiagnostics(),
    ollamaDiagnostics(),
    resolveAiTarget(),
  ]);
  return { active: target.engine, target, pref: getAiSelection(), nano, webllm, ollama };
}

export async function aiStatus(): Promise<AiEngine> {
  return resolveAiEngine();
}

export async function isAiUsable(): Promise<boolean> {
  return (await resolveAiEngine()) !== "none";
}

export async function aiEnsureReady(
  onProgress?: (loaded: number, total: number, text?: string) => void,
): Promise<AiEngine> {
  const target = await resolveAiTarget();
  try {
    if (target.engine === "nano") {
      if ((await chromeAiStatus()) !== "available") {
        await chromeAiEnsureDownloaded((l, t) => {
          onProgress?.(l, t);
          aiRunModelLoading("nano", t > 0 ? Math.round((l / t) * 100) : null, "Gemini Nano を取得中…");
        });
      }
    } else if (target.engine === "webllm") {
      await webLlmEnsureLoaded((p, text) => {
        onProgress?.(Math.round(p * 1000), 1000, text);
        aiRunModelLoading("webllm", Math.round(p * 100), text || "WebLLM モデルを取得中…");
      }, target.modelId);
    }
    aiRunDone(0);
    setTimeout(() => aiRunIdle(), 2000);
    return target.engine;
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
}): Promise<AiSession & { engine: AiEngine; modelLabel: string }> {
  const target = await resolveAiTarget();

  if (target.engine === "ollama") {
    const s = createOllamaSession(target.modelId, { system: opts?.system, temperature: opts?.temperature });
    return Object.assign(withStatus(s, "ollama"), { engine: "ollama" as const, modelLabel: target.modelLabel });
  }

  if (target.engine === "nano") {
    try {
      if ((await chromeAiStatus()) !== "available") {
        aiRunModelLoading("nano", null, "Gemini Nano を準備中…");
        await chromeAiEnsureDownloaded((l, t) =>
          aiRunModelLoading("nano", t > 0 ? Math.round((l / t) * 100) : null, "Gemini Nano を取得中…"),
        );
      }
      const s = await createChromeAiSession(opts);
      return Object.assign(withStatus(s, "nano"), { engine: "nano" as const, modelLabel: target.modelLabel });
    } catch (err: any) {
      const web = await webLlmStatus();
      if (web === "available" || web === "downloadable" || web === "downloading") {
        const fallbackId = getWebLlmModelId();
        aiRunModelLoading("webllm", null, "Gemini Nano から WebLLM へ切替中…");
        await webLlmEnsureLoaded((p, text) => aiRunModelLoading("webllm", Math.round(p * 100), text), fallbackId);
        const s = await createWebLlmSession({ system: opts?.system, temperature: opts?.temperature, modelId: fallbackId });
        return Object.assign(withStatus(s, "webllm"), { engine: "webllm" as const, modelLabel: labelFor("webllm", fallbackId) });
      }
      throw new Error("Gemini Nano のセッション作成に失敗しました: " + (err?.message ?? ""));
    }
  }

  if (target.engine === "webllm") {
    aiRunModelLoading("webllm", null, "WebLLM を準備中…");
    await webLlmEnsureLoaded((p, text) => aiRunModelLoading("webllm", Math.round(p * 100), text), target.modelId);
    const s = await createWebLlmSession({ system: opts?.system, temperature: opts?.temperature, modelId: target.modelId });
    return Object.assign(withStatus(s, "webllm"), { engine: "webllm" as const, modelLabel: target.modelLabel });
  }

  throw new Error("使える端末内 AI がありません。AI設定からモデルをダウンロードしてください。");
}

/** セッションをラップして、生成状況をグローバルに通知する */
function withStatus(s: AiSession, engine: AiEngine): AiSession {
  const clean = (raw: string) => {
    const out = sanitizeAiText(raw);
    if (!hasMeaningfulContent(out)) {
      throw new Error("AIの出力が壊れました（同じ記号の繰り返し）。もう一度送信するか、AI設定で別のモデルを選んでください。");
    }
    return out;
  };
  return {
    prompt: async (t) => {
      aiRunStart(engine);
      try {
        const out = clean(await s.promptStreaming(t, (p) => aiRunChars(p.length)));
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
        const parsed = extractJSON<T>(sanitizeAiText(raw));
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
        const out = clean(await s.promptStreaming(t, (p) => {
          const c = sanitizeAiText(p);
          aiRunChars(c.length);
          onChunk(c);
        }));
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

/** 生成途中のテキストを逐次受け取れる単発プロンプト（ストリーミング表示用） */
export async function aiStream(
  text: string,
  onChunk: (partial: string) => void,
  system?: string,
): Promise<string> {
  const s = await createAiSession({ system });
  try { return await s.promptStreaming(text, onChunk); } finally { s.destroy(); }
}

export { extractJSON };
