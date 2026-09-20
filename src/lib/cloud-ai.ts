// バックエンド（サーバー）で動く LLM のセッション。端末のスペックに依存しない。
import { supabase } from "@/integrations/supabase/client";
import { extractJSON } from "@/lib/chrome-ai";
import { DEFAULT_CLOUD_MODEL } from "@/lib/cloud-models";
import type { ChromeAiSession } from "@/lib/chrome-ai";

export type CloudSessionOpts = {
  modelId?: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
};

async function streamOnce(
  opts: CloudSessionOpts,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  onChunk?: (partial: string) => void,
): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("AIを使うにはログインが必要です。");

  const res = await fetch("/api/ai-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      model: opts.modelId ?? DEFAULT_CLOUD_MODEL,
      system: opts.system,
      messages: history,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    }),
  });

  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `AIの呼び出しに失敗しました（${res.status}）`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
    onChunk?.(out);
  }
  if (!out.trim()) throw new Error("AIから回答が返りませんでした。もう一度お試しください。");
  return out;
}

/** 会話履歴を保持するクラウドセッション */
export function createCloudSession(opts: CloudSessionOpts = {}): ChromeAiSession {
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];

  const run = async (text: string, onChunk?: (p: string) => void) => {
    const turns = [...history, { role: "user" as const, content: text }];
    const out = await streamOnce(opts, turns, onChunk);
    history = [...turns, { role: "assistant" as const, content: out }].slice(-20);
    return out;
  };

  return {
    prompt: (t: string) => run(t),
    promptJSON: async <T>(t: string): Promise<T> => extractJSON<T>(await run(t)),
    promptStreaming: (t: string, onChunk: (p: string) => void) => run(t, onChunk),
    destroy: () => {
      history = [];
    },
  };
}
