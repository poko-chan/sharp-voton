import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { ClassFilesPanel } from "@/components/ClassFilesPanel";
import { useMyClassPermissions } from "@/components/ClassPermissionsPanel";
import { fetchPublicProfiles } from "@/lib/public-profiles";

export function StudentLogs({ members }: { members: any[] }) {
  const [logs, setLogs] = useState<Record<string, any[]>>({});
  useEffect(() => {
    (async () => {
      const ids = members.map((m) => m.user_id);
      if (ids.length === 0) return;
      const { data } = await supabase.from("study_logs")
        .select("user_id, date, duration_minutes, content, subjects(name, color)")
        .in("user_id", ids).order("date", { ascending: false }).limit(500);
      const map: Record<string, any[]> = {};
      (data ?? []).forEach((l: any) => { (map[l.user_id] ||= []).push(l); });
      setLogs(map);
    })();
  }, [members]);
  return (
    <div className="space-y-3">
      {members.map((m) => {
        const items = logs[m.user_id] ?? [];
        const total = items.reduce((s, l) => s + (l.duration_minutes ?? 0), 0);
        return (
          <Card key={m.user_id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{m.profile?.display_name ?? m.profile?.username ?? "?"}</div>
              <div className="text-xs text-muted-foreground">合計 {Math.floor(total / 60)}h {total % 60}m / {items.length}件</div>
            </div>
            <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
              {items.slice(0, 30).map((l, i) => (
                <div key={i} className="text-xs flex items-center gap-2 p-1.5 rounded hover:bg-muted/30">
                  <span className="text-muted-foreground w-20">{l.date}</span>
                  {l.subjects && <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: l.subjects.color + "33", color: l.subjects.color }}>{l.subjects.name}</span>}
                  <span className="font-medium">{l.duration_minutes}分</span>
                  {l.content && <span className="text-muted-foreground truncate">{l.content}</span>}
                </div>
              ))}
              {items.length === 0 && <p className="text-xs text-muted-foreground">記録なし</p>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function FilesTab({ classId, isTeacher, userId }: { classId: string; isTeacher: boolean; userId: string | undefined }) {
  const perm = useMyClassPermissions(classId, userId, isTeacher);
  return <ClassFilesPanel classId={classId} isTeacher={isTeacher} canUpload={isTeacher || perm.can_upload_files} />;
}

export function ClassChatTab({ classId, userId }: { classId: string; userId?: string }) {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase.from("class_chat_messages").select("*").eq("class_id", classId).order("created_at").limit(200);
    const rows = data ?? [];
    setMsgs(rows);
    const ids = Array.from(new Set(rows.map((m: any) => m.sender_id)));
    if (ids.length) {
      const profs = await fetchPublicProfiles(ids);
      setProfiles(Object.fromEntries(profs.map((p) => [p.id, p])));
    }
  };
  useEffect(() => { load(); }, [classId]);
  useEffect(() => {
    const ch = supabase.channel(`cc-${classId}`).on("postgres_changes", { event: "*", schema: "public", table: "class_chat_messages", filter: `class_id=eq.${classId}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [classId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    if (!text.trim() || !userId) return;
    const { error } = await supabase.from("class_chat_messages").insert({ class_id: classId, sender_id: userId, body: text.trim() });
    if (error) return toast.error(error.message);
    setText("");
  };

  return (
    <Card className="flex flex-col h-[60vh]">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {msgs.filter((m) => !m.deleted_at).map((m) => {
          const p = profiles[m.sender_id];
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {!mine && <div className="text-[10px] opacity-70 mb-0.5">{p?.display_name ?? p?.username ?? "?"}</div>}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className="text-[9px] opacity-60 mt-0.5">{new Date(m.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            </div>
          );
        })}
        {msgs.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">まだメッセージはありません</div>}
        <div ref={endRef} />
      </div>
      <div className="border-t p-2 flex gap-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="メッセージを入力..." rows={2} className="flex-1 resize-none" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <Button onClick={send} disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
}
