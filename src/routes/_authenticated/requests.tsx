import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Send, ArrowLeft, Megaphone, Sparkles, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { jstDayLabel, jstFormat, jstDateStr } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/requests")({ component: RequestsPage });

type Cat = { id: string; name: string; description: string | null; sort_order: number; is_active: boolean };
type Thread = { id: string; user_id: string; category_id: string | null; title: string; status: string; last_message_at: string; created_at: string };
type Msg = { id: string; thread_id: string; sender_id: string; is_admin: boolean; content: string; created_at: string };

function RequestsPage() {
  const { user, isAdmin } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);

  const cats = useQuery({
    queryKey: ["arc-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("admin_request_categories")
        .select("*").order("sort_order");
      if (error) throw error;
      return data as Cat[];
    },
  });

  const threads = useQuery({
    queryKey: ["arc-threads", isAdmin],
    queryFn: async () => {
      let q = (supabase as any).from("admin_request_threads").select("*").order("last_message_at", { ascending: false });
      if (!isAdmin) q = q.eq("user_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Thread[];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  return (
    <div className="container mx-auto max-w-6xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            {isAdmin ? "ユーザー要望（管理者ビュー）" : "管理者への要望・お願い"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isAdmin
              ? "ユーザーから届いた要望スレッドに返信できます。フィードバックダッシュボードとは別チャネルです。"
              : "カテゴリを選んで管理者と1対1のチャットができます。"}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && <CategoryManageDialog onChanged={() => cats.refetch()} />}
          {!isAdmin && <NewThreadDialog cats={cats.data ?? []} onCreated={(id) => { setActiveId(id); threads.refetch(); }} />}
        </div>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-3">
        <Card className="p-2 max-h-[70vh] overflow-auto">
          {(threads.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground p-3 text-center">スレッドがありません</p>
          )}
          {(threads.data ?? []).map((t) => {
            const cat = (cats.data ?? []).find((c) => c.id === t.category_id);
            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={`w-full text-left p-2 rounded-md text-sm transition ${
                  activeId === t.id ? "bg-primary/15 border border-primary/30" : "hover:bg-muted/60"
                }`}
              >
                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-muted">{cat?.name ?? "—"}</span>
                  <span>{jstFormat(t.last_message_at, { year: undefined, hour: "2-digit", minute: "2-digit", month: "2-digit", day: "2-digit" })}</span>
                </div>
                <div className="font-medium truncate">{t.title}</div>
              </button>
            );
          })}
        </Card>

        {activeId ? (
          <ThreadView id={activeId} isAdmin={isAdmin} onBack={() => setActiveId(null)} />
        ) : (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary/60" />
            スレッドを選択してください
          </Card>
        )}
      </div>
    </div>
  );
}

function NewThreadDialog({ cats, onCreated }: { cats: Cat[]; onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [catId, setCatId] = useState<string>(cats[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!catId && cats[0]) setCatId(cats[0].id); }, [cats, catId]);

  const submit = async () => {
    if (!user) return;
    if (!title.trim() || !body.trim() || !catId) return toast.error("カテゴリ・件名・本文を入力してください");
    setBusy(true);
    try {
      const { data: t, error } = await (supabase as any).from("admin_request_threads")
        .insert({ user_id: user.id, category_id: catId, title: title.trim() })
        .select("id").single();
      if (error) throw error;
      const { error: e2 } = await (supabase as any).from("admin_request_messages")
        .insert({ thread_id: t.id, sender_id: user.id, is_admin: false, content: body.trim() });
      if (e2) throw e2;
      toast.success("送信しました");
      setOpen(false); setTitle(""); setBody("");
      onCreated(t.id);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />新規スレッド</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>管理者への要望</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs">カテゴリ</label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs">件名</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
          </div>
          <div>
            <label className="text-xs">内容</label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={4000} />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full">送信</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryManageDialog({ onChanged }: { onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const cats = useQuery({
    queryKey: ["arc-categories-admin", open],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("admin_request_categories").select("*").order("sort_order");
      if (error) throw error;
      return data as Cat[];
    },
    enabled: open,
  });

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await (supabase as any).from("admin_request_categories")
      .insert({ name: name.trim(), description: desc.trim() || null });
    if (error) return toast.error(error.message);
    setName(""); setDesc(""); cats.refetch(); onChanged();
    toast.success("追加しました");
  };
  const toggle = async (c: Cat) => {
    await (supabase as any).from("admin_request_categories").update({ is_active: !c.is_active }).eq("id", c.id);
    cats.refetch(); onChanged();
  };
  const remove = async (c: Cat) => {
    if (!confirm(`「${c.name}」を削除しますか？`)) return;
    const { error } = await (supabase as any).from("admin_request_categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    cats.refetch(); onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Settings2 className="h-4 w-4 mr-1" />カテゴリ管理</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>カテゴリ管理</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="カテゴリ名" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="説明（任意）" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <Button onClick={add}>追加</Button>
          </div>
          <div className="space-y-1 max-h-72 overflow-auto">
            {(cats.data ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-sm p-2 rounded border">
                <div className="flex-1">
                  <div className="font-medium">{c.name}</div>
                  {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => toggle(c)}>{c.is_active ? "無効化" : "有効化"}</Button>
                <Button variant="ghost" size="sm" onClick={() => remove(c)} className="text-destructive">削除</Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ThreadView({ id, isAdmin, onBack }: { id: string; isAdmin: boolean; onBack: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const msgs = useQuery({
    queryKey: ["arc-msgs", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("admin_request_messages")
        .select("*").eq("thread_id", id).order("created_at");
      if (error) throw error;
      return data as Msg[];
    },
    refetchInterval: 5000,
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.data]);

  const send = async () => {
    const t = text.trim();
    if (!t || !user) return;
    setText("");
    const { error } = await (supabase as any).from("admin_request_messages")
      .insert({ thread_id: id, sender_id: user.id, is_admin: isAdmin, content: t });
    if (error) { toast.error(error.message); setText(t); return; }
    qc.invalidateQueries({ queryKey: ["arc-msgs", id] });
    qc.invalidateQueries({ queryKey: ["arc-threads"] });
  };

  let lastDay = "";
  return (
    <Card className="flex flex-col h-[70vh]">
      <div className="border-b p-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden"><ArrowLeft className="h-4 w-4" /></Button>
        <div className="text-sm font-medium">スレッド</div>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2 bg-muted/10">
        {(msgs.data ?? []).map((m) => {
          const day = jstDateStr(new Date(m.created_at));
          const dayDivider = day !== lastDay ? (
            <div key={`d-${m.id}`} className="flex justify-center my-2">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">{jstDayLabel(m.created_at)}</span>
            </div>
          ) : null;
          lastDay = day;
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id}>
              {dayDivider}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                  mine ? "bg-primary text-primary-foreground" : "bg-card border"
                }`}>
                  {m.is_admin && !mine && <div className="text-[10px] font-semibold text-primary mb-1">🛡 管理者</div>}
                  {m.content}
                  <div className={`text-[9px] mt-1 opacity-70 ${mine ? "text-right" : ""}`}>
                    {jstFormat(m.created_at, { year: undefined, month: undefined, day: undefined })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="p-2 border-t flex gap-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={1}
          className="resize-none min-h-[40px] max-h-32" placeholder="メッセージを入力…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
        <Button onClick={send} disabled={!text.trim()} size="icon"><Send className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
}