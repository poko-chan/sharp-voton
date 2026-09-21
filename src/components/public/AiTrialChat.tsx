import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

const LIMIT = 3;
const KEY = "studysharp.aiTrial.v1";

type Msg = { role: "user" | "assistant"; content: string };

function today() {
  return new Date().toLocaleDateString("sv-SE");
}

function readUsed(): number {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return raw?.day === today() ? Number(raw.count) || 0 : 0;
  } catch {
    return 0;
  }
}

function writeUsed(count: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ day: today(), count }));
  } catch {
    /* ignore */
  }
}

export function AiTrialChat() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [used, setUsed] = useState(0);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUsed(readUsed());
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [msgs, busy]);

  if (signedIn === null) return null;

  if (signedIn) {
    return (
      <div className="surface p-5 text-sm text-muted-foreground">
        お試しチャットはログインしていない方向けの機能です。ログイン中の方はアプリ内のAIチャットをご利用ください。
      </div>
    );
  }

  const remaining = Math.max(0, LIMIT - used);

  const send = async () => {
    const q = input.trim();
    if (!q || busy || remaining <= 0) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);
    const nextUsed = used + 1;
    setUsed(nextUsed);
    writeUsed(nextUsed);

    try {
      const res = await fetch("/api/public/ai-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        setError((await res.text().catch(() => "")) || "AIの呼び出しに失敗しました");
        setMsgs(next);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMsgs([...next, { role: "assistant", content: acc }]);
      }
      if (!acc.trim()) setError("回答を受け取れませんでした");
    } catch {
      setError("通信に失敗しました");
      setMsgs(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold">実際にAIを使ってみる</h2>
        <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
          本日の残り {remaining} / {LIMIT} 回
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        ログインなしで、Study# のAIをそのまま試せます。1つの端末につき1日3回までご利用いただけます。
      </p>

      {msgs.length > 0 && (
        <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-xl border p-3">
          {msgs.map((m, i) => (
            <div
              key={i}
              className={`text-sm leading-relaxed ${m.role === "user" ? "text-right" : ""}`}
            >
              <span
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-left ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {m.content || (busy ? "考えています…" : "")}
              </span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={
            remaining > 0 ? "例: 二次方程式の解き方を教えて" : "本日のお試し回数を使い切りました"
          }
          disabled={busy || remaining <= 0}
        />
        <Button onClick={() => void send()} disabled={busy || remaining <= 0 || !input.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      {remaining <= 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          明日またお試しいただけます。無制限に使うにはアカウント登録がおすすめです。
        </p>
      )}
    </div>
  );
}
