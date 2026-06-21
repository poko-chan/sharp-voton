import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessagesSquare, Send, Pencil, Trash2, Check, CheckCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { levelFromMinutes } from "@/lib/level";
import { localDateStr, jstDateStr, jstDayLabel } from "@/lib/date";

type Msg = { id: string; sender_id: string; recipient_id: string; content: string; created_at: string; edited_at: string | null; read_at: string | null; deleted_at: string | null };
type Profile = { id: string; display_name: string | null; email: string | null };

function ChatPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const profiles = useQuery({
    queryKey: ["profiles", "all"],
    queryFn: async () => {
      // 相互フォロー（フレンド）のみと会話できる
      const { data: f1, error: e1 } = await supabase
        .from("follows").select("following_id").eq("follower_id", user!.id).eq("status", "accepted");
      if (e1) throw e1;
      const { data: f2, error: e2 } = await supabase
        .from("follows").select("follower_id").eq("following_id", user!.id).eq("status", "accepted");
      if (e2) throw e2;
      const out = (f1 ?? []).map((r: any) => r.following_id);
      const incSet = new Set((f2 ?? []).map((r: any) => r.follower_id));
      const friendIds = out.filter((id) => incSet.has(id));
      if (friendIds.length === 0) return [] as Profile[];
      const { data, error } = await supabase
        .from("profiles").select("id, display_name, email")
        .in("id", friendIds).order("display_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: !!user,
  });

  const ranks = useQuery({
    queryKey: ["user-ranks", profiles.data?.map((p) => p.id).join(",")],
    queryFn: async () => {
      const ids = (profiles.data ?? []).map((p) => p.id);
      if (ids.length === 0) return {} as Record<string, number>;
      const { data, error } = await supabase.rpc("get_user_study_stats", { _user_ids: ids });
      if (error) throw error;
      const today = localDateStr();
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        const days = r.last_date
          ? Math.floor((new Date(today + "T00:00:00").getTime() - new Date(r.last_date + "T00:00:00").getTime()) / 86400000)
          : 999;
        map[r.user_id] = levelFromMinutes(r.total_minutes ?? 0, days);
      });
      return map;
    },
    enabled: !!profiles.data && profiles.data.length > 0,
  });

  const rankOf = (id: string): number => ranks.data?.[id] ?? 1;

  const messages = useQuery({
    queryKey: ["chat", partnerId],
    queryFn: async () => {
      if (!partnerId || !user) return [] as Msg[];
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
    enabled: !!partnerId && !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("chat-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, (payload) => {
        const m = (payload.new ?? payload.old) as Msg;
        if (
          partnerId &&
          ((m.sender_id === user.id && m.recipient_id === partnerId) ||
            (m.sender_id === partnerId && m.recipient_id === user.id))
        ) {
          qc.invalidateQueries({ queryKey: ["chat", partnerId] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, partnerId, qc]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.data]);

  // Mark partner messages as read when viewing.
  useEffect(() => {
    if (!partnerId || !user || !messages.data) return;
    const unread = messages.data.filter((m) => m.recipient_id === user.id && !m.read_at).map((m) => m.id);
    if (unread.length === 0) return;
    supabase.from("chat_messages").update({ read_at: new Date().toISOString() }).in("id", unread).then(() => {
      qc.invalidateQueries({ queryKey: ["chat", partnerId] });
    });
  }, [messages.data, partnerId, user, qc]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const startEdit = (m: Msg) => { setEditingId(m.id); setEditText(m.content); };
  const saveEdit = async () => {
    if (!editingId) return;
    const t = editText.trim();
    if (!t) return;
    const { error } = await supabase.from("chat_messages").update({ content: t, edited_at: new Date().toISOString() }).eq("id", editingId);
    if (error) toast.error(error.message);
    setEditingId(null); setEditText("");
    qc.invalidateQueries({ queryKey: ["chat", partnerId] });
  };
  const removeMsg = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    const { error } = await supabase.from("chat_messages").update({ deleted_at: new Date().toISOString(), content: "（削除されました）" }).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["chat", partnerId] });
  };

  const send = async () => {
    const t = text.trim();
    if (!t || !partnerId || !user) return;
    setText("");
    // フレンドのみ送信できる RPC を経由
    const { error } = await (supabase as any).rpc("send_dm", { _to: partnerId, _content: t });
    if (error) { toast.error(error.message); setText(t); return; }
    qc.invalidateQueries({ queryKey: ["chat", partnerId] });
  };

  const partner = useMemo(() => profiles.data?.find((p) => p.id === partnerId), [profiles.data, partnerId]);

  return (
    <div className="flex h-[calc(100vh-0px)]">
      <aside className="w-72 border-r bg-card overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2"><MessagesSquare className="h-5 w-5" />ユーザー</h2>
        </div>
        <div className="p-2 space-y-1">
          {profiles.data?.map((p) => (
            <button
              key={p.id}
              onClick={() => setPartnerId(p.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${partnerId === p.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <div className="font-medium flex items-center gap-1.5">
                <span className="truncate">{p.display_name ?? "(no name)"}</span>
                <RankBadge level={rankOf(p.id)} active={partnerId === p.id} />
              </div>
              <div className="text-xs opacity-70 truncate">{p.email}</div>
            </button>
          ))}
          {profiles.data?.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">他のユーザーがいません</p>}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        {!partner ? (
          <div className="flex-1 grid place-items-center text-muted-foreground text-sm">
            左側からチャット相手を選んでください
          </div>
        ) : (
          <>
            <div className="border-b p-3 font-medium flex items-center gap-2">
              <span>{partner.display_name ?? partner.email}</span>
              <RankBadge level={rankOf(partner.id)} />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {(() => {
                let lastDay = "";
                return messages.data?.flatMap((m) => {
                  const day = jstDateStr(new Date(m.created_at));
                  const nodes: React.ReactNode[] = [];
                  if (day !== lastDay) {
                    lastDay = day;
                    nodes.push(
                      <div key={`d-${day}-${m.id}`} className="flex justify-center my-2">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                          {jstDayLabel(m.created_at)}
                        </span>
                      </div>
                    );
                  }
                  return nodes.concat(renderMessage(m));
                });
                function renderMessage(m: Msg) {
                const mine = m.sender_id === user?.id;
                const isDeleted = !!m.deleted_at;
                const isEditing = editingId === m.id;
                return (
                  <div key={m.id} className={`flex group ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] space-y-0.5 ${mine ? "items-end" : "items-start"} flex flex-col`}>
                      <Card className={`px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : ""} ${isDeleted ? "opacity-60 italic" : ""}`}>
                        {isEditing ? (
                          <div className="flex gap-1 items-center min-w-[200px]">
                            <Input
                              autoFocus value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                              className="h-8 text-sm bg-background text-foreground"
                            />
                            <button onClick={saveEdit} className="p-1 hover:opacity-70"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1 hover:opacity-70"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                        )}
                      </Card>
                      <div className={`flex items-center gap-1.5 text-[10px] text-muted-foreground px-1 ${mine ? "flex-row-reverse" : ""}`}>
                        <span>{new Date(m.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</span>
                        {m.edited_at && !isDeleted && <span>(編集済み)</span>}
                        {mine && !isDeleted && (
                          m.read_at
                            ? <span className="flex items-center gap-0.5 text-primary"><CheckCheck className="h-3 w-3" />既読</span>
                            : <span className="flex items-center gap-0.5"><Check className="h-3 w-3" />送信</span>
                        )}
                        {mine && !isDeleted && !isEditing && (
                          <>
                            <button onClick={() => startEdit(m)} className="opacity-0 group-hover:opacity-100 transition hover:text-foreground" title="編集"><Pencil className="h-3 w-3" /></button>
                            <button onClick={() => removeMsg(m.id)} className="opacity-0 group-hover:opacity-100 transition hover:text-destructive" title="削除"><Trash2 className="h-3 w-3" /></button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
                }
              })()}
              <div ref={endRef} />
            </div>
            <form className="border-t p-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="メッセージを入力…" />
              <Button type="submit" disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

function RankBadge({ level, active }: { level: number; active?: boolean }) {
  return (
    <span
      title={`レベル ${level}`}
      className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
        active
          ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30"
          : "bg-primary/10 text-primary border-primary/30"
      }`}
    >
      Lv{level}
    </span>
  );
}

export const Route = createFileRoute("/_authenticated/chat")({ component: ChatPage });
