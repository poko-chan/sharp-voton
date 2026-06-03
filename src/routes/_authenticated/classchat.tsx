import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, GraduationCap, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/classchat")({
  component: ClassChatPage,
});

type ClassInfo = { id: string; name: string };
type Msg = {
  id: string;
  class_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  edited_at: string | null;
};
type Profile = { id: string; display_name: string | null; username: string | null; avatar_url: string | null };

function ClassChatPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: owned } = await supabase.from("classes").select("id, name").eq("owner_id", user.id);
      const { data: mem } = await supabase.from("class_members").select("class_id, classes(id, name)").eq("user_id", user.id);
      const all: ClassInfo[] = [
        ...(owned ?? []),
        ...((mem ?? []).map((m: any) => m.classes).filter(Boolean) as ClassInfo[]),
      ];
      const uniq = Array.from(new Map(all.map((c) => [c.id, c])).values());
      setClasses(uniq);
      if (uniq.length && !classId) setClassId(uniq[0].id);
    })();
  }, [user]);

  const loadMessages = async (cid: string) => {
    const { data } = await supabase
      .from("class_chat_messages")
      .select("*")
      .eq("class_id", cid)
      .order("created_at", { ascending: true })
      .limit(500);
    const list = (data as Msg[]) ?? [];
    setMsgs(list);
    const ids = Array.from(new Set(list.map((m) => m.sender_id)));
    if (ids.length) {
      const { data: pf } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", ids);
      const map: Record<string, Profile> = {};
      (pf ?? []).forEach((p: Profile) => (map[p.id] = p));
      setProfiles(map);
    }
  };

  useEffect(() => {
    if (!classId) return;
    loadMessages(classId);
    const ch = supabase
      .channel(`classchat-${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_chat_messages", filter: `class_id=eq.${classId}` },
        () => loadMessages(classId),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [classId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    if (!user || !classId || !text.trim()) return;
    const body = text.trim().slice(0, 2000);
    setText("");
    const { error } = await supabase
      .from("class_chat_messages")
      .insert({ class_id: classId, sender_id: user.id, body });
    if (error) toast.error(error.message);
  };

  const del = async (id: string) => {
    const { error } = await supabase
      .from("class_chat_messages")
      .update({ deleted_at: new Date().toISOString(), body: "(削除済み)" })
      .eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">
        <GraduationCap /> クラスチャット
      </h1>
      {classes.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">参加中のクラスがありません</Card>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 md:col-span-3 p-3 space-y-1">
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => setClassId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                  classId === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {c.name}
              </button>
            ))}
          </Card>
          <Card className="col-span-12 md:col-span-9 p-0 flex flex-col h-[70vh]">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msgs.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">まだメッセージがありません</p>
              )}
              {msgs.map((m) => {
                const p = profiles[m.sender_id];
                const own = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${own ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <div className="text-[10px] opacity-70 flex items-center gap-2">
                        <span>{p?.display_name ?? p?.username ?? "?"}</span>
                        <span>{new Date(m.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                      {own && !m.deleted_at && (
                        <button onClick={() => del(m.id)} className="text-[10px] opacity-70 hover:opacity-100 mt-1">
                          <Trash2 className="h-3 w-3 inline" /> 削除
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <div className="border-t p-3 flex gap-2">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="メッセージを入力 (Enter: 送信 / Shift+Enter: 改行)"
                className="min-h-[44px] max-h-32 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <Button onClick={send} disabled={!text.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
