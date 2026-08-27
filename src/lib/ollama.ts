// Ollama (端末にインストールされたローカル AI サーバー) 連携。
// ブラウザから http://localhost:11434 に直接アクセスする。
// CORS のため Ollama 側で OLLAMA_ORIGINS の設定が必要な場合がある。

const URL_KEY = "ai.ollama.url";
export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";

export function getOllamaUrl(): string {
  if (typeof window === "undefined") return DEFAULT_OLLAMA_URL;
  return window.localStorage.getItem(URL_KEY) || DEFAULT_OLLAMA_URL;
}

export function setOllamaUrl(url: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(URL_KEY, url.replace(/\/$/, ""));
}

export type OllamaModel = { name: string; sizeBytes: number };

let cache: { at: number; models: OllamaModel[] } | null = null;

/** インストール済みモデル一覧。Ollama が起動していなければ空配列。 */
export async function ollamaModels(force = false): Promise<OllamaModel[]> {
  if (typeof window === "undefined") return [];
  if (!force && cache && Date.now() - cache.at < 20_000) return cache.models;
  try {
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), 2500);
    const res = await fetch(`${getOllamaUrl()}/api/tags`, { signal: ctl.signal });
    window.clearTimeout(t);
    if (!res.ok) throw new Error("bad status");
    const json = await res.json();
    const models: OllamaModel[] = (json?.models ?? []).map((m: any) => ({
      name: String(m.name),
      sizeBytes: Number(m.size ?? 0),
    }));
    cache = { at: Date.now(), models };
    return models;
  } catch {
    cache = { at: Date.now(), models: [] };
    return [];
  }
}

export async function ollamaAvailable(): Promise<boolean> {
  return (await ollamaModels()).length > 0;
}

export type OllamaDiagnostics = {
  status: "available" | "unavailable";
  reason: string;
  url: string;
  models: OllamaModel[];
};

export async function ollamaDiagnostics(): Promise<OllamaDiagnostics> {
  const models = await ollamaModels();
  return {
    status: models.length > 0 ? "available" : "unavailable",
    reason:
      models.length > 0
        ? `${models.length} 個のモデルが使えます（${getOllamaUrl()}）。`
        : `Ollama が見つかりません。パソコンに Ollama をインストールして起動し、ターミナルで OLLAMA_ORIGINS="*" を設定してから再判定してください。`,
    url: getOllamaUrl(),
    models,
  };
}

export type OllamaSession = {
  prompt: (text: string) => Promise<string>;
  promptJSON: <T = unknown>(text: string) => Promise<T>;
  promptStreaming: (text: string, onChunk: (partial: string) => void) => Promise<string>;
  destroy: () => void;
};

export function createOllamaSession(model: string, opts?: { system?: string; temperature?: number }): OllamaSession {
  const history: Array<{ role: string; content: string }> = [];
  if (opts?.system) history.push({ role: "system", content: opts.system });

  const complete = async (text: string, onChunk?: (p: string) => void) => {
    history.push({ role: "user", content: text });
    const res = await fetch(`${getOllamaUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: history.slice(-13),
        stream: true,
        options: { temperature: opts?.temperature ?? 0.3 },
      }),
    });
    if (!res.ok || !res.body) throw new Error(`Ollama への接続に失敗しました (${res.status})`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line);
          const delta = j?.message?.content ?? "";
          if (delta) { full += delta; onChunk?.(full); }
        } catch { /* noop */ }
      }
    }
    const answer = full.trim();
    history.push({ role: "assistant", content: answer });
    return answer;
  };

  return {
    prompt: (t) => complete(t),
    promptJSON: async <T,>(t: string): Promise<T> => {
      const out = await complete(`${t}\n\n出力は JSON のみ。説明文やコードフェンスは書かないこと。`);
      const { extractJSON } = await import("@/lib/chrome-ai");
      return extractJSON<T>(out);
    },
    promptStreaming: (t, onChunk) => complete(t, onChunk),
    destroy: () => { history.length = 0; },
  };
}
