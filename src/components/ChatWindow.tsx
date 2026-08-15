import type { UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { Send, Loader2 } from "lucide-react";
import { isAiUsable, createAiSession, type AiSession } from "@/lib/ai-provider";
import { AiUnavailable } from "@/components/AiUnavailable";
import { toast } from "sonner";

type Msg = { id: string; role: "user" | "assistant"; text: string };

export function ChatWindow({
  id,
  system,
  initialMessages = [],
  placeholder = "メッセージを入力…",
}: {
  id: string;
  system?: string;
  initialMessages?: UIMessage[];
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>(() =>
    initialMessages.map((m) => ({
      id: m.id,
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      text: (m.parts ?? []).map((p: any) => (p.type === "text" ? p.text : "")).join(""),
    })),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [canAi, setCanAi] = useState<boolean>(false);
  const sessionRef = useRef<AiSession | null>(null);

  useEffect(() => { isAiUsable().then(setCanAi); }, []);
  useEffect(() => {
    return () => { sessionRef.current?.destroy(); sessionRef.current = null; };
  }, [id]);

  const ensureSession = async () => {
    if (sessionRef.current) return sessionRef.current;
    sessionRef.current = await createAiSession({ system });
    return sessionRef.current;
  };

  const send = async (text: string) => {
    setIsLoading(true);
    const userId = `u_${Date.now()}`;
    setMessages((m) => [...m, { id: userId, role: "user", text }]);
    try {
      const s = await ensureSession();
      setStreaming("");
      const reply = await s.promptStreaming(text, (partial) => setStreaming(partial));
      setMessages((m) => [...m, { id: `a_${Date.now()}`, role: "assistant", text: reply }]);
    } catch (e: any) {
      toast.error(e.message ?? "AI 応答に失敗");
    } finally {
      setIsLoading(false);
      setStreaming("");
    }
  };

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {!canAi && <AiUnavailable feature="チャット" />}
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground text-sm">
            会話を開始してください
          </p>
        )}
        {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 prose prose-sm dark:prose-invert ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <ReactMarkdown>{m.text}</ReactMarkdown>
              </div>
            </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-muted prose prose-sm dark:prose-invert">
              {streaming ? (
                <>
                  <ReactMarkdown>{streaming}</ReactMarkdown>
                  <span className="inline-block w-2 h-4 align-middle bg-primary/70 animate-pulse rounded-sm" />
                </>
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        className="border-t p-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = input.trim();
          if (!t || isLoading || !canAi) return;
          void send(t);
          setInput("");
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={!canAi}
          className="min-h-[44px] max-h-32 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement).requestSubmit();
            }
          }}
        />
        <Button type="submit" disabled={isLoading || !input.trim() || !canAi}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
