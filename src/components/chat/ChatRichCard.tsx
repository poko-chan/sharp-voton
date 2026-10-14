import { Link } from "@tanstack/react-router";
import { Timer, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** 招待カード本文: [study:meeting:CODE] / [study:timer:MINUTES] */
const RE = /^\[study:(meeting|timer):([A-Za-z0-9-]{0,32})\]$/;

export function makeMeetingCard(code: string) {
  return `[study:meeting:${code.replace(/[^A-Za-z0-9-]/g, "").slice(0, 32)}]`;
}
export function makeTimerCard(minutes: number) {
  return `[study:timer:${Math.max(1, Math.min(180, Math.round(minutes)))}]`;
}
export function isRichCard(content: string) {
  return RE.test(content.trim());
}

export function ChatRichCard({ content }: { content: string }) {
  const m = content.trim().match(RE);
  if (!m) return null;
  const [, kind, arg] = m;
  if (kind === "meeting") {
    return (
      <div className="rounded-lg border bg-card text-card-foreground p-3 min-w-[200px] space-y-2">
        <div className="flex items-center gap-2 font-medium">
          <Video className="h-4 w-4 text-primary" />
          オンライン自習室への招待
        </div>
        {arg && <div className="text-xs text-muted-foreground">会議コード: {arg}</div>}
        {arg ? (
          <Link
            to="/meetings/$code"
            params={{ code: arg }}
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
          >
            参加する
          </Link>
        ) : (
          <Link
            to="/meetings"
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
          >
            会議を開く
          </Link>
        )}
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card text-card-foreground p-3 min-w-[200px] space-y-2">
      <div className="flex items-center gap-2 font-medium">
        <Timer className="h-4 w-4 text-primary" />
        一緒に{arg}分集中しよう
      </div>
      <Link
        to="/timer"
        className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
      >
        タイマーを開く
      </Link>
    </div>
  );
}

/**
 * 入力中表示（Realtime Broadcast・DB書き込みなし）
 * channelKey は会話ごとに両者で同じになる文字列。
 */
export function useTypingIndicator(channelKey: string, userId: string, myName: string) {
  const [typers, setTypers] = useState<Record<string, { name: string; at: number }>>({});
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    const ch = supabase.channel(`typing-${channelKey}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      const p = payload as { uid: string; name: string; stop?: boolean };
      if (!p?.uid || p.uid === userId) return;
      setTypers((prev) => {
        const next = { ...prev };
        if (p.stop) delete next[p.uid];
        else next[p.uid] = { name: p.name, at: Date.now() };
        return next;
      });
    }).subscribe();
    chRef.current = ch;
    const t = setInterval(() => {
      setTypers((prev) => {
        const now = Date.now();
        const keys = Object.keys(prev).filter((k) => now - prev[k].at > 4000);
        if (keys.length === 0) return prev;
        const next = { ...prev };
        keys.forEach((k) => delete next[k]);
        return next;
      });
    }, 1500);
    return () => {
      clearInterval(t);
      supabase.removeChannel(ch);
      chRef.current = null;
      setTypers({});
    };
  }, [channelKey, userId]);

  const notify = (stop = false) => {
    const now = Date.now();
    if (!stop && now - lastSent.current < 2000) return;
    lastSent.current = stop ? 0 : now;
    chRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { uid: userId, name: myName, stop },
    });
  };

  const names = Object.values(typers).map((t) => t.name);
  return { names, notify };
}

export function TypingLine({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  const label =
    names.length === 1 ? `${names[0]}が入力中` : `${names.length}人が入力中`;
  return (
    <div className="px-4 pb-1 text-xs text-muted-foreground flex items-center gap-1" aria-live="polite">
      <span className="inline-flex gap-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
      </span>
      {label}...
    </div>
  );
}
