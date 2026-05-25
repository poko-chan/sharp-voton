import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { Send, Loader2 } from "lucide-react";

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
  const transport = useRef(
    new DefaultChatTransport({ api: "/api/chat", body: { system } }),
  ).current;
  const { messages, sendMessage, status } = useChat({
    id,
    messages: initialMessages,
    transport,
  });
  const isLoading = status === "submitted" || status === "streaming";
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground text-sm">
            会話を開始してください
          </p>
        )}
        {messages.map((m) => {
          const text = m.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("");
          return (
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
                <ReactMarkdown>{text}</ReactMarkdown>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form
        className="border-t p-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = input.trim();
          if (!t || isLoading) return;
          void sendMessage({ text: t });
          setInput("");
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="min-h-[44px] max-h-32 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement).requestSubmit();
            }
          }}
        />
        <Button type="submit" disabled={isLoading || !input.trim()}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
