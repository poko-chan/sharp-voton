// WebLLM (MLC) ラッパー。Chrome Built-in AI と同じセッション形状を提供する。
// 要件: WebGPU。ライブラリ本体はブラウザで CDN から動的ロードする
// （npm 依存としてバンドルすると SSR ビルドがメモリ不足で落ちるため）。

export type WebLlmStatus = "unavailable" | "downloadable" | "downloading" | "available";

export type WebLlmModel = {
  id: string;
  label: string;
  sizeLabel: string;
  note: string;
};

/** 大きいほど賢いが、初回ダウンロードと VRAM 消費が増える。 */
export const WEBLLM_MODELS: WebLlmModel[] = [
  {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    label: "標準（Qwen2.5 3B）",
    sizeLabel: "約 1.9GB",
    note: "日本語の品質と速度のバランスが最も良い。推奨。",
  },
  {
    id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    label: "高品質（Qwen2.5 7B）",
    sizeLabel: "約 4.4GB",
    note: "最も賢い。VRAM 6GB 以上の PC 向け。",
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "軽量（Qwen2.5 1.5B）",
    sizeLabel: "約 1.1GB",
    note: "非力な端末向け。品質は落ちる。",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B",
    sizeLabel: "約 2.0GB",
    note: "英語中心の用途向け。",
  },
];

export const DEFAULT_WEBLLM_MODEL = WEBLLM_MODELS[0].id;
const MODEL_KEY = "ai.webllm.model";
const WEBLLM_CDN = "https://esm.run/@mlc-ai/web-llm@0.2.84";

export function getWebLlmModelId(): string {
  if (typeof window === "undefined") return DEFAULT_WEBLLM_MODEL;
  const v = window.localStorage.getItem(MODEL_KEY);
  return WEBLLM_MODELS.some((m) => m.id === v) ? (v as string) : DEFAULT_WEBLLM_MODEL;
}

export function setWebLlmModelId(id: string) {
  if (typeof window === "undefined") return;
  if (!WEBLLM_MODELS.some((m) => m.id === id)) return;
  if (id === getWebLlmModelId()) return;
  window.localStorage.setItem(MODEL_KEY, id);
  // モデルを切り替えたらエンジンを作り直す
  enginePromise = null;
  engineReady = false;
  engineDownloading = false;
  lastProgress = 0;
  lastProgressText = "";
  try {
    window.dispatchEvent(new CustomEvent("ai-webllm-model-changed", { detail: id }));
  } catch { /* noop */ }
}

let modulePromise: Promise<any> | null = null;
function loadModule(): Promise<any> {
  if (!modulePromise) {
    const importPromise = import(/* @vite-ignore */ WEBLLM_CDN);
    const timeoutPromise = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("WebLLM 本体の取得が2分間進まなかったため中断しました")), 2 * 60 * 1000);
    });
    modulePromise = Promise.race([importPromise, timeoutPromise]).catch((error: unknown) => {
      modulePromise = null;
      throw error;
    });
  }
  return modulePromise;
}

let enginePromise: Promise<any> | null = null;
const CACHE_KEY = "ai.webllm.cached";
function cacheKeyFor(id: string) { return `${CACHE_KEY}:${id}`; }
function isCached() {
  return typeof window !== "undefined" && localStorage.getItem(cacheKeyFor(getWebLlmModelId())) === "true";
}
let engineReady = false;
let engineDownloading = false;
let lastProgress = 0;
let lastProgressText = "";

function hasWebGpu(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as any).gpu;
}

export function isModelCached(): boolean {
  return engineReady || isCached();
}

export async function webLlmStatus(): Promise<WebLlmStatus> {
  if (typeof window === "undefined") return "unavailable";
  if (!hasWebGpu()) return "unavailable";
  if (engineReady || isCached()) return "available";
  if (engineDownloading) return "downloading";
  return "downloadable";
}

export type WebLlmDiagnostics = {
  status: WebLlmStatus;
  reason: string;
  hasWebGpu: boolean;
  progress: number;
  progressText: string;
  modelId: string;
  modelLabel: string;
};

export async function webLlmDiagnostics(): Promise<WebLlmDiagnostics> {
  const gpu = hasWebGpu();
  const status = await webLlmStatus();
  const modelId = getWebLlmModelId();
  const model = WEBLLM_MODELS.find((m) => m.id === modelId);
  let reason = "";
  if (!gpu) reason = "WebGPU が利用できません（Chrome/Edge 最新版・対応 GPU が必要）。";
  else if (status === "available") reason = `利用可能です（${model?.label ?? modelId}）。`;
  else if (status === "downloading") reason = `モデル取得中… ${Math.round(lastProgress * 100)}% ${lastProgressText}`;
  else reason = `初回は「${model?.label ?? modelId}」（${model?.sizeLabel ?? "数百MB〜"}）のダウンロードが必要です。`;
  return {
    status, reason, hasWebGpu: gpu,
    progress: lastProgress, progressText: lastProgressText,
    modelId, modelLabel: model?.label ?? modelId,
  };
}

export async function webLlmEnsureLoaded(
  onProgress?: (progress: number, text: string) => void,
  modelId: string = getWebLlmModelId(),
): Promise<any> {
  if (!hasWebGpu()) throw new Error("WebGPU が利用できません");
  if (enginePromise) return enginePromise;

  engineDownloading = true;

  enginePromise = (async () => {
    try {
      const mod = await loadModule();
      const loadPromise = mod.CreateMLCEngine(modelId, {
        initProgressCallback: (p: any) => {
          lastProgress = p.progress ?? 0;
          lastProgressText = p.text ?? "";
          try { onProgress?.(lastProgress, lastProgressText); } catch { /* noop */ }
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("WebLLM の取得が20分間進まなかったため中断しました")), 20 * 60 * 1000);
      });

      const eng = await Promise.race([loadPromise, timeoutPromise]);
      engineReady = true;
      if (typeof window !== "undefined") localStorage.setItem(cacheKeyFor(modelId), "true");
      engineDownloading = false;
      return eng;
    } catch (err: any) {
      engineDownloading = false;
      enginePromise = null;
      throw err;
    }
  })();

  return enginePromise;
}

export type WebLlmSession = {
  prompt: (text: string) => Promise<string>;
  promptJSON: <T = unknown>(text: string) => Promise<T>;
  promptStreaming: (text: string, onChunk: (partial: string) => void) => Promise<string>;
  destroy: () => void;
};

const DEFAULT_SYSTEM =
  "あなたは日本の学習者を支援する優秀な学習アシスタントです。" +
  "必ず日本語で、簡潔かつ具体的に答えてください。" +
  "同じ文や語句を繰り返さないこと。分からないことは推測せず「分かりません」と述べること。" +
  "指示された形式がある場合はその形式のみを出力すること。";

/** 直近のやり取りだけを保持して暴走・繰り返しを防ぐ */
const MAX_TURNS = 6;

/** 同一文の繰り返しループを検出して打ち切る */
function isLooping(text: string): boolean {
  if (text.length < 240) return false;
  const tail = text.slice(-600);
  const parts = tail.split(/[。．.!?！？\n]/).map((s) => s.trim()).filter((s) => s.length > 8);
  if (parts.length < 4) return false;
  const uniq = new Set(parts);
  // 直近の文のうち半分以上が重複していればループとみなす
  return uniq.size <= Math.floor(parts.length / 2);
}

export async function createWebLlmSession(opts?: {
  system?: string;
  temperature?: number;
}): Promise<WebLlmSession> {
  const engine = await webLlmEnsureLoaded();
  const system = opts?.system ? `${DEFAULT_SYSTEM}\n\n${opts.system}` : DEFAULT_SYSTEM;
  const history: Array<{ role: string; content: string }> = [{ role: "system", content: system }];

  const complete = async (text: string, onChunk?: (p: string) => void) => {
    history.push({ role: "user", content: text });
    // system + 直近 MAX_TURNS 件だけ渡す
    const messages = [history[0], ...history.slice(1).slice(-MAX_TURNS)];
    const stream = await engine.chat.completions.create({
      messages,
      stream: true,
      temperature: opts?.temperature ?? 0.3,
      top_p: 0.9,
      // 繰り返し・オウム返しの抑制（これが無いと同じ文を延々と吐く）
      frequency_penalty: 0.6,
      presence_penalty: 0.4,
      max_tokens: 1024,
    });
    let full = "";
    for await (const chunk of stream as any) {
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        full += delta;
        try { onChunk?.(full); } catch { /* noop */ }
        if (isLooping(full)) {
          try { await engine.interruptGenerate?.(); } catch { /* noop */ }
          break;
        }
      }
    }
    const answer = full.trim();
    history.push({ role: "assistant", content: answer });
    if (history.length > MAX_TURNS * 2 + 1) {
      history.splice(1, history.length - (MAX_TURNS * 2 + 1));
    }
    return answer;
  };

  return {
    prompt: (t) => complete(t),
    promptJSON: async <T,>(t: string): Promise<T> => {
      const out = await complete(
        `${t}\n\n出力は JSON のみ。説明文・コードフェンス・前置きは一切書かないこと。`,
      );
      const { extractJSON } = await import("@/lib/chrome-ai");
      return extractJSON<T>(out);
    },
    promptStreaming: (t, onChunk) => complete(t, onChunk),
    destroy: () => { /* engine は共有なので破棄しない */ },
  };
}
