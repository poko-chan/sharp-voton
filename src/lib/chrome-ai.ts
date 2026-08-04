// Chrome Built-in AI (Prompt API / window.ai / LanguageModel) のラッパー
// Origin Trial を使用。利用不可な場合は available() が false を返す。

type Status = "unavailable" | "downloadable" | "downloading" | "available";

declare global {
  // Chrome 138+
  // eslint-disable-next-line no-var
  var LanguageModel: any;
  interface Window {
    ai?: any;
    LanguageModel?: any;
  }
}

function getLM(): any | null {
  if (typeof window === "undefined") return null;
  const w: any = window;
  if (w.LanguageModel) return w.LanguageModel;
  if (w.ai?.languageModel) return w.ai.languageModel;
  if (typeof (globalThis as any).LanguageModel !== "undefined") return (globalThis as any).LanguageModel;
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function chromeAiStatus(): Promise<Status> {
  const lm = getLM();
  if (!lm) return "unavailable";
  try {
    if (typeof lm.availability === "function") {
      const s = await withTimeout(Promise.resolve(lm.availability()), 4000, "unavailable");
      return (s as Status) ?? "unavailable";
    }
    if (typeof lm.capabilities === "function") {
      const c = await withTimeout(Promise.resolve(lm.capabilities()), 4000, null);
      const a = c?.available;
      if (a === "readily") return "available";
      if (a === "after-download") return "downloadable";
      if (a === "no") return "unavailable";
    }
  } catch {
    return "unavailable";
  }
  return "unavailable";
}

export type ChromeAiDiagnostics = {
  status: Status;
  reason: string;
  hasApi: boolean;
  browser: string;
  isSecure: boolean;
};

export async function chromeAiDiagnostics(): Promise<ChromeAiDiagnostics> {
  const lm = getLM();
  const hasApi = !!lm;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isChrome = /Chrome\/(\d+)/.test(ua) && !/Edg\//.test(ua);
  const chromeVer = ua.match(/Chrome\/(\d+)/)?.[1];
  const isSecure = typeof window !== "undefined" ? (window.isSecureContext ?? false) : false;
  const status = await chromeAiStatus();
  let reason = "";
  if (!hasApi) {
    if (!isChrome) reason = "Chrome 138+ が必要です（現在のブラウザは非対応）。";
    else if (chromeVer && Number(chromeVer) < 138) reason = `Chrome ${chromeVer} は非対応です。138 以上に更新してください。`;
    else reason = "内蔵 AI API が見つかりません。chrome://flags/#prompt-api-for-gemini-nano を Enabled にし、chrome://components の Optimization Guide On Device Model を最新に更新してください。";
  } else if (status === "unavailable") reason = "モデルは利用不可（デバイス要件未達 or ダウンロード失敗の可能性）。";
  else if (status === "downloadable") reason = "初回はモデルのダウンロード（数百MB）が必要です。ボタンを押すと開始します。";
  else if (status === "downloading") reason = "モデルを取得中です…しばらくお待ちください。";
  else reason = "利用可能です。";
  if (!isSecure) reason = "HTTPS でないため利用できません。";
  return { status, reason, hasApi, browser: isChrome ? `Chrome ${chromeVer ?? "?"}` : ua.split(" ").pop() ?? ua, isSecure };
}

let downloadPromise: Promise<Status> | null = null;

/** モデルを明示的にダウンロード開始する（downloadable のとき） */
export async function chromeAiEnsureDownloaded(onProgress?: (loaded: number, total: number) => void): Promise<Status> {
  const lm = getLM();
  if (!lm) return "unavailable";

  const status = await chromeAiStatus();
  if (status === "available") return "available";

  if (downloadPromise) return downloadPromise;

  downloadPromise = (async () => {
    try {
      const createPromise = Promise.resolve(lm.create({
        monitor(m: any) {
          m.addEventListener?.("downloadprogress", (e: any) => {
            try { onProgress?.(e.loaded ?? 0, e.total ?? 1); } catch { /* noop */ }
          });
        },
      }));
      const s: any = await Promise.race([
        createPromise,
        new Promise((_, reject) => window.setTimeout(() => reject(new Error("Gemini Nano の取得が 10 分間進まなかったため中断しました")), 10 * 60 * 1000)),
      ]);
      try { s.destroy?.(); } catch { /* noop */ }
      return chromeAiStatus();
    } catch (e: any) {
      console.error("Chrome AI Download Error:", e);
      throw e;
    } finally {
      downloadPromise = null;
    }
  })();

  return downloadPromise;
}

export async function isChromeAiUsable(): Promise<boolean> {
  const s = await chromeAiStatus();
  return s === "available" || s === "downloadable" || s === "downloading";
}

export type ChromeAiSession = {
  prompt: (text: string) => Promise<string>;
  promptJSON: <T = unknown>(text: string) => Promise<T>;
  promptStreaming: (text: string, onChunk: (partial: string) => void) => Promise<string>;
  destroy: () => void;
};

export async function createChromeAiSession(opts?: {
  system?: string;
  temperature?: number;
  topK?: number;
}): Promise<ChromeAiSession> {
  const lm = getLM();
  if (!lm) throw new Error("Chrome Built-in AI が利用できません");
  const init: any = {};
  if (opts?.system) {
    init.initialPrompts = [{ role: "system", content: opts.system }];
  }
  if (typeof opts?.temperature === "number") init.temperature = opts.temperature;
  if (typeof opts?.topK === "number") init.topK = opts.topK;

  const session: any = await lm.create(init);

  return {
    prompt: async (text: string) => {
      const r = await session.prompt(text);
      return typeof r === "string" ? r : String(r ?? "");
    },
    promptJSON: async <T,>(text: string): Promise<T> => {
      const out = await session.prompt(text);
      const str = typeof out === "string" ? out : String(out ?? "");
      return extractJSON<T>(str);
    },
    promptStreaming: async (text: string, onChunk: (partial: string) => void) => {
      if (typeof session.promptStreaming !== "function") {
        const r = await session.prompt(text);
        const s = typeof r === "string" ? r : String(r ?? "");
        onChunk(s);
        return s;
      }
      const stream: ReadableStream<string> = session.promptStreaming(text);
      const reader = stream.getReader();
      let full = "";
      let cumulative = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const v = typeof value === "string" ? value : String(value ?? "");
        if (!cumulative && v.startsWith(full) && v.length >= full.length) {
          full = v; cumulative = true;
        } else if (cumulative) {
          full = v;
        } else {
          full += v;
        }
        try { onChunk(full); } catch { /* noop */ }
      }
      return full;
    },
    destroy: () => {
      try { session.destroy?.(); } catch { /* noop */ }
    },
  };
}

/** モデル出力から JSON を取り出す（```json ブロックや前後の文字列を許容） */
export function extractJSON<T = unknown>(raw: string): T {
  if (!raw) throw new Error("AI 応答が空です");
  let s = raw.trim();
  // ```json ... ``` を剥がす
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // 最初の { または [ から末尾の対応する括弧まで切り出す
  const start = s.search(/[\[{]/);
  if (start === -1) throw new Error("JSON が見つかりません");
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let end = -1;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) { end = i; break; } }
  }
  const slice = end > 0 ? s.slice(start, end + 1) : s.slice(start);
  try {
    return JSON.parse(slice) as T;
  } catch (e: any) {
    throw new Error("JSON 解析失敗: " + e.message);
  }
}

/** 単発の便利関数 */
export async function chromeAiPrompt(text: string, system?: string): Promise<string> {
  const s = await createChromeAiSession({ system });
  try { return await s.prompt(text); } finally { s.destroy(); }
}

export async function chromeAiJSON<T = unknown>(text: string, system?: string): Promise<T> {
  const s = await createChromeAiSession({ system });
  try { return await s.promptJSON<T>(text); } finally { s.destroy(); }
}
