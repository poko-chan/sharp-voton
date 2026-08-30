// WebLLM (MLC) ラッパー。Chrome Built-in AI と同じセッション形状を提供する。
// 要件: WebGPU。ライブラリ本体はブラウザで CDN から動的ロードする
// （npm 依存としてバンドルすると SSR ビルドがメモリ不足で落ちるため）。

import { isDegenerate, sanitizeAiText, hasMeaningfulContent } from "@/lib/ai-degenerate";

export type WebLlmStatus = "unavailable" | "downloadable" | "downloading" | "available";

export type WebLlmTag = "japanese" | "reasoning" | "math" | "code" | "light" | "balanced" | "pro";

export type WebLlmModel = {
  id: string;
  label: string;
  sizeLabel: string;
  note: string;
  /** パラメータ数（B）。賢さの目安 */
  params: number;
  tags: WebLlmTag[];
  /** 賢さスコア（0-100）。オート選択と並び替えに使う */
  quality: number;
  /** 日本語の得意さ（0-100） */
  japanese: number;
};

/** 大きいほど賢いが、初回ダウンロードと VRAM 消費が増える。 */
export const WEBLLM_MODELS: WebLlmModel[] = [
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 1.5B（標準）",
    sizeLabel: "約 1.1GB",
    note: "容量が小さく失敗しにくい。まずはこれを推奨。日本語もそこそこ。",
    params: 1.5, tags: ["balanced", "japanese"], quality: 46, japanese: 62,
  },
  {
    id: "Qwen3-1.7B-q4f16_1-MLC",
    label: "Qwen3 1.7B（新世代・軽量）",
    sizeLabel: "約 1.3GB",
    note: "最新世代。軽いのに理屈立てた回答が得意。迷ったらこれか標準。",
    params: 1.7, tags: ["balanced", "reasoning", "japanese"], quality: 55, japanese: 68,
  },
  {
    id: "Qwen3-4B-q4f16_1-MLC",
    label: "Qwen3 4B（新世代・高品質）",
    sizeLabel: "約 2.6GB",
    note: "最新世代の中位モデル。日本語の説明が丁寧で、考える力も高い。",
    params: 4, tags: ["reasoning", "japanese"], quality: 72, japanese: 78,
  },
  {
    id: "Qwen3-8B-q4f16_1-MLC",
    label: "Qwen3 8B（新世代・最上位）",
    sizeLabel: "約 5.1GB",
    note: "端末内AIでは最上位クラス。VRAM 6GB 以上の PC 向け。",
    params: 8, tags: ["pro", "reasoning", "japanese"], quality: 88, japanese: 84,
  },
  {
    id: "Qwen3-0.6B-q4f16_1-MLC",
    label: "Qwen3 0.6B（超軽量・新世代）",
    sizeLabel: "約 0.5GB",
    note: "スマホや古い PC 向け。短い質問の受け答え中心。",
    params: 0.6, tags: ["light"], quality: 30, japanese: 50,
  },
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 0.5B（最軽量）",
    sizeLabel: "約 0.4GB",
    note: "空き容量が少ない端末向け。品質は落ちるが確実に動く。",
    params: 0.5, tags: ["light"], quality: 25, japanese: 46,
  },
  {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 3B（高品質）",
    sizeLabel: "約 1.9GB",
    note: "日本語の品質と速度のバランスが良い。空き容量 4GB 以上推奨。",
    params: 3, tags: ["balanced", "japanese"], quality: 62, japanese: 72,
  },
  {
    id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 7B（最高品質）",
    sizeLabel: "約 4.4GB",
    note: "とても賢い。VRAM 6GB 以上・空き容量 10GB 以上の PC 向け。",
    params: 7, tags: ["pro", "japanese"], quality: 82, japanese: 80,
  },
  {
    id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
    label: "DeepSeek R1 蒸留 7B（じっくり思考）",
    sizeLabel: "約 4.4GB",
    note: "考える過程を出しながら答える推論特化。数学・理科の難問向け（少し遅い）。",
    params: 7, tags: ["pro", "reasoning", "math"], quality: 84, japanese: 68,
  },
  {
    id: "DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC",
    label: "DeepSeek R1 蒸留 8B（推論特化）",
    sizeLabel: "約 5.0GB",
    note: "難しい問題を段階的に解くのが得意。高性能 PC 向け。",
    params: 8, tags: ["pro", "reasoning", "math"], quality: 85, japanese: 64,
  },
  {
    id: "gemma-2-2b-jpn-it-q4f16_1-MLC",
    label: "Gemma 2 2B 日本語版（日本語特化）",
    sizeLabel: "約 1.6GB",
    note: "Google 製の日本語チューニング版。自然な日本語の説明が得意。",
    params: 2, tags: ["japanese", "balanced"], quality: 58, japanese: 88,
  },
  {
    id: "gemma-2-2b-it-q4f16_1-MLC",
    label: "Gemma 2 2B",
    sizeLabel: "約 1.5GB",
    note: "Google 製。短い説明が上手。",
    params: 2, tags: ["balanced"], quality: 50, japanese: 60,
  },
  {
    id: "gemma-2-9b-it-q4f16_1-MLC",
    label: "Gemma 2 9B",
    sizeLabel: "約 5.0GB",
    note: "Google 製の大型。高性能 PC 向け。",
    params: 9, tags: ["pro"], quality: 80, japanese: 70,
  },
  {
    id: "Qwen2.5-Math-1.5B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 Math 1.5B（数学向け）",
    sizeLabel: "約 1.1GB",
    note: "数式の計算・証明の説明が得意。数学の質問向け。",
    params: 1.5, tags: ["math", "light"], quality: 42, japanese: 52,
  },
  {
    id: "Qwen2.5-Math-7B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 Math 7B（数学・上位）",
    sizeLabel: "約 4.4GB",
    note: "数学に特化した大型モデル。入試レベルの計算・証明に強い。",
    params: 7, tags: ["math", "pro"], quality: 78, japanese: 60,
  },
  {
    id: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 Coder 1.5B（プログラミング向け）",
    sizeLabel: "約 1.1GB",
    note: "コードの説明・添削が得意。情報や技術の学習向け。",
    params: 1.5, tags: ["code", "light"], quality: 42, japanese: 52,
  },
  {
    id: "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 Coder 7B（プログラミング・上位）",
    sizeLabel: "約 4.4GB",
    note: "本格的なコード読解・添削。情報科目や自由研究に。",
    params: 7, tags: ["code", "pro"], quality: 79, japanese: 62,
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 1B",
    sizeLabel: "約 0.9GB",
    note: "軽量。英語中心の用途向け。",
    params: 1, tags: ["light"], quality: 32, japanese: 44,
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B",
    sizeLabel: "約 2.0GB",
    note: "英語中心の用途向け。要約が得意。",
    params: 3, tags: ["balanced"], quality: 55, japanese: 55,
  },
  {
    id: "Llama-3.1-8B-Instruct-q4f16_1-MLC",
    label: "Llama 3.1 8B",
    sizeLabel: "約 4.6GB",
    note: "高性能だが重い。ゲーミング PC 向け。",
    params: 8, tags: ["pro"], quality: 78, japanese: 62,
  },
  {
    id: "Hermes-3-Llama-3.1-8B-q4f16_1-MLC",
    label: "Hermes 3 8B（対話チューニング）",
    sizeLabel: "約 4.6GB",
    note: "会話や指示への追従が丁寧。長めの説明が得意。",
    params: 8, tags: ["pro"], quality: 79, japanese: 60,
  },
  {
    id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
    label: "Mistral 7B",
    sizeLabel: "約 4.5GB",
    note: "定番の大型モデル。高性能 PC 向け。",
    params: 7, tags: ["pro"], quality: 74, japanese: 56,
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    label: "Phi 3.5 mini",
    sizeLabel: "約 2.2GB",
    note: "Microsoft 製。論理的な問題に強い。",
    params: 3.8, tags: ["reasoning", "balanced"], quality: 60, japanese: 52,
  },
  {
    id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
    label: "SmolLM2 1.7B",
    sizeLabel: "約 1.1GB",
    note: "軽量で高速。簡単な質問向け。",
    params: 1.7, tags: ["light"], quality: 36, japanese: 42,
  },
  {
    id: "TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC",
    label: "TinyLlama 1.1B（お試し用）",
    sizeLabel: "約 0.7GB",
    note: "とにかく軽い動作確認向け。品質は限定的。",
    params: 1.1, tags: ["light"], quality: 20, japanese: 36,
  },
];

export const WEBLLM_TAG_LABELS: Record<WebLlmTag, string> = {
  japanese: "日本語が得意",
  reasoning: "考える力",
  math: "数学",
  code: "プログラミング",
  light: "軽量",
  balanced: "バランス",
  pro: "高性能PC向け",
};

/** 端末内AIとしての総合おすすめ度（日本語の学習用途向けに重み付け） */
export function webLlmRecommendScore(m: WebLlmModel): number {
  return Math.round(m.quality * 0.65 + m.japanese * 0.35);
}



/** モデル ID からおおよその必要バイト数を推定する（空き容量チェック用） */
export function estimateModelBytes(id: string): number {
  const m = /(\d+(?:\.\d+)?)B-/.exec(id);
  const params = m ? Number(m[1]) : 1.5;
  // q4 量子化 ≒ 0.6GB / 1B パラメータ + 展開作業領域の余裕 25%
  return Math.round(params * 0.6 * 1024 ** 3 * 1.25);
}

export type StorageInfo = { usage: number; quota: number; free: number; persisted: boolean };

/** ブラウザのストレージ空き状況（Quota exceeded の原因調査用） */
export async function storageInfo(): Promise<StorageInfo | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  try {
    const est = await navigator.storage.estimate();
    const usage = est.usage ?? 0;
    const quota = est.quota ?? 0;
    let persisted = false;
    try { persisted = (await navigator.storage.persisted?.()) ?? false; } catch { /* noop */ }
    return { usage, quota, free: Math.max(0, quota - usage), persisted };
  } catch {
    return null;
  }
}

/** 永続ストレージを要求して、モデルが勝手に消されるのを防ぐ */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try { return await navigator.storage.persist(); } catch { return false; }
}

/** ダウンロード済みモデルキャッシュを削除して容量を空ける */
export async function clearWebLlmCache(): Promise<void> {
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => /webllm|mlc|model|wasm/i.test(k)).map((k) => caches.delete(k)),
    );
  }
  if (typeof indexedDB !== "undefined" && (indexedDB as any).databases) {
    try {
      const dbs = await (indexedDB as any).databases();
      await Promise.all(
        (dbs ?? [])
          .filter((db: any) => db?.name && /webllm|mlc|tvmjs/i.test(db.name))
          .map((db: any) => new Promise((res) => {
            const req = indexedDB.deleteDatabase(db.name);
            req.onsuccess = req.onerror = req.onblocked = () => res(null);
          })),
      );
    } catch { /* noop */ }
  }
  if (typeof window !== "undefined") {
    for (const m of WEBLLM_MODELS) window.localStorage.removeItem(cacheKeyFor(m.id));
  }
  enginePromise = null;
  engineReady = false;
  engineDownloading = false;
  lastProgress = 0;
  lastProgressText = "";
}

/** ストレージ不足系のエラーを日本語の具体的な案内に変換する */
export function friendlyStorageError(err: unknown, info: StorageInfo | null, modelId: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  const isQuota = /quota|QuotaExceeded|storage|space|容量/i.test(msg);
  if (!isQuota) return msg;
  const gb = (n: number) => `${(n / 1024 ** 3).toFixed(1)}GB`;
  const need = estimateModelBytes(modelId);
  const freeText = info ? `空き ${gb(info.free)} / 上限 ${gb(info.quota)}` : "空き容量を取得できませんでした";
  return [
    "ブラウザの保存容量が足りずダウンロードできませんでした（Quota exceeded）。",
    `必要: 約 ${gb(need)} ／ 現在: ${freeText}`,
    "対処: ①「キャッシュを削除」で古いモデルを消す ②より軽いモデルを選ぶ ③シークレットウィンドウでは容量制限が厳しいので通常ウィンドウを使う ④端末の空き容量を増やす",
  ].join("\n");
}

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

/** ダウンロード済み（すぐ使える）モデル ID の一覧 */
export function webLlmCachedModelIds(): string[] {
  if (typeof window === "undefined") return [];
  return WEBLLM_MODELS.filter((m) => window.localStorage.getItem(cacheKeyFor(m.id)) === "true").map((m) => m.id);
}

export function hasWebGpuSupport(): boolean {
  return hasWebGpu();
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

let loadedModelId: string | null = null;

export async function webLlmEnsureLoaded(
  onProgress?: (progress: number, text: string) => void,
  modelId: string = getWebLlmModelId(),
): Promise<any> {
  if (!hasWebGpu()) throw new Error("WebGPU が利用できません");
  if (enginePromise && loadedModelId === modelId) return enginePromise;
  if (enginePromise && loadedModelId !== modelId) {
    enginePromise = null;
    engineReady = false;
  }
  loadedModelId = modelId;


  engineDownloading = true;

  enginePromise = (async () => {
    try {
      // 事前チェック: 保存容量が足りないと途中で Quota exceeded になる
      await requestPersistentStorage();
      const info = await storageInfo();
      const need = estimateModelBytes(modelId);
      if (info && info.quota > 0 && info.free < need) {
        throw new Error(friendlyStorageError(new Error("QuotaExceededError"), info, modelId));
      }
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
      const info = await storageInfo();
      throw new Error(friendlyStorageError(err, info, modelId));
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
  return isDegenerate(text);
}


export async function createWebLlmSession(opts?: {
  system?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  modelId?: string;
}): Promise<WebLlmSession> {
  const engine = await webLlmEnsureLoaded(undefined, opts?.modelId ?? getWebLlmModelId());
  const system = opts?.system ? `${DEFAULT_SYSTEM}\n\n${opts.system}` : DEFAULT_SYSTEM;
  const history: Array<{ role: string; content: string }> = [{ role: "system", content: system }];

  const complete = async (text: string, onChunk?: (p: string) => void) => {
    history.push({ role: "user", content: text });

    const runOnce = async (attempt: number) => {
      // system + 直近 MAX_TURNS 件だけ渡す
      const base = [history[0], ...history.slice(1).slice(-MAX_TURNS)];
      const messages = attempt === 0
        ? base
        : [...base, {
            role: "user",
            content: "直前の出力が同じ文字・語句の繰り返しになって壊れていました。記号の連打をせず、普通の日本語の文章で、簡潔に答え直してください。",
          }];
      const stream = await engine.chat.completions.create({
        messages,
        stream: true,
        // リトライ時はサンプリングを変えて同じ暴走を避ける
        temperature: attempt === 0 ? (opts?.temperature ?? 0.3) : 0.75,
        top_p: attempt === 0 ? (opts?.topP ?? 0.9) : 0.95,
        // 繰り返し・オウム返しの抑制（これが無いと同じ文を延々と吐く）
        frequency_penalty: attempt === 0 ? (opts?.frequencyPenalty ?? 0.6) : 1.0,
        presence_penalty: attempt === 0 ? (opts?.presencePenalty ?? 0.4) : 0.8,
        max_tokens: opts?.maxTokens ?? 1024,
      });
      let full = "";
      let broken = false;
      for await (const chunk of stream as any) {
        const delta = chunk.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          try { onChunk?.(sanitizeAiText(full)); } catch { /* noop */ }
          if (isDegenerate(full)) {
            broken = true;
            try { await engine.interruptGenerate?.(); } catch { /* noop */ }
            break;
          }
        }
      }
      return { text: sanitizeAiText(full), broken };
    };

    let result = await runOnce(0);
    if (result.broken || !hasMeaningfulContent(result.text)) {
      try { result = await runOnce(1); } catch { /* 最初の結果を使う */ }
    }

    const answer = result.text.trim();
    if (!hasMeaningfulContent(answer)) {
      // 壊れた出力は履歴に残さない（次の生成まで巻き込まれるため）
      history.pop();
      throw new Error("AIの出力が壊れました（同じ記号の繰り返し）。もう一度送信するか、AI設定で別のモデルを選んでください。");
    }
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
