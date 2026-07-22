// 統一 AI プロバイダ: Gemini Nano (Chrome Built-in AI) → WebLLM の順にフォールバック。
// 両方使える場合はユーザーが選択できる (localStorage: ai.engine)。

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

export type AiEnginePref = "auto" | "nano" | "webllm";
export type AiEngine = "nano" | "webllm" | "none";

const LS_KEY = "ai.engine.pref";

export function getAiEnginePref(): AiEnginePref {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(LS_KEY) as AiEnginePref | null;
  return v === "nano" || v === "webllm" || v === "auto" ? v : "auto";
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
  const [nano, web] = await Promise.all([chromeAiStatus(), webLlmStatus()]);
  const pref = getAiEnginePref();
  if (pref === "nano") return isNanoUsable(nano) ? "nano" : isWebLlmUsable(web) ? "webllm" : "none";
  if (pref === "webllm") return isWebLlmUsable(web) ? "webllm" : isNanoUsable(nano) ? "nano" : "none";
  // auto: Nano を優先（軽量・高速）
  if (isNanoUsable(nano)) return "nano";
  if (isWebLlmUsable(web)) return "webllm";
  return "none";
}

export type AiDiagnostics = {
  active: AiEngine;
  pref: AiEnginePref;
  nano: Awaited<ReturnType<typeof chromeAiDiagnostics>>;
  webllm: Awaited<ReturnType<typeof webLlmDiagnostics>>;
};

export async function aiDiagnostics(): Promise<AiDiagnostics> {
  const [nano, webllm, active] = await Promise.all([
    chromeAiDiagnostics(),
    webLlmDiagnostics(),
    resolveAiEngine(),
  ]);
  return { active, pref: getAiEnginePref(), nano, webllm };
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
    await chromeAiEnsureDownloaded((l, t) => onProgress?.(l, t));
  } else if (engine === "webllm") {
    await webLlmEnsureLoaded((p, text) => onProgress?.(Math.round(p * 1000), 1000, text));
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
  if (engine === "nano") {
    const s = await createChromeAiSession(opts);
    return Object.assign(s, { engine: "nano" as const });
  }
  if (engine === "webllm") {
    const s = await createWebLlmSession({ system: opts?.system, temperature: opts?.temperature });
    return Object.assign(s, { engine: "webllm" as const });
  }
  throw new Error("利用可能な AI エンジンがありません (Gemini Nano / WebLLM いずれも利用不可)");
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
