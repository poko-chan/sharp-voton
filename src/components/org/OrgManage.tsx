import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, Ban, UserCog, Plus, Trash2, Mail, Send, KeyRound, Crown, Clock, BookOpen, UserPlus, Copy, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABEL } from "@/lib/org-roles";
import { OrgAssignments } from "@/components/org/OrgAssignments";



const SERVICES = ["timer","tutor","classroom","classchat","chat","notes","today","practice","questions","coach","micro","listen"];
const ROLES = ["owner","admin","teacher","member"];

export function OrgManage({ orgId, defaultTab = "members" }: { orgId: string; defaultTab?: string }) {
  const { user, isAdmin } = useAuth();
  const [org, setOrg] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [joinReqs, setJoinReqs] = useState<any[]>([]);
  const [restrictions, setRestrictions] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [packs, setPacks] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [svc, setSvc] = useState("timer");
  const [variant, setVariant] = useState("stop");
  const [msg, setMsg] = useState("");
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteMsg, setInviteMsg] = useState("");
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: o } = await (supabase as any).from("organizations").select("*").eq("id", orgId).maybeSingle();
    setOrg(o);
    const { data: m, error: mErr } = await (supabase as any).from("organization_members")
      .select("id, role, suspended, user_id")
      .eq("organization_id", orgId);
    if (mErr) toast.error(mErr.message);
    const role = (m ?? []).find((x: any) => x.user_id === user.id)?.role ?? null;
    setMyRole(role);
    const admin = isAdmin || ["owner","admin"].includes(role ?? "");
    let reqRows: any[] = [], invRows: any[] = [];
    if (admin) {
      const [{ data: r }, { data: pi }, { data: jr }, { data: st }] = await Promise.all([
        (supabase as any).from("organization_service_restrictions").select("*").eq("organization_id", orgId),
        (supabase as any).from("organization_invitations")
          .select("id, role, message, status, created_at, invitee_id")
          .eq("organization_id", orgId).eq("status", "pending"),
        (supabase as any).from("organization_join_requests")
          .select("id, status, message, created_at, user_id")
          .eq("organization_id", orgId).eq("status", "pending"),
        (supabase as any).rpc("org_member_stats", { _org: orgId }),
      ]);
      reqRows = jr ?? []; invRows = pi ?? [];
      setRestrictions(r ?? []); setStats(st ?? []);
    }
    // profiles は外部キーが無いため個別取得してから結合する
    const ids = Array.from(new Set([
      ...(m ?? []).map((x: any) => x.user_id),
      ...reqRows.map((x: any) => x.user_id),
      ...invRows.map((x: any) => x.invitee_id),
    ].filter(Boolean)));
    const pmap: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles")
        .select("id, username, display_name, avatar_url").in("id", ids);
      for (const p of profs ?? []) pmap[p.id] = p;
    }
    setMembers((m ?? []).map((x: any) => ({ ...x, profile: pmap[x.user_id] })));
    setJoinReqs(reqRows.map((x: any) => ({ ...x, profile: pmap[x.user_id] })));
    setPendingInvites(invRows.map((x: any) => ({ ...x, profile: pmap[x.invitee_id] })));
    const [{ data: pk }, { data: cl }] = await Promise.all([
      (supabase as any).from("makron_packs").select("id, title, status").eq("organization_id", orgId).limit(50),
      (supabase as any).from("classes").select("id, name").eq("organization_id", orgId).limit(50),
    ]);
    setPacks(pk ?? []); setClasses(cl ?? []);
    setLoaded(true);
  };
  useEffect(() => { load(); }, [orgId, user?.id]);

  const canAdmin = isAdmin || ["owner","admin"].includes(myRole ?? "");
  const isOwner = isAdmin || myRole === "owner";

  if (!loaded) return <div className="p-6 text-sm text-muted-foreground">読み込み中…</div>;
  if (!myRole && !isAdmin) return (
    <div className="p-6 text-sm text-muted-foreground space-y-2">
      <div>この組織に参加していません。</div>
      <Link to="/organizations" className="underline">← 組織一覧へ戻る</Link>
    </div>
  );

  const updateMember = async (id: string, patch: any) => {
    const { error } = await (supabase as any).from("organization_members").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const removeMember = async (id: string) => {
    if (!confirm("メンバーを削除しますか？")) return;
    const { error } = await (supabase as any).from("organization_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const transfer = async (userId: string) => {
    if (!confirm("経営者権限を移譲しますか？あなたは共同管理者になります。")) return;
    const { error } = await (supabase as any).rpc("org_transfer_ownership", { _org: orgId, _user: userId });
    if (error) return toast.error(error.message);
    toast.success("経営者を移譲しました"); load();
  };
  const reviewReq = async (id: string, approve: boolean, role = "member") => {
    const { error } = await (supabase as any).rpc("org_review_join_request", { _req_id: id, _approve: approve, _role: role });
    if (error) return toast.error(error.message);
    toast.success(approve ? "承認しました" : "却下しました"); load();
  };
  const enrollAll = async (classId: string) => {
    const { data, error } = await (supabase as any).rpc("org_enroll_all", { _org: orgId, _class: classId });
    if (error) return toast.error(error.message);
    toast.success(`${data ?? 0}人を参加させました`);
  };
  const addRestriction = async () => {
    const { error } = await (supabase as any).from("organization_service_restrictions").insert({
      organization_id: orgId, service_key: svc, variant, message: msg || null,
    });
    if (error) return toast.error(error.message);
    setMsg(""); load();
  };
  const searchUsers = async () => {
    if (!inviteQuery.trim()) return;
    const { data } = await supabase.from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${inviteQuery}%,display_name.ilike.%${inviteQuery}%`)
      .limit(10);
    setInviteResults(data ?? []);
  };
  const invite = async (userId: string) => {
    const { error } = await (supabase as any).rpc("org_invite_member", {
      _org: orgId, _user: userId, _role: inviteRole, _message: inviteMsg || null,
    });
    if (error) return toast.error(error.message);
    toast.success("招待を送信しました");
    setInviteQuery(""); setInviteResults([]); setInviteMsg("");
    load();
  };

  const fmt = (min: number) => `${Math.floor((min ?? 0) / 60)}時間${(min ?? 0) % 60}分`;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <Link to="/organizations/$orgId" params={{ orgId }} className="text-sm underline text-muted-foreground">← 組織ホームへ</Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" />{org?.name}</h1>
        {org?.status !== "approved" && <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-700">運営の承認待ち</span>}
        <span className="text-xs px-2 py-0.5 rounded bg-muted">あなた: {ROLE_LABEL[myRole ?? ""] ?? "運営"}</span>
      </div>
      {canAdmin && (
        <Card className="p-3 flex items-center gap-2 text-sm">
          <KeyRound className="h-4 w-4 text-primary" />
          参加コード: <span className="font-mono text-lg font-bold tracking-widest">{org?.join_code}</span>
          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(org?.join_code ?? ""); toast.success("コピーしました"); }}>
            <Copy className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground">メンバーはこのコードで参加申請できます</span>
        </Card>
      )}

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="members"><UserCog className="h-3 w-3 mr-1" />メンバー ({members.length})</TabsTrigger>
          {canAdmin && <TabsTrigger value="requests"><UserPlus className="h-3 w-3 mr-1" />参加申請 ({joinReqs.length})</TabsTrigger>}
          {canAdmin && <TabsTrigger value="stats"><Clock className="h-3 w-3 mr-1" />勉強時間</TabsTrigger>}
          <TabsTrigger value="content"><BookOpen className="h-3 w-3 mr-1" />問題集・クラス</TabsTrigger>
          <TabsTrigger value="assignments"><ClipboardList className="h-3 w-3 mr-1" />課題</TabsTrigger>
          {canAdmin && <TabsTrigger value="invite"><Mail className="h-3 w-3 mr-1" />招待 ({pendingInvites.length})</TabsTrigger>}
          {canAdmin && <TabsTrigger value="restrictions"><Ban className="h-3 w-3 mr-1" />サービス制限</TabsTrigger>}
          {canAdmin && <TabsTrigger value="settings">設定</TabsTrigger>}
        </TabsList>

        <TabsContent value="members" className="space-y-2">
          {members.map((m: any) => (
            <Card key={m.id} className="p-3 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[160px]">
                <div className="font-medium truncate flex items-center gap-1">
                  {m.role === "owner" && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                  {m.profile?.display_name ?? m.profile?.username ?? m.user_id.slice(0,8)}
                </div>
                <div className="text-[11px] text-muted-foreground">{ROLE_LABEL[m.role] ?? m.role}{m.suspended ? "・利用停止中" : ""}</div>
              </div>
              {canAdmin && (
                <Select value={m.role} onValueChange={(v) => {
                  if (v === "owner") return toast.error("経営者は「経営者に移譲」から変更してください");
                  if (m.role === "owner") return toast.error("経営者の役割は移譲でのみ変更できます");
                  updateMember(m.id, { role: v });
                }}>
                  <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {isOwner && m.role !== "owner" && (
                <Button size="sm" variant="outline" onClick={() => transfer(m.user_id)}><Crown className="h-3 w-3 mr-1" />経営者に移譲</Button>
              )}
              {canAdmin && m.role !== "owner" && (
                <>
                  <Button size="sm" variant={m.suspended ? "default" : "outline"} onClick={() => updateMember(m.id, { suspended: !m.suspended })}>
                    {m.suspended ? "解除" : "停止"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeMember(m.id)}><Trash2 className="h-4 w-4" /></Button>
                </>
              )}
            </Card>
          ))}
        </TabsContent>

        {canAdmin && (
          <TabsContent value="requests" className="space-y-2">
            {joinReqs.length === 0 && <Card className="p-6 text-sm text-muted-foreground">参加申請はありません</Card>}
            {joinReqs.map((r: any) => (
              <Card key={r.id} className="p-3 flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[160px]">
                  <div className="font-medium">{r.profile?.display_name ?? r.profile?.username ?? r.user_id.slice(0,8)}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("ja-JP")}</div>
                </div>
                <Button size="sm" onClick={() => reviewReq(r.id, true, "member")}>一般として承認</Button>
                <Button size="sm" variant="outline" onClick={() => reviewReq(r.id, true, "teacher")}>教師として承認</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => reviewReq(r.id, false)}>却下</Button>
              </Card>
            ))}
          </TabsContent>
        )}

        {canAdmin && (
          <TabsContent value="stats" className="space-y-2">
            <div className="text-xs text-muted-foreground">メンバーの学習サマリー（閲覧のみ・記録の編集はできません）</div>
            {stats.map((s: any) => (
              <Card key={s.user_id} className="p-3 flex flex-wrap items-center gap-3 text-sm">
                <div className="flex-1 min-w-[140px] font-medium">{s.display_name ?? s.username ?? s.user_id.slice(0,8)}
                  <span className="text-[10px] ml-2 px-1.5 rounded bg-muted">{ROLE_LABEL[s.role] ?? s.role}</span>
                </div>
                <div>7日: <b>{fmt(Number(s.minutes_7d))}</b></div>
                <div>30日: <b>{fmt(Number(s.minutes_30d))}</b></div>
                <div className="text-xs text-muted-foreground">記録 {s.sessions_30d}件 / 最終 {s.last_studied ? new Date(s.last_studied).toLocaleDateString("ja-JP") : "—"}</div>
              </Card>
            ))}
            {stats.length === 0 && <Card className="p-6 text-sm text-muted-foreground">データがありません</Card>}
          </TabsContent>
        )}

        <TabsContent value="assignments">
          <OrgAssignments orgId={orgId} canAdmin={canAdmin} packs={packs} members={members} />
        </TabsContent>

        <TabsContent value="content" className="space-y-3">
          <Card className="p-4 space-y-2">
            <div className="font-bold flex items-center gap-1"><BookOpen className="h-4 w-4" />組織専用のMakron問題集 ({packs.length})</div>
            {packs.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between border rounded p-2 text-sm">
                <span>{p.title} <span className="text-[10px] ml-1 px-1.5 rounded bg-muted">{p.status}</span></span>
                <Link to="/makron/pack/$packId" params={{ packId: p.id }} className="underline text-xs">開く →</Link>
              </div>
            ))}
            {packs.length === 0 && <div className="text-xs text-muted-foreground">まだありません。Makronで問題集を作成後、下のボタンで組織に紐づけできます。</div>}
            {canAdmin && <LinkPackForm orgId={orgId} onDone={load} />}
          </Card>

          <Card className="p-4 space-y-2">
            <div className="font-bold">組織クラスルーム ({classes.length})</div>
            {classes.map((c: any) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border rounded p-2 text-sm">
                <span>{c.name}</span>
                <div className="flex gap-2">
                  {canAdmin && <Button size="sm" variant="outline" onClick={() => enrollAll(c.id)}>全メンバーを強制参加</Button>}
                  <Link to="/classroom/$classId" params={{ classId: c.id }} className="underline text-xs self-center">開く →</Link>
                </div>
              </div>
            ))}
            {classes.length === 0 && <div className="text-xs text-muted-foreground">まだありません。クラスルームを作成後、下から組織に紐づけできます。</div>}
            {canAdmin && <LinkClassForm orgId={orgId} onDone={load} />}
          </Card>
        </TabsContent>

        {canAdmin && (
          <TabsContent value="invite" className="space-y-2">
            <Card className="p-4 space-y-2">
              <div className="font-bold flex items-center gap-1"><Mail className="h-4 w-4" />メンバーを招待</div>
              <div className="flex gap-2">
                <Input placeholder="ユーザー名・表示名で検索" value={inviteQuery} onChange={(e) => setInviteQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchUsers()} />
                <Button onClick={searchUsers}>検索</Button>
              </div>
              <div className="flex gap-2 items-center">
                <label className="text-xs">役割</label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">一般</SelectItem>
                    <SelectItem value="teacher">教師</SelectItem>
                    <SelectItem value="admin">共同管理者</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="メッセージ（任意）" value={inviteMsg} onChange={(e) => setInviteMsg(e.target.value)} className="flex-1" />
              </div>
              <div className="space-y-1 max-h-60 overflow-auto">
                {inviteResults.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-2 border rounded p-2 text-sm">
                    <div className="flex-1">{u.display_name ?? u.username} <span className="text-xs text-muted-foreground">@{u.username}</span></div>
                    <Button size="sm" onClick={() => invite(u.id)}><Send className="h-3 w-3 mr-1" />招待</Button>
                  </div>
                ))}
              </div>
            </Card>
            <div className="text-xs text-muted-foreground">送信済み招待（応答待ち）</div>
            {pendingInvites.map((p: any) => (
              <Card key={p.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{p.profile?.display_name ?? p.profile?.username ?? p.invitee_id.slice(0,8)}</div>
                  <div className="text-[10px] text-muted-foreground">{ROLE_LABEL[p.role] ?? p.role} ・ {new Date(p.created_at).toLocaleString("ja-JP")}</div>
                </div>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                  await (supabase as any).from("organization_invitations").update({ status: "cancelled" }).eq("id", p.id); load();
                }}><Trash2 className="h-4 w-4" /></Button>
              </Card>
            ))}
          </TabsContent>
        )}

        {canAdmin && (
          <TabsContent value="restrictions" className="space-y-2">
            <Card className="p-3 flex gap-2 items-end flex-wrap">
              <div>
                <label className="text-xs">サービス</label>
                <Select value={svc} onValueChange={setSvc}>
                  <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{SERVICES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs">種類</label>
                <Select value={variant} onValueChange={setVariant}>
                  <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stop">完全停止</SelectItem>
                    <SelectItem value="warn">警告のみ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input placeholder="メッセージ（任意）" value={msg} onChange={(e) => setMsg(e.target.value)} className="flex-1 min-w-[200px]" />
              <Button onClick={addRestriction}><Plus className="h-4 w-4 mr-1" />追加</Button>
            </Card>
            {restrictions.map((r: any) => (
              <Card key={r.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{r.service_key} <span className="text-[10px] ml-1 px-1.5 rounded bg-muted">{r.variant}</span></div>
                  <div className="text-xs text-muted-foreground">{r.message}</div>
                </div>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                  await (supabase as any).from("organization_service_restrictions").delete().eq("id", r.id); load();
                }}><Trash2 className="h-4 w-4" /></Button>
              </Card>
            ))}
          </TabsContent>
        )}

        {canAdmin && (
          <TabsContent value="settings" className="space-y-2">
            <Card className="p-4 space-y-2">
              <div className="font-bold">組織情報</div>
              <Input value={org?.name ?? ""} onChange={(e) => setOrg({ ...org, name: e.target.value })} />
              <Input value={org?.description ?? ""} onChange={(e) => setOrg({ ...org, description: e.target.value })} />
              <Button onClick={async () => {
                const { error } = await (supabase as any).from("organizations").update({ name: org.name, description: org.description }).eq("id", orgId);
                if (error) return toast.error(error.message);
                toast.success("保存しました");
              }}>保存</Button>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function LinkPackForm({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const { user } = useAuth();
  const [mine, setMine] = useState<any[]>([]);
  const [sel, setSel] = useState("");
  useEffect(() => {
    if (!user) return;
    (supabase as any).from("makron_packs").select("id, title").eq("created_by", user.id).is("organization_id", null).limit(50)
      .then(({ data }: any) => setMine(data ?? []));
  }, [user?.id]);
  if (mine.length === 0) return null;
  return (
    <div className="flex gap-2 pt-2">
      <Select value={sel} onValueChange={setSel}>
        <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="自分の問題集を組織に紐づけ" /></SelectTrigger>
        <SelectContent>{mine.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
      </Select>
      <Button disabled={!sel} onClick={async () => {
        const { error } = await (supabase as any).from("makron_packs").update({ organization_id: orgId }).eq("id", sel);
        if (error) return toast.error(error.message);
        toast.success("紐づけました"); setSel(""); onDone();
      }}>紐づけ</Button>
    </div>
  );
}

function LinkClassForm({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const { user } = useAuth();
  const [mine, setMine] = useState<any[]>([]);
  const [sel, setSel] = useState("");
  useEffect(() => {
    if (!user) return;
    (supabase as any).from("classes").select("id, name").eq("owner_id", user.id).is("organization_id", null).limit(50)
      .then(({ data }: any) => setMine(data ?? []));
  }, [user?.id]);
  if (mine.length === 0) return null;
  return (
    <div className="flex gap-2 pt-2">
      <Select value={sel} onValueChange={setSel}>
        <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="自分のクラスを組織に紐づけ" /></SelectTrigger>
        <SelectContent>{mine.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
      </Select>
      <Button disabled={!sel} onClick={async () => {
        const { error } = await (supabase as any).from("classes").update({ organization_id: orgId }).eq("id", sel);
        if (error) return toast.error(error.message);
        toast.success("紐づけました"); setSel(""); onDone();
      }}>紐づけ</Button>
    </div>
  );
}
