// WebLLM (MLC) ラッパー。Chrome Built-in AI と同じセッション形状を提供する。
// 要件: WebGPU。ライブラリ本体はブラウザで CDN から動的ロードする
// （npm 依存としてバンドルすると SSR ビルドがメモリ不足で落ちるため）。

export type WebLlmStatus = "unavailable" | "downloadable" | "downloading" | "available";

export const DEFAULT_WEBLLM_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const WEBLLM_CDN = "https://esm.run/@mlc-ai/web-llm@0.2.84";

let modulePromise: Promise<any> | null = null;
function loadModule(): Promise<any> {
  if (!modulePromise) modulePromise = import(/* @vite-ignore */ WEBLLM_CDN);
  return modulePromise;
}

let enginePromise: Promise<any> | null = null;
let engineReady = false;
let engineDownloading = false;
let lastProgress = 0;
let lastProgressText = "";

function hasWebGpu(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as any).gpu;
}

export function isModelCached(): boolean {
  return engineReady;
}

export async function webLlmStatus(): Promise<WebLlmStatus> {
  if (typeof window === "undefined") return "unavailable";
  if (!hasWebGpu()) return "unavailable";
  if (engineReady) return "available";
  if (engineDownloading) return "downloading";
  return "downloadable";
}

export type WebLlmDiagnostics = {
  status: WebLlmStatus;
  reason: string;
  hasWebGpu: boolean;
  progress: number;
  progressText: string;
};

export async function webLlmDiagnostics(): Promise<WebLlmDiagnostics> {
  const gpu = hasWebGpu();
  const status = await webLlmStatus();
  let reason = "";
  if (!gpu) reason = "WebGPU が利用できません（Chrome/Edge 最新版・対応 GPU が必要）。";
  else if (status === "available") reason = "利用可能です。";
  else if (status === "downloading") reason = `モデル取得中… ${Math.round(lastProgress * 100)}% ${lastProgressText}`;
  else reason = "初回はモデル（数百MB〜1GB）のダウンロードが必要です。";
  return { status, reason, hasWebGpu: gpu, progress: lastProgress, progressText: lastProgressText };
}

export async function webLlmEnsureLoaded(
  onProgress?: (progress: number, text: string) => void,
  modelId: string = DEFAULT_WEBLLM_MODEL,
): Promise<any> {
  if (!hasWebGpu()) throw new Error("WebGPU が利用できません");
  if (enginePromise) return enginePromise;
  engineDownloading = true;
  const mod = await loadModule();
  enginePromise = mod
    .CreateMLCEngine(modelId, {
      initProgressCallback: (p: any) => {
        lastProgress = p.progress ?? 0;
        lastProgressText = p.text ?? "";
        try { onProgress?.(lastProgress, lastProgressText); } catch { /* noop */ }
      },
    })
    .then((eng: any) => {
      engineReady = true;
      engineDownloading = false;
      return eng;
    })
    .catch((err: unknown) => {
      engineDownloading = false;
      enginePromise = null;
      throw err;
    });
  return enginePromise;
}

export type WebLlmSession = {
  prompt: (text: string) => Promise<string>;
  promptJSON: <T = unknown>(text: string) => Promise<T>;
  promptStreaming: (text: string, onChunk: (partial: string) => void) => Promise<string>;
  destroy: () => void;
};

export async function createWebLlmSession(opts?: {
  system?: string;
  temperature?: number;
}): Promise<WebLlmSession> {
  const engine = await webLlmEnsureLoaded();
  const history: Array<{ role: string; content: string }> = [];
  if (opts?.system) history.push({ role: "system", content: opts.system });

  const complete = async (text: string, onChunk?: (p: string) => void) => {
    history.push({ role: "user", content: text });
    const stream = await engine.chat.completions.create({
      messages: history,
      stream: true,
      temperature: opts?.temperature ?? 0.4,
    });
    let full = "";
    for await (const chunk of stream as any) {
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        full += delta;
        try { onChunk?.(full); } catch { /* noop */ }
      }
    }
    history.push({ role: "assistant", content: full });
    return full;
  };

  return {
    prompt: (t) => complete(t),
    promptJSON: async <T,>(t: string): Promise<T> => {
      const out = await complete(t);
      const { extractJSON } = await import("@/lib/chrome-ai");
      return extractJSON<T>(out);
    },
    promptStreaming: (t, onChunk) => complete(t, onChunk),
    destroy: () => { /* engine は共有なので破棄しない */ },
  };
}
