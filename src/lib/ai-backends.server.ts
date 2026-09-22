// サーバー側で動かす LLM バックエンドの選択ロジック。
// 無料枠のプロバイダ（Groq / Cerebras / Google AI Studio / OpenRouter 無料モデル）を
// 優先して使い、どれも未設定のときだけ Lovable AI Gateway にフォールバックする。
// すべて OpenAI 互換の /chat/completions（SSE）で扱える。

export type Backend = {
  id: string;
  label: string;
  url: string;
  model: string;
  headers: Record<string, string>;
  free: boolean;
};

type Def = {
  id: string;
  label: string;
  env: string;
  base: string;
  model: string;
  /** モデル名の一部（例 "llama"）で優先選択するためのヒント */
  extraHeaders?: Record<string, string>;
};

const FREE_DEFS: Def[] = [
  {
    id: "groq",
    label: "Groq (無料枠)",
    env: "GROQ_API_KEY",
    base: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
  },
  {
    id: "cerebras",
    label: "Cerebras (無料枠)",
    env: "CEREBRAS_API_KEY",
    base: "https://api.cerebras.ai/v1",
    model: "llama-3.3-70b",
  },
  {
    id: "google",
    label: "Google AI Studio (無料枠)",
    env: "GOOGLE_AI_API_KEY",
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
  },
  {
    id: "openrouter",
    label: "OpenRouter (無料モデル)",
    env: "OPENROUTER_API_KEY",
    base: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.3-70b-instruct:free",
  },
];

/** 環境変数が入っている無料バックエンドを優先順に返す */
export function freeBackends(modelOverride?: string): Backend[] {
  const list: Backend[] = [];
  for (const def of FREE_DEFS) {
    const key = process.env[def.env];
    if (!key) continue;
    list.push({
      id: def.id,
      label: def.label,
      url: `${def.base}/chat/completions`,
      model: modelOverride?.startsWith(`${def.id}:`)
        ? modelOverride.slice(def.id.length + 1)
        : def.model,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        ...(def.extraHeaders ?? {}),
      },
      free: true,
    });
  }
  return list;
}

/** Lovable AI Gateway（クレジット消費）。無料枠が無いときだけ使う */
export function gatewayBackend(model: string): Backend | null {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  return {
    id: "lovable",
    label: "Lovable AI Gateway",
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    model,
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    free: false,
  };
}

/** 無料枠 → ゲートウェイの順に並べた候補一覧 */
export function backendChain(gatewayModel: string, modelOverride?: string): Backend[] {
  const chain = freeBackends(modelOverride);
  const gw = gatewayBackend(gatewayModel);
  if (gw) chain.push(gw);
  return chain;
}

export type ChatTurn = { role: "system" | "user" | "assistant"; content: string };

/** 候補を順に試し、最初に成功したストリーミング応答を返す */
export async function streamChat(options: {
  chain: Backend[];
  messages: ChatTurn[];
  temperature?: number;
  maxTokens?: number;
}): Promise<{ upstream: Response; backend: Backend } | { error: Response }> {
  const { chain, messages } = options;
  let last: { status: number; detail: string } | null = null;

  for (const backend of chain) {
    let res: Response;
    try {
      res = await fetch(backend.url, {
        method: "POST",
        headers: backend.headers,
        body: JSON.stringify({
          model: backend.model,
          stream: true,
          messages,
          ...(typeof options.temperature === "number"
            ? { temperature: options.temperature }
            : {}),
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        }),
      });
    } catch (e) {
      last = { status: 502, detail: String(e) };
      continue;
    }
    if (res.ok && res.body) return { upstream: res, backend };
    last = { status: res.status, detail: await res.text().catch(() => "") };
    // 401/402/429 などは次の候補へ
  }

  const status = last?.status ?? 500;
  const message =
    chain.length === 0
      ? "AIバックエンドが未設定です"
      : status === 429
        ? "AIの利用が混み合っています。少し待ってからお試しください。"
        : status === 402
          ? "AIの利用枠が不足しています。管理者にご連絡ください。"
          : `AIの呼び出しに失敗しました（${status}）`;
  return {
    error: new Response(message, {
      status: status === 200 ? 500 : status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }),
  };
}

/** OpenAI互換 SSE を読み、テキスト差分だけ plain text で流す */
export function pipeChatSse(upstream: Response, extraHeaders: Record<string, string> = {}) {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const delta =
                json?.choices?.[0]?.delta?.content ??
                (json?.type === "response.output_text.delta" ? json.delta : undefined);
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              /* 不完全な行は無視 */
            }
          }
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      ...extraHeaders,
    },
  });
}
