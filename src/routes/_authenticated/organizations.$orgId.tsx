import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, Ban, UserCog, Plus, Trash2, Mail, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/organizations/$orgId")({ component: OrgAdmin });

const SERVICES = ["timer","tutor","classroom","classchat","chat","notes","today","practice","questions","coach","micro","listen"];

function OrgAdmin() {
  const { orgId } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const [org, setOrg] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [restrictions, setRestrictions] = useState<any[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [svc, setSvc] = useState("timer");
  const [variant, setVariant] = useState("stop");
  const [msg, setMsg] = useState("");
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteMsg, setInviteMsg] = useState("");
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data: o } = await (supabase as any).from("organizations").select("*").eq("id", orgId).maybeSingle();
    setOrg(o);
    const { data: m } = await (supabase as any).from("organization_members")
      .select("id, role, suspended, user_id, profile:profiles!organization_members_user_id_fkey(display_name, username, avatar_url)")
      .eq("organization_id", orgId);
    setMembers(m ?? []);
    setMyRole((m ?? []).find((x: any) => x.user_id === user.id)?.role ?? null);
    const { data: r } = await (supabase as any).from("organization_service_restrictions").select("*").eq("organization_id", orgId);
    setRestrictions(r ?? []);
    const { data: pi } = await (supabase as any).from("organization_invitations")
      .select("id, role, message, status, created_at, invitee_id, profile:profiles!organization_invitations_invitee_id_fkey(username, display_name)")
      .eq("organization_id", orgId).eq("status", "pending");
    setPendingInvites(pi ?? []);
  };
  useEffect(() => { load(); }, [orgId, user?.id]);

  const canAdmin = isAdmin || ["owner","admin"].includes(myRole ?? "");
  if (!canAdmin) return <div className="p-6 text-sm text-muted-foreground">管理権限がありません <Link to="/organizations" className="underline ml-2">← 戻る</Link></div>;

  const updateMember = async (id: string, patch: any) => {
    await (supabase as any).from("organization_members").update(patch).eq("id", id);
    load();
  };
  const removeMember = async (id: string) => {
    if (!confirm("メンバーを削除しますか？")) return;
    await (supabase as any).from("organization_members").delete().eq("id", id);
    load();
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

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <Link to="/organizations" className="text-sm underline text-muted-foreground">← 組織一覧へ</Link>
      <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" />{org?.name}</h1>
      <div className="text-xs text-muted-foreground">組織ID: {org?.id}（メンバーに共有して参加申請してもらえます）</div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members"><UserCog className="h-3 w-3 mr-1" />メンバー ({members.length})</TabsTrigger>
          <TabsTrigger value="invite"><Mail className="h-3 w-3 mr-1" />招待 ({pendingInvites.length})</TabsTrigger>
          <TabsTrigger value="restrictions"><Ban className="h-3 w-3 mr-1" />サービス制限</TabsTrigger>
          <TabsTrigger value="settings">設定</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-2">
          {members.map((m: any) => (
            <Card key={m.id} className="p-3 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{m.profile?.display_name ?? m.profile?.username ?? m.user_id.slice(0,8)}</div>
                <div className="text-[11px] text-muted-foreground">{m.role}{m.suspended ? "・利用停止中" : ""}</div>
              </div>
              <Select value={m.role} onValueChange={(v) => updateMember(m.id, { role: v })}>
                <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">owner</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="teacher">teacher</SelectItem>
                  <SelectItem value="member">member</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant={m.suspended ? "default" : "outline"} onClick={() => updateMember(m.id, { suspended: !m.suspended })}>
                {m.suspended ? "解除" : "停止"}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeMember(m.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </TabsContent>

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
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="teacher">teacher</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
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
                <div className="text-[10px] text-muted-foreground">{p.role} ・ {new Date(p.created_at).toLocaleString("ja-JP")}</div>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                await (supabase as any).from("organization_invitations").update({ status: "cancelled" }).eq("id", p.id); load();
              }}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </TabsContent>

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

        <TabsContent value="settings" className="space-y-2">
          <Card className="p-4 space-y-2">
            <div className="font-bold">組織情報</div>
            <Input value={org?.name ?? ""} onChange={(e) => setOrg({ ...org, name: e.target.value })} />
            <Input value={org?.description ?? ""} onChange={(e) => setOrg({ ...org, description: e.target.value })} />
            <Button onClick={async () => {
              await (supabase as any).from("organizations").update({ name: org.name, description: org.description }).eq("id", orgId);
              toast.success("保存しました");
            }}>保存</Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}