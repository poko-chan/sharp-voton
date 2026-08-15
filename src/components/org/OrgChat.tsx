import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Check, X, Ban, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { loadOrgProfiles, nameOf } from "@/lib/org-apps";

export function OrgChat({ orgId, ctx, moderateGroupId }: { orgId: string; ctx: any; moderateGroupId?: string }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<any[]>([]);
  const [parts, setParts] = useState<Record<string, any[]>>({});
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const load = async () => {
    let q = (supabase as any).from("org_chat_threads").select("*").eq("organization_id", orgId).order("updated_at", { ascending: false });
    if (moderateGroupId) q = q.eq("group_id", moderateGroupId);
    const { data: th, error } = await q;
    if (error) return toast.error(error.message);
    setThreads(th ?? []);
    const ids = (th ?? []).map((t: any) => t.id);
    if (ids.length) {
      const { data: p } = await (supabase as any).from("org_chat_participants").select("*").in("thread_id", ids);
      const map: Record<string, any[]> = {};
      for (const r of p ?? []) (map[r.thread_id] ??= []).push(r);
      setParts(map);
      setProfiles(await loadOrgProfiles(orgId, (p ?? []).map((r: any) => r.user_id)));
    } else setParts({});
    const { data: m } = await (supabase as any).from("organization_members").select("user_id, role").eq("organization_id", orgId);
    setMembers(m ?? []);
  };
  useEffect(() => { load(); }, [orgId, moderateGroupId]);

  const openThread = async (id: string) => {
    setActive(id);
    const { data } = await (supabase as any).from("org_chat_messages").select("*").eq("thread_id", id).order("created_at");
    setMessages(data ?? []);
    await (supabase as any).from("org_chat_participants").update({ last_read_at: new Date().toISOString() })
      .eq("thread_id", id).eq("user_id", user!.id);
  };

  const send = async () => {
    if (!text.trim() || !active) return;
    const { error } = await (supabase as any).from("org_chat_messages").insert({ thread_id: active, sender_id: user!.id, body: text.trim() });
    if (error) return toast.error("メッセージを送れません（承認待ち・権限をご確認ください）");
    setText(""); openThread(active);
  };

  const respond = async (threadId: string, accept: boolean) => {
    const { error } = await (supabase as any).from("org_chat_participants")
      .update({ status: accept ? "accepted" : "blocked" }).eq("thread_id", threadId).eq("user_id", user!.id);
    if (error) return toast.error(error.message);
    load();
  };

  const startDm = async (other: string) => {
    const { data, error } = await (supabase as any).rpc("org_start_dm", { _org: orgId, _other: other });
    if (error) return toast.error(error.message);
    toast.success("チャットを開始しました（相手の承認待ち）");
    setShowNew(false); await load(); openThread(data);
  };

  const title = (t: any) => {
    if (t.title) return t.title;
    const others = (parts[t.id] ?? []).filter((p) => p.user_id !== user?.id);
    return others.map((p) => nameOf(profiles[p.user_id])).join("、") || "チャット";
  };
  const myPart = (t: any) => (parts[t.id] ?? []).find((p) => p.user_id === user?.id);
  const readers = (t: any, at: string) => (parts[t.id] ?? []).filter((p) => p.user_id !== user?.id && p.last_read_at && p.last_read_at >= at).length;

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-3">
      <div className="space-y-2">
        {!moderateGroupId && (
          <Button size="sm" onClick={() => setShowNew(!showNew)}><Plus className="h-3 w-3 mr-1" />新しいチャット</Button>
        )}
        {showNew && (
          <Card className="p-2 space-y-1 max-h-64 overflow-auto">
            {members.filter((m) => m.user_id !== user?.id).map((m) => (
              <button key={m.user_id} className="w-full text-left text-sm p-1.5 rounded hover:bg-muted" onClick={() => startDm(m.user_id)}>
                {nameOf(profiles[m.user_id], m.user_id.slice(0, 8))}
              </button>
            ))}
          </Card>
        )}
        {threads.length === 0 && <Card className="p-4 text-xs text-muted-foreground">チャットはありません</Card>}
        {threads.map((t) => {
          const mp = myPart(t);
          return (
            <Card key={t.id} className={`p-2 space-y-1 ${active === t.id ? "border-primary" : ""}`}>
              <button className="text-sm font-medium text-left w-full flex items-center gap-1" onClick={() => openThread(t.id)}>
                {t.kind === "group" && <Users className="h-3 w-3" />}{title(t)}
              </button>
              {mp?.status === "pending" && (
                <div className="flex gap-1">
                  <Button size="sm" className="h-7" onClick={() => respond(t.id, true)}><Check className="h-3 w-3 mr-1" />承認</Button>
                  <Button size="sm" variant="outline" className="h-7" onClick={() => respond(t.id, false)}><X className="h-3 w-3 mr-1" />拒否</Button>
                </div>
              )}
              {!mp && <div className="text-[10px] text-muted-foreground">閲覧（管理）</div>}
            </Card>
          );
        })}
      </div>

      <Card className="p-3 min-h-[320px] flex flex-col">
        {!active && <div className="text-sm text-muted-foreground m-auto">チャットを選択してください</div>}
        {active && (
          <>
            <div className="flex-1 space-y-2 overflow-auto max-h-[50vh]">
              {messages.map((m) => (
                <div key={m.id} className={`text-sm ${m.sender_id === user?.id ? "text-right" : ""}`}>
                  <div className="text-[10px] text-muted-foreground">{nameOf(profiles[m.sender_id])} ・ {new Date(m.created_at).toLocaleTimeString("ja-JP")}
                    {m.edited_at && "（編集済み）"}
                    {m.sender_id === user?.id && readers(threads.find((t) => t.id === active), m.created_at) > 0 && " ・既読"}
                  </div>
                  {editing === m.id ? (
                    <div className="flex gap-1">
                      <Input value={editText} onChange={(e) => setEditText(e.target.value)} />
                      <Button size="sm" onClick={async () => {
                        await (supabase as any).from("org_chat_messages").update({ body: editText, edited_at: new Date().toISOString() }).eq("id", m.id);
                        setEditing(null); openThread(active);
                      }}>保存</Button>
                    </div>
                  ) : (
                    <div className={`inline-block rounded-lg px-3 py-1.5 ${m.sender_id === user?.id ? "bg-primary/15" : "bg-muted"}`}>
                      {m.deleted_at ? <span className="italic text-muted-foreground">削除されたメッセージ</span> : m.body}
                    </div>
                  )}
                  {m.sender_id === user?.id && !m.deleted_at && editing !== m.id && (
                    <div className="text-[10px] space-x-2">
                      <button className="underline" onClick={() => { setEditing(m.id); setEditText(m.body); }}>編集</button>
                      <button className="underline text-destructive" onClick={async () => {
                        await (supabase as any).from("org_chat_messages").update({ deleted_at: new Date().toISOString(), body: "" }).eq("id", m.id);
                        openThread(active);
                      }}>削除</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!moderateGroupId && (
              <div className="flex gap-2 pt-2 border-t mt-2">
                <Input placeholder="メッセージ" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
                <Button onClick={send}><Send className="h-4 w-4" /></Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
