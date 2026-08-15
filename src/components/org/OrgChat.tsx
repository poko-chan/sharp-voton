import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Check, X, Plus, Users, MessageSquare, Inbox, ArrowLeft, Info, Search } from "lucide-react";
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
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const load = async () => {
    let query = (supabase as any).from("org_chat_threads").select("*").eq("organization_id", orgId).order("updated_at", { ascending: false });
    if (moderateGroupId) query = query.eq("group_id", moderateGroupId);
    const { data: th, error } = await query;
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
    if (m?.length) setProfiles((pr) => ({ ...pr }));
    const prof = await loadOrgProfiles(orgId, (m ?? []).map((x: any) => x.user_id));
    setProfiles((pr) => ({ ...prof, ...pr }));
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
    if (error) return toast.error("メッセージを送れません（相手の承認待ち・権限をご確認ください）");
    setText(""); openThread(active);
  };

  const respond = async (threadId: string, accept: boolean) => {
    const { error } = await (supabase as any).from("org_chat_participants")
      .update({ status: accept ? "accepted" : "blocked" }).eq("thread_id", threadId).eq("user_id", user!.id);
    if (error) return toast.error(error.message);
    toast.success(accept ? "チャットを承認しました" : "拒否しました");
    load();
  };

  const startDm = async (other: string) => {
    const { data, error } = await (supabase as any).rpc("org_start_dm", { _org: orgId, _other: other });
    if (error) return toast.error(error.message);
    toast.success("チャットを開始しました（相手が承認すると会話できます）");
    setShowNew(false); await load(); openThread(data);
  };

  const title = (t: any) => {
    if (t.title) return t.title;
    const others = (parts[t.id] ?? []).filter((p) => p.user_id !== user?.id);
    return others.map((p) => nameOf(profiles[p.user_id])).join("、") || "チャット";
  };
  const myPart = (t: any) => (parts[t.id] ?? []).find((p) => p.user_id === user?.id);
  const readers = (t: any, at: string) => (parts[t.id] ?? []).filter((p) => p.user_id !== user?.id && p.last_read_at && p.last_read_at >= at).length;

  const pending = threads.filter((t) => myPart(t)?.status === "pending");
  const accepted = threads.filter((t) => !myPart(t) || myPart(t)?.status === "accepted");
  const activeThread = threads.find((t) => t.id === active);
  const activeStatus = activeThread ? myPart(activeThread)?.status : null;

  const ThreadItem = ({ t }: { t: any }) => {
    const others = (parts[t.id] ?? []).filter((p) => p.user_id !== user?.id);
    const av = profiles[others[0]?.user_id]?.avatar_url;
    return (
      <button onClick={() => openThread(t.id)}
        className={`w-full flex items-center gap-2 rounded-lg p-2 text-left transition ${active === t.id ? "bg-primary/12" : "hover:bg-muted"}`}>
        <Avatar className="h-8 w-8">
          <AvatarImage src={av ?? undefined} alt="" />
          <AvatarFallback>{t.kind === "group" ? <Users className="h-4 w-4" /> : title(t).slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{title(t)}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {t.kind === "group" ? "グループチャット" : "1対1のチャット"}{!myPart(t) && " ・閲覧（管理）"}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4">
      <div className="space-y-3">
        {!moderateGroupId && (
          <>
            <Button className="w-full" size="sm" onClick={() => setShowNew(!showNew)}>
              <Plus className="h-4 w-4 mr-1" />新しいチャットを始める
            </Button>
            {showNew && (
              <Card className="p-2 space-y-2">
                <div className="text-[11px] text-muted-foreground px-1">相手を選ぶと、相手の承認後に会話できます。</div>
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input className="pl-7 h-8" placeholder="メンバーを検索" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="max-h-60 overflow-auto space-y-0.5">
                  {members.filter((m) => m.user_id !== user?.id)
                    .filter((m) => !q || nameOf(profiles[m.user_id], "").includes(q))
                    .map((m) => (
                      <button key={m.user_id} className="w-full flex items-center gap-2 text-left text-sm p-1.5 rounded hover:bg-muted" onClick={() => startDm(m.user_id)}>
                        <Avatar className="h-6 w-6"><AvatarImage src={profiles[m.user_id]?.avatar_url ?? undefined} alt="" /><AvatarFallback>{nameOf(profiles[m.user_id]).slice(0, 1)}</AvatarFallback></Avatar>
                        <span className="flex-1 truncate">{nameOf(profiles[m.user_id], m.user_id.slice(0, 8))}</span>
                        <span className="text-[10px] text-muted-foreground">{m.role}</span>
                      </button>
                    ))}
                </div>
              </Card>
            )}
          </>
        )}

        {pending.length > 0 && (
          <Card className="p-2 space-y-2 border-amber-400/60">
            <div className="text-[11px] font-semibold flex items-center gap-1 text-amber-600"><Inbox className="h-3.5 w-3.5" />承認まちのリクエスト {pending.length}件</div>
            {pending.map((t) => (
              <div key={t.id} className="rounded-lg border p-2 space-y-1.5">
                <div className="text-sm font-medium truncate">{title(t)}</div>
                <div className="flex gap-1">
                  <Button size="sm" className="h-7 flex-1" onClick={() => respond(t.id, true)}><Check className="h-3 w-3 mr-1" />承認</Button>
                  <Button size="sm" variant="outline" className="h-7 flex-1" onClick={() => respond(t.id, false)}><X className="h-3 w-3 mr-1" />拒否</Button>
                </div>
              </div>
            ))}
          </Card>
        )}

        <Card className="p-2 space-y-0.5">
          <div className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">チャット一覧</div>
          {accepted.length === 0 && <div className="p-3 text-xs text-muted-foreground">まだチャットはありません</div>}
          {accepted.map((t) => <ThreadItem key={t.id} t={t} />)}
        </Card>
      </div>

      <Card className="p-0 min-h-[420px] flex flex-col overflow-hidden">
        {!active ? (
          <div className="m-auto text-center space-y-2 p-8">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <div className="text-sm text-muted-foreground">左のリストからチャットを選んでください</div>
            <div className="text-[11px] text-muted-foreground max-w-xs mx-auto">
              「新しいチャットを始める」→ 相手を選ぶ → 相手が承認 → 会話スタート、という流れです。
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Button size="sm" variant="ghost" className="md:hidden" onClick={() => setActive(null)}><ArrowLeft className="h-4 w-4" /></Button>
              <div className="font-medium text-sm flex items-center gap-1">
                {activeThread?.kind === "group" && <Users className="h-4 w-4" />}{activeThread && title(activeThread)}
              </div>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {activeStatus === "pending" ? "承認まち" : !myPart(activeThread) ? "閲覧のみ（管理）" : "参加中"}
              </span>
            </div>

            {activeStatus === "pending" && (
              <div className="bg-amber-500/10 text-amber-700 text-[11px] px-3 py-2 flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />このチャットはまだ承認されていません。上のリクエストから承認してください。
              </div>
            )}

            <div className="flex-1 space-y-3 overflow-auto p-3 max-h-[52vh]">
              {messages.length === 0 && <div className="text-center text-xs text-muted-foreground py-8">まだメッセージはありません</div>}
              {messages.map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    {!mine && (
                      <Avatar className="h-7 w-7 mt-4"><AvatarImage src={profiles[m.sender_id]?.avatar_url ?? undefined} alt="" />
                        <AvatarFallback>{nameOf(profiles[m.sender_id]).slice(0, 1)}</AvatarFallback></Avatar>
                    )}
                    <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                      <div className="text-[10px] text-muted-foreground">
                        {!mine && `${nameOf(profiles[m.sender_id])} ・ `}{new Date(m.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                        {m.edited_at && "（編集済み）"}
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
                        <div className={`inline-block rounded-2xl px-3 py-2 text-sm text-left ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                          {m.deleted_at ? <span className="italic opacity-70">削除されたメッセージ</span> : m.body}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground space-x-2">
                        {mine && readers(activeThread, m.created_at) > 0 && <span>既読</span>}
                        {mine && !m.deleted_at && editing !== m.id && (
                          <>
                            <button className="underline" onClick={() => { setEditing(m.id); setEditText(m.body); }}>編集</button>
                            <button className="underline text-destructive" onClick={async () => {
                              await (supabase as any).from("org_chat_messages").update({ deleted_at: new Date().toISOString(), body: "" }).eq("id", m.id);
                              openThread(active);
                            }}>削除</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!moderateGroupId && (
              <div className="flex gap-2 border-t p-3">
                <Input placeholder={activeStatus === "pending" ? "承認後に送信できます" : "メッセージを入力"} value={text}
                  onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
                <Button onClick={send}><Send className="h-4 w-4" /></Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
