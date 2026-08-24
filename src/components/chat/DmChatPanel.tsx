import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Pencil, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { jstDateStr, jstDayLabel } from "@/lib/date";
import { sendDm, type DmMessage } from "@/lib/chat.functions";

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
    setText("");
    try {
      await sendDm(partnerId, t);
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
        <span className="truncate">{partnerName}</span>
        {headerExtra}
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
            const mine = m.sender_id === userId;
            const isDeleted = !!m.deleted_at;
            const isEditing = editingId === m.id;
            nodes.push(
              <div key={m.id} className={`flex group ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] sm:max-w-[70%] space-y-0.5 ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  <Card className={`px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : ""} ${isDeleted ? "opacity-60 italic" : ""}`}>
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
                        {mine && !isDeleted && (
                          <div className="hidden group-hover:flex gap-1 shrink-0">
                            <button onClick={() => startEdit(m)} className="opacity-70 hover:opacity-100"><Pencil className="h-3 w-3" /></button>
                            <button onClick={() => removeMsg(m.id)} className="opacity-70 hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                  <span className="text-[10px] text-muted-foreground px-1">
                    {new Date(m.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
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
      <div className="border-t p-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="メッセージを入力"
        />
        <Button onClick={send} size="icon"><Send className="h-4 w-4" /></Button>
      </div>
    </>
  );
}
