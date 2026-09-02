import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Check, X, Users, Reply, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { jstDateStr, jstDayLabel } from "@/lib/date";
import {
  sendGroupMessage,
  markGroupRead,
  fetchProfilesByIds,
  fetchGroupMembers,
  type GroupMessage,
  type GroupMember,
  setReplyTo,
  fetchReactions,
  toggleReaction,
  type Profile,
} from "@/lib/chat.functions";
import { ReactionBar, ReactionPicker } from "./MessageReactions";
import { ChatComposer, ChatSearchBar } from "./ChatComposer";
import { useLocalPrefs } from "@/lib/user-prefs";


export function GroupChatPanel({
  userId,
  groupId,
  groupName,
  memberCount,
  onOpenMembers,
}: {
  userId: string;
  groupId: string;
  groupName: string;
  memberCount: number;
  onOpenMembers: () => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [replyTo, setReplyToMsg] = useState<GroupMessage | null>(null);
  const [query, setQuery] = useState("");
  const { prefs } = useLocalPrefs();

  const messages = useQuery({
    queryKey: ["chat-group-msgs", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_group_messages")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GroupMessage[];
    },
  });

  const senderIds = Array.from(new Set((messages.data ?? []).map((m) => m.sender_id)));
  const profiles = useQuery({
    queryKey: ["chat-group-senders", groupId, senderIds.join(",")],
    queryFn: () => fetchProfilesByIds(senderIds),
    enabled: senderIds.length > 0,
  });
  const nameOf = (id: string) => {
    if (id === userId) return "自分";
    const p = profiles.data?.find((x) => x.id === id);
    return p?.display_name ?? p?.username ?? "不明";
  };

  // 既読管理: メンバーの last_read_at からメッセージごとの既読人数を計算
  const readers = useQuery({
    queryKey: ["chat-group-reads", groupId],
    queryFn: () => fetchGroupMembers(groupId),
    refetchInterval: 20000,
  });
  const readCount = (m: GroupMessage) =>
    (readers.data ?? []).filter(
      (r: GroupMember) => r.user_id !== m.sender_id && r.last_read_at && new Date(r.last_read_at) >= new Date(m.created_at),
    ).length;

  const msgIds = useMemo(() => (messages.data ?? []).map((m) => m.id), [messages.data]);
  const byId = useMemo(() => new Map((messages.data ?? []).map((m) => [m.id, m])), [messages.data]);
  const reactions = useQuery({
    queryKey: ["chat-group-reactions", groupId, msgIds.length],
    queryFn: () => fetchReactions("group", msgIds),
    enabled: msgIds.length > 0,
  });
  const onToggleReaction = async (id: string, emoji: string) => {
    try {
      await toggleReaction("group", id, emoji, userId);
      reactions.refetch();
    } catch (e: any) { toast.error(e.message ?? "リアクションに失敗しました"); }
  };


  useEffect(() => {

    const ch = supabase
      .channel(`chat-group-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_group_messages", filter: `group_id=eq.${groupId}` }, () => {
        qc.invalidateQueries({ queryKey: ["chat-group-msgs", groupId] });
        qc.invalidateQueries({ queryKey: ["chat-conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reactions" }, () => { reactions.refetch(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [groupId, qc]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.data]);

  useEffect(() => {
    markGroupRead(groupId).then(() => {
      qc.invalidateQueries({ queryKey: ["chat-conversations"] });
    }).catch(() => {});
  }, [groupId, qc]);

  const startEdit = (m: GroupMessage) => { setEditingId(m.id); setEditText(m.content); };
  const saveEdit = async () => {
    if (!editingId) return;
    const t = editText.trim();
    if (!t) return;
    const { error } = await supabase.from("chat_group_messages").update({ content: t, edited_at: new Date().toISOString() }).eq("id", editingId);
    if (error) toast.error(error.message);
    setEditingId(null); setEditText("");
    qc.invalidateQueries({ queryKey: ["chat-group-msgs", groupId] });
  };
  const removeMsg = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    const { error } = await supabase.from("chat_group_messages").update({ deleted_at: new Date().toISOString(), content: "（削除されました）" }).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["chat-group-msgs", groupId] });
  };

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    const replyId = replyTo?.id ?? null;
    setText(""); setReplyToMsg(null);
    try {
      const newId = await sendGroupMessage(groupId, t);
      if (replyId && newId) await setReplyTo("group", newId, replyId).catch(() => {});
      qc.invalidateQueries({ queryKey: ["chat-group-msgs", groupId] });
      qc.invalidateQueries({ queryKey: ["chat-conversations"] });
    } catch (e: any) {
      toast.error(e.message ?? "送信に失敗しました");
      setText(t);
    }
  };

  return (
    <>
      <div className="border-b p-3 font-medium flex items-center justify-between gap-2">
        <span className="truncate flex items-center gap-1.5 flex-1 min-w-0"><Users className="h-4 w-4 shrink-0" />{groupName}</span>
        <ChatSearchBar value={query} onChange={setQuery} />
        <Button size="sm" variant="outline" onClick={onOpenMembers}>メンバー ({memberCount})</Button>
      </div>
      <div className={`flex-1 overflow-y-auto p-4 ${prefs.chat_compact ? "space-y-0.5" : "space-y-2"}`} style={{ fontSize: `${prefs.chat_font_scale}em` }}>
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
                  {!mine && <span className="text-[11px] text-muted-foreground px-1">{nameOf(m.sender_id)}</span>}
                  <Card className={`px-3 py-2 ${mine ? "!bg-primary !text-primary-foreground border-primary" : ""} ${isDeleted ? "opacity-60 italic" : ""}`}>
                    {parent && (
                      <div className={`mb-1 border-l-2 pl-2 text-[11px] line-clamp-2 ${mine ? "border-primary-foreground/60 opacity-80" : "border-muted-foreground/40 text-muted-foreground"}`}>
                        {nameOf(parent.sender_id)}: {parent.content}
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
                        <span className="text-sm whitespace-pre-wrap break-words">{m.content}</span>
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
                  <ReactionBar reactions={reactions.data ?? []} messageId={m.id} scope="group" userId={userId} onToggle={(e) => onToggleReaction(m.id, e)} />
                  <span className="text-[10px] text-muted-foreground px-1 flex items-center gap-1">
                    {mine && !isDeleted && readCount(m) > 0 && (
                      <span className="text-primary font-medium">既読 {readCount(m)}</span>
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
          <span className="text-xs text-muted-foreground truncate flex-1">{nameOf(replyTo.sender_id)} に返信: {replyTo.content}</span>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setReplyToMsg(null)} aria-label="返信をやめる"><X className="h-3.5 w-3.5" /></Button>
        </div>
      )}
      <ChatComposer value={text} onChange={setText} onSend={send} />
    </>
  );
}
