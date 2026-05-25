import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircleQuestion, Send, Plus, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  submitFeedback,
  listMyThreads,
  getThreadMessages,
  postThreadMessage,
  startThread,
  myThreadsUnreadCount,
} from "@/lib/feedback.functions";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = [
  { value: "bug", label: "🐛 バグ報告" },
  { value: "feature", label: "💡 機能要望" },
  { value: "question", label: "❓ 質問" },
  { value: "praise", label: "🎉 感想・お褒め" },
  { value: "other", label: "📝 その他" },
];

const CAT_LABEL: Record<string, string> = {
  bug: "🐛 バグ", feature: "💡 要望", question: "❓ 質問", praise: "🎉 感想", other: "📝 その他",
};

export function FeedbackWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const unreadFn = useServerFn(myThreadsUnreadCount);

  // Only fetch unread count when logged in
  const { data: unread } = useQuery({
    queryKey: ["feedback-unread"],
    queryFn: () => unreadFn(),
    enabled: !!user,
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const count = unread?.count ?? 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          aria-label="フィードバック / サポート"
          className="fixed top-3 right-3 md:top-4 md:right-4 z-50 inline-flex items-center gap-1.5 rounded-full bg-primary/90 text-primary-foreground shadow-lg backdrop-blur-md px-3 py-2 text-sm hover:bg-primary transition border border-white/20"
        >
          <MessageCircleQuestion className="h-4 w-4" />
          <span className="hidden sm:inline">サポート</span>
          {count > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        {user ? <ChatPanel onClose={() => setOpen(false)} /> : <AnonymousFeedback onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Logged-in: full chat with admin ---------- */

function ChatPanel({ onClose: _onClose }: { onClose: () => void }) {
  const [view, setView] = useState<"list" | "new" | "thread">("list");
  const [activeId, setActiveId] = useState<string | null>(null);

  if (view === "thread" && activeId) {
    return <ThreadView id={activeId} onBack={() => { setView("list"); setActiveId(null); }} />;
  }
  if (view === "new") {
    return <NewThread onBack={() => setView("list")} onCreated={(id) => { setActiveId(id); setView("thread"); }} />;
  }
  return <ThreadList onOpen={(id) => { setActiveId(id); setView("thread"); }} onNew={() => setView("new")} />;
}

function ThreadList({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const list = useServerFn(listMyThreads);
  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["my-threads"],
    queryFn: () => list(),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  return (
    <div className="flex flex-col max-h-[80vh]">
      <DialogHeader className="px-5 pt-5 pb-3 border-b">
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          管理者とのサポートチャット
        </DialogTitle>
      </DialogHeader>
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {isLoading && <p className="text-xs text-muted-foreground p-4 text-center">読み込み中…</p>}
        {!isLoading && (threads as any[]).length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            まだやり取りはありません。<br />新しい話題を始めましょう。
          </div>
        )}
        {(threads as any[]).map((t) => (
          <button
            key={t.id}
            onClick={() => onOpen(t.id)}
            className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/40 transition flex gap-3 items-start"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{CAT_LABEL[t.category] ?? "📝"}</span>
                <span className="truncate">{new Date(t.created_at).toLocaleString("ja-JP")}</span>
              </div>
              <div className="text-sm mt-0.5 truncate font-medium">{t.latest?.body ?? t.body}</div>
            </div>
            {t.unread > 0 && (
              <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                {t.unread}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="p-3 border-t bg-muted/30">
        <Button onClick={onNew} className="w-full"><Plus className="h-4 w-4 mr-1" />新しい話題を始める</Button>
      </div>
    </div>
  );
}

function NewThread({ onBack, onCreated }: { onBack: () => void; onCreated: (id: string) => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const start = useServerFn(startThread);
  const qc = useQueryClient();
  const [category, setCategory] = useState("other");
  const [body, setBody] = useState("");
  const m = useMutation({
    mutationFn: () => start({ data: { category: category as any, body: body.trim(), route: path } }),
    onSuccess: (res: any) => {
      toast.success("送信しました");
      qc.invalidateQueries({ queryKey: ["my-threads"] });
      qc.invalidateQueries({ queryKey: ["feedback-unread"] });
      onCreated(res.feedbackId);
    },
    onError: (e: any) => toast.error(e.message ?? "送信に失敗しました"),
  });
  return (
    <div className="flex flex-col max-h-[80vh]">
      <DialogHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></button>
          <DialogTitle>新しい話題</DialogTitle>
        </div>
      </DialogHeader>
      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">カテゴリ</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">内容</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={4000} placeholder="お困りごと、ご要望、ご感想など…" />
          <div className="text-right text-[10px] text-muted-foreground">{body.length}/4000</div>
        </div>
        <Button onClick={() => m.mutate()} disabled={m.isPending || body.trim().length < 1} className="w-full">
          <Send className="h-4 w-4 mr-2" />送信して会話を開始
        </Button>
      </div>
    </div>
  );
}

function ThreadView({ id, onBack }: { id: string; onBack: () => void }) {
  const get = useServerFn(getThreadMessages);
  const post = useServerFn(postThreadMessage);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["thread", id],
    queryFn: () => get({ data: { feedbackId: id } }),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [data]);

  // Mark threads/unread caches stale after open
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["feedback-unread"] });
    qc.invalidateQueries({ queryKey: ["my-threads"] });
  }, [data, qc]);

  const m = useMutation({
    mutationFn: () => post({ data: { feedbackId: id, body: text.trim() } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["thread", id] });
      qc.invalidateQueries({ queryKey: ["my-threads"] });
    },
    onError: (e: any) => toast.error(e.message ?? "送信に失敗しました"),
  });

  return (
    <div className="flex flex-col max-h-[80vh] h-[80vh]">
      <DialogHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></button>
          <DialogTitle className="text-sm">{CAT_LABEL[data?.thread?.category ?? "other"]}</DialogTitle>
        </div>
      </DialogHeader>
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-2 bg-muted/20">
        {isLoading && <p className="text-xs text-muted-foreground text-center">読み込み中…</p>}
        {(data?.messages ?? []).map((m: any) => (
          <div key={m.id} className={`flex ${m.sender_role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                m.sender_role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-card border rounded-bl-sm"
              }`}
            >
              {m.sender_role === "admin" && (
                <div className="text-[10px] font-semibold text-primary mb-1">🛡 管理者</div>
              )}
              {m.body}
              <div className={`text-[9px] mt-1 opacity-70 ${m.sender_role === "user" ? "text-right" : ""}`}>
                {new Date(m.created_at).toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-2 border-t bg-background flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="メッセージを入力…"
          rows={1}
          className="resize-none min-h-[40px] max-h-32"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (text.trim().length >= 1) m.mutate();
            }
          }}
        />
        <Button onClick={() => m.mutate()} disabled={m.isPending || text.trim().length < 1} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Anonymous (logged-out) fallback ---------- */

function AnonymousFeedback({ onClose }: { onClose: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const submit = useServerFn(submitFeedback);
  const [category, setCategory] = useState("other");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (body.trim().length < 3) return toast.error("3文字以上で入力してください");
    setBusy(true);
    try {
      await submit({
        data: {
          email: email.trim() || null,
          category: category as any,
          body: body.trim(),
          route: path,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
          userId: null,
        },
      });
      toast.success("送信しました。ありがとうございます！");
      setBody(""); setEmail("");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "送信に失敗しました");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="p-5 space-y-3">
      <DialogHeader>
        <DialogTitle>フィードバックを送る</DialogTitle>
      </DialogHeader>
      <div className="space-y-1">
        <Label className="text-xs">カテゴリ</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">メール（返信希望の場合・任意）</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">内容</Label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={4000} />
      </div>
      <Button onClick={send} disabled={busy || body.trim().length < 3} className="w-full">
        <Send className="h-4 w-4 mr-2" />送信
      </Button>
    </div>
  );
}
