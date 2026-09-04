import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Check, X, Reply, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { jstDateStr, jstDayLabel } from "@/lib/date";
import { sendDm, setReplyTo, fetchReactions, toggleReaction, type DmMessage } from "@/lib/chat.functions";
import { ReactionBar, ReactionPicker } from "./MessageReactions";
import { ChatComposer, ChatSearchBar } from "./ChatComposer";
import { playSendSound } from "@/lib/chat-sound";
import { useLocalPrefs } from "@/lib/user-prefs";

export function DmChatPanel({
  userId,
  partnerId,
  partnerName,
  headerExtra,
}: {
  userId: string;
  partnerId: string;
  partnerName: string;
  headerExtra?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [replyTo, setReplyToMsg] = useState<DmMessage | null>(null);
  const [query, setQuery] = useState("");
  const { prefs } = useLocalPrefs();

  const messages = useQuery({
    queryKey: ["chat-dm", partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .or(`and(sender_id.eq.${userId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${userId})`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DmMessage[];
    },
  });

  const msgIds = useMemo(() => (messages.data ?? []).map((m) => m.id), [messages.data]);
  const reactions = useQuery({
    queryKey: ["chat-dm-reactions", partnerId, msgIds.length],
    queryFn: () => fetchReactions("dm", msgIds),
    enabled: msgIds.length > 0,
  });
  const byId = useMemo(() => new Map((messages.data ?? []).map((m) => [m.id, m])), [messages.data]);

  const onToggleReaction = async (id: string, emoji: string) => {
    try {
      await toggleReaction("dm", id, emoji, userId);
      qc.invalidateQueries({ queryKey: ["chat-dm-reactions", partnerId] });
      reactions.refetch();
    } catch (e: any) { toast.error(e.message ?? "リアクションに失敗しました"); }
  };

  useEffect(() => {
    const ch = supabase
      .channel(`chat-dm-${partnerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, (payload) => {
        const m = (payload.new ?? payload.old) as DmMessage;
        if (
          (m.sender_id === userId && m.recipient_id === partnerId) ||
          (m.sender_id === partnerId && m.recipient_id === userId)
        ) {
          qc.invalidateQueries({ queryKey: ["chat-dm", partnerId] });
          qc.invalidateQueries({ queryKey: ["chat-conversations"] });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reactions" }, () => {
        reactions.refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, partnerId, qc]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.data]);

  useEffect(() => {
    if (!messages.data) return;
    const unread = messages.data.filter((m) => m.recipient_id === userId && !m.read_at).map((m) => m.id);
    if (unread.length === 0) return;
    supabase.from("chat_messages").update({ read_at: new Date().toISOString() }).in("id", unread).then(() => {
      qc.invalidateQueries({ queryKey: ["chat-dm", partnerId] });
      qc.invalidateQueries({ queryKey: ["chat-conversations"] });
    });
  }, [messages.data, partnerId, userId, qc]);

  const startEdit = (m: DmMessage) => { setEditingId(m.id); setEditText(m.content); };
  const saveEdit = async () => {
    if (!editingId) return;
    const t = editText.trim();
    if (!t) return;
    const { error } = await supabase.from("chat_messages").update({ content: t, edited_at: new Date().toISOString() }).eq("id", editingId);
    if (error) toast.error(error.message);
    setEditingId(null); setEditText("");
    qc.invalidateQueries({ queryKey: ["chat-dm", partnerId] });
  };
  const removeMsg = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    const { error } = await supabase.from("chat_messages").update({ deleted_at: new Date().toISOString(), content: "（削除されました）" }).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["chat-dm", partnerId] });
  };

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    const replyId = replyTo?.id ?? null;
    setText(""); setReplyToMsg(null);
    try {
      const id = await sendDm(partnerId, t);
      if (prefs.chat_send_sound) playSendSound();
      if (replyId && id) await setReplyTo("dm", id, replyId).catch(() => {});
      qc.invalidateQueries({ queryKey: ["chat-dm", partnerId] });
      qc.invalidateQueries({ queryKey: ["chat-conversations"] });
    } catch (e: any) {
      toast.error(e.message ?? "送信に失敗しました");
      setText(t);
    }
  };

  return (
    <>
      <div className="border-b p-3 font-medium flex items-center gap-2">
        <span className="truncate flex-1 min-w-0">{partnerName}</span>
        <ChatSearchBar value={query} onChange={setQuery} />
        {headerExtra}
      </div>
      <div className={`flex-1 overflow-y-auto p-4 ${prefs.chat_compact ? "space-y-0.5" : "space-y-2"}`} style={{ fontSize: `${Math.round(14 * prefs.chat_font_scale)}px` }}>
        {(() => {
          let lastDay = "";
          const list = (messages.data ?? []).filter((m) => !query.trim() || m.content?.toLowerCase().includes(query.trim().toLowerCase()));
          return list.flatMap((m) => {
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
            const mine = m.sender_id === userId;
            const isDeleted = !!m.deleted_at;
            const isEditing = editingId === m.id;
            const parent = (m as any).reply_to_id ? byId.get((m as any).reply_to_id as string) : null;
            nodes.push(
              <div key={m.id} className={`flex group ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] sm:max-w-[70%] space-y-0.5 ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  <Card className={`px-3 py-2 ${mine ? "!bg-primary !text-primary-foreground border-primary" : ""} ${isDeleted ? "opacity-60 italic" : ""}`}>
                    {parent && (
                      <div className={`mb-1 border-l-2 pl-2 text-[11px] line-clamp-2 ${mine ? "border-primary-foreground/60 opacity-80" : "border-muted-foreground/40 text-muted-foreground"}`}>
                        {parent.sender_id === userId ? "自分" : partnerName}: {parent.content}
                      </div>
                    )}
                    {isEditing ? (
                      <div className="flex gap-1 items-center min-w-[160px] sm:min-w-[200px]">
                        <Input
                          autoFocus value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                          className="h-8 text-sm bg-background text-foreground"
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}><Check className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <div className="flex items-end gap-2">
                        <span className="text-[1em] leading-relaxed whitespace-pre-wrap break-words">{m.content}</span>
                        {!isDeleted && (
                          <div className="flex gap-1.5 shrink-0 items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <ReactionPicker onPick={(e) => onToggleReaction(m.id, e)} />
                            <button onClick={() => setReplyToMsg(m)} className="opacity-70 hover:opacity-100" aria-label="返信"><Reply className="h-3.5 w-3.5" /></button>
                            <button onClick={() => { navigator.clipboard?.writeText(m.content); toast.success("コピーしました"); }} className="opacity-70 hover:opacity-100" aria-label="コピー"><Copy className="h-3 w-3" /></button>
                            {mine && <>
                              <button onClick={() => startEdit(m)} className="opacity-70 hover:opacity-100" aria-label="編集"><Pencil className="h-3 w-3" /></button>
                              <button onClick={() => removeMsg(m.id)} className="opacity-70 hover:opacity-100" aria-label="削除"><Trash2 className="h-3 w-3" /></button>
                            </>}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                  <ReactionBar reactions={reactions.data ?? []} messageId={m.id} scope="dm" userId={userId} onToggle={(e) => onToggleReaction(m.id, e)} />
                  <span className="text-[10px] text-muted-foreground px-1 flex items-center gap-1">
                    {mine && !isDeleted && (
                      <span className={m.read_at ? "text-primary font-medium" : "opacity-60"}>
                        {m.read_at ? "既読" : "未読"}
                      </span>
                    )}
                    {prefs.chat_show_time && new Date(m.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                    {m.edited_at && !isDeleted ? " (編集済み)" : ""}
                  </span>

                </div>
              </div>
            );
            return nodes;
          });
        })()}
        <div ref={endRef} />
      </div>
      {replyTo && (
        <div className="border-t px-3 py-2 flex items-center gap-2 bg-muted/50">
          <Reply className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate flex-1">
            {replyTo.sender_id === userId ? "自分" : partnerName} に返信: {replyTo.content}
          </span>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setReplyToMsg(null)} aria-label="返信をやめる"><X className="h-3.5 w-3.5" /></Button>
        </div>
      )}
      <ChatComposer value={text} onChange={setText} onSend={send} />
    </>
  );
}
