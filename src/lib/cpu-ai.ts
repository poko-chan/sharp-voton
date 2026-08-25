// WebAssembly/CPU で動く最終フォールバック。WebGPU や有料 API は不要。
import { extractJSON } from "@/lib/chrome-ai";

export type CpuAiStatus = "unavailable" | "downloadable" | "downloading" | "available";
export const CPU_AI_MODEL = "onnx-community/TinyLlama-1.1B-Chat-v1.0-ONNX";
const TRANSFORMERS_CDN = "https://esm.run/@huggingface/transformers@3.7.6";

let generatorPromise: Promise<any> | null = null;
const CACHE_KEY = "ai.cpu.cached";
function isCached() { return typeof window !== "undefined" && localStorage.getItem(CACHE_KEY) === "true"; }
let ready = false;
let downloading = false;
let lastProgress = 0;
let lastProgressText = "";

function supported() {
  return typeof window !== "undefined" && typeof WebAssembly !== "undefined";
}

export async function cpuAiStatus(): Promise<CpuAiStatus> {
  if (!supported()) return "unavailable";
  if (ready || isCached()) return "available";
  if (downloading) return "downloading";
  return "downloadable";
}

export async function cpuAiDiagnostics() {
  const status = await cpuAiStatus();
  const reason = status === "unavailable"
    ? "WebAssembly が使えないため利用できません。"
    : status === "available"
      ? "CPU で利用可能です。WebGPU・有料プランは不要です。"
      : status === "downloading"
        ? `モデル取得中… ${lastProgress}% ${lastProgressText}`
        : "初回のみ小型モデルを取得します。処理は遅めですが、WebGPU・有料プランは不要です。";
  return { status, reason, progress: lastProgress, progressText: lastProgressText };
}

export async function cpuAiEnsureLoaded(onProgress?: (progress: number, text: string) => void) {
  if (!supported()) throw new Error("この端末では CPU AI を利用できません");
  if (generatorPromise) return generatorPromise;

  downloading = true;
  
  generatorPromise = (async () => {
    try {
      const modPromise = import(/* @vite-ignore */ TRANSFORMERS_CDN);
      const importTimeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("CPU AI 本体の取得が2分間進まなかったため中断しました")), 2 * 60 * 1000);
      });
      
      const mod = await Promise.race([modPromise, importTimeout]);
      
      const loadModel = mod.pipeline("text-generation", CPU_AI_MODEL, {
        device: "wasm",
        dtype: "q4",
        progress_callback: (event: any) => {
          const raw = Number(event?.progress ?? 0);
          lastProgress = Math.max(lastProgress, Math.min(100, Math.round(raw <= 1 ? raw * 100 : raw)));
          lastProgressText = String(event?.file ?? event?.status ?? "");
          onProgress?.(lastProgress, lastProgressText);
        },
      });
      
      const modelTimeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("CPU AI モデルの取得が10分間進まなかったため中断しました")), 10 * 60 * 1000);
      });
      
      const generator = await Promise.race([loadModel, modelTimeout]);
      ready = true;
      if (typeof window !== "undefined") localStorage.setItem(CACHE_KEY, "true");
      downloading = false;
      lastProgress = 100;
      return generator;
    } catch (error) {
      downloading = false;
      generatorPromise = null;
      const { storageInfo, friendlyStorageError } = await import("@/lib/web-llm");
      throw new Error(friendlyStorageError(error, await storageInfo(), "1.1B-"));
    }

  })();
  
  return generatorPromise;
}

export async function createCpuAiSession(opts?: { system?: string; temperature?: number }) {
  const generator = await cpuAiEnsureLoaded();
  const history: Array<{ role: string; content: string }> = [];
  if (opts?.system) history.push({ role: "system", content: opts.system });

  const complete = async (text: string, onChunk?: (partial: string) => void) => {
    history.push({ role: "user", content: text });
    const output = await generator(history, {
      max_new_tokens: 512,
      temperature: opts?.temperature ?? 0.4,
      do_sample: (opts?.temperature ?? 0.4) > 0,
    });
    const generated = output?.[0]?.generated_text;
    const full = Array.isArray(generated)
      ? String(generated.at(-1)?.content ?? "")
      : String(generated ?? "").slice(text.length).trim();
    history.push({ role: "assistant", content: full });
    onChunk?.(full);
    return full;
  };

  return {
    prompt: (text: string) => complete(text),
    promptJSON: async <T,>(text: string): Promise<T> => extractJSON<T>(await complete(text)),
    promptStreaming: (text: string, onChunk: (partial: string) => void) => complete(text, onChunk),
    destroy: () => { history.length = 0; },
  };
}
