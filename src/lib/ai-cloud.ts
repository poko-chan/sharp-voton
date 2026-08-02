// クラウド AI（Lovable AI Gateway 経由）。端末やブラウザに依存せず必ず使える。
import { extractJSON } from "@/lib/chrome-ai";

export type CloudAiSession = {
  prompt: (text: string) => Promise<string>;
  promptJSON: <T = unknown>(text: string) => Promise<T>;
  promptStreaming: (text: string, onChunk: (partial: string) => void) => Promise<string>;
  destroy: () => void;
};

export type CloudStatus = "available" | "unavailable";

export async function cloudAiStatus(): Promise<CloudStatus> {
  if (typeof window === "undefined") return "unavailable";
  return navigator.onLine === false ? "unavailable" : "available";
}

export async function cloudAiDiagnostics() {
  const status = await cloudAiStatus();
  return {
    status,
    reason:
      status === "available"
        ? "クラウド AI（Study+ サーバー経由）。どの端末・ブラウザでも利用でき、ダウンロード不要です。"
        : "オフラインのため利用できません。ネットワークに接続してください。",
  };
}

export function createCloudAiSession(opts?: {
  system?: string;
  temperature?: number;
}): CloudAiSession {
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];

  const complete = async (text: string, onChunk?: (p: string) => void) => {
    history.push({ role: "user", content: text });
    const res = await fetch("/api/ai-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: opts?.system,
        temperature: opts?.temperature,
        messages: history,
      }),
    });
    if (!res.ok || !res.body) {
      const msg = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI が混み合っています。少し待って再試行してください。");
      if (res.status === 402) throw new Error("AI の利用上限に達しました。管理者にお問い合わせください。");
      throw new Error(msg || "クラウド AI の呼び出しに失敗しました");
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      try { onChunk?.(full); } catch { /* noop */ }
    }
    history.push({ role: "assistant", content: full });
    return full;
  };

  return {
    prompt: (t) => complete(t),
    promptJSON: async <T,>(t: string): Promise<T> => extractJSON<T>(await complete(t)),
    promptStreaming: (t, onChunk) => complete(t, onChunk),
    destroy: () => { history.length = 0; },
  };
}