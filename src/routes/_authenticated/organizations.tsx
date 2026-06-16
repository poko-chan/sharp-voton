import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, Plus, Check, X, Users as UsersIcon, ShieldAlert, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/organizations")({ component: OrgsPage });

function OrgsPage() {
  const { user, isAdmin } = useAuth();
  const [myOrgs, setMyOrgs] = useState<any[]>([]);
  const [allOrgs, setAllOrgs] = useState<any[]>([]);
  const [pendingOrgs, setPendingOrgs] = useState<any[]>([]);
  const [joinReqs, setJoinReqs] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [joinId, setJoinId] = useState("");
  const [joinMsg, setJoinMsg] = useState("");

  const load = async () => {
    if (!user) return;
    const { data: mems } = await (supabase as any).from("organization_members")
      .select("role, suspended, organization:organizations(id, name, description, status)")
      .eq("user_id", user.id);
    setMyOrgs(mems ?? []);
    const { data: all } = await (supabase as any).from("organizations")
      .select("id, name, description, status").eq("status", "approved").limit(50);
    setAllOrgs(all ?? []);
    if (isAdmin) {
      const { data: pend } = await (supabase as any).from("organizations")
        .select("id, name, description, created_by, created_at, profile:profiles!organizations_created_by_fkey(display_name, username)")
        .eq("status", "pending").order("created_at", { ascending: false });
      setPendingOrgs(pend ?? []);
    }
    // join requests I can review (in orgs I admin)
    const { data: jr } = await (supabase as any).from("organization_join_requests")
      .select("id, status, message, created_at, user_id, organization_id, organization:organizations(name), profile:profiles!organization_join_requests_user_id_fkey(display_name, username)")
      .eq("status", "pending").order("created_at", { ascending: false });
    setJoinReqs(jr ?? []);
  };
  useEffect(() => { load(); }, [user?.id, isAdmin]);

  const createOrg = async () => {
    if (!name.trim() || !user) return;
    const { error } = await (supabase as any).from("organizations").insert({
      name, description: desc || null, created_by: user.id,
    });
    if (error) return toast.error(error.message);
    setName(""); setDesc("");
    toast.success("組織申請を送信しました。運営の承認をお待ちください");
    load();
  };
  const requestJoin = async (orgId?: string) => {
    const target = orgId ?? joinId;
    if (!target || !user) return;
    const { error } = await (supabase as any).from("organization_join_requests").insert({
      organization_id: target, user_id: user.id, message: joinMsg || null,
    });
    if (error) return toast.error(error.message);
    setJoinId(""); setJoinMsg("");
    toast.success("参加申請を送信しました");
    load();
  };
  const reviewOrg = async (orgId: string, approve: boolean) => {
    const { error } = await (supabase as any).rpc("admin_review_organization", { _org_id: orgId, _approve: approve });
    if (error) return toast.error(error.message);
    toast.success(approve ? "承認しました" : "却下しました");
    load();
  };
  const reviewJoin = async (reqId: string, approve: boolean) => {
    const { error } = await (supabase as any).rpc("org_review_join_request", { _req_id: reqId, _approve: approve, _role: "member" });
    if (error) return toast.error(error.message);
    toast.success(approve ? "承認しました" : "却下しました");
    load();
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" />組織</h1>
      <p className="text-sm text-muted-foreground">学校・塾・サークルなどで組織を作成し、組織内専用のMakron単元や一括サービス制限を運用できます。</p>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">マイ組織</TabsTrigger>
          <TabsTrigger value="create"><Plus className="h-3 w-3 mr-1" />新規申請</TabsTrigger>
          <TabsTrigger value="join">参加申請</TabsTrigger>
          {joinReqs.length > 0 && <TabsTrigger value="review">参加リクエスト ({joinReqs.length})</TabsTrigger>}
          {isAdmin && <TabsTrigger value="admin"><ShieldAlert className="h-3 w-3 mr-1" />運営審査 ({pendingOrgs.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="mine" className="space-y-3">
          {myOrgs.length === 0 && <Card className="p-6 text-sm text-muted-foreground">まだ所属組織はありません</Card>}
          {myOrgs.map((m: any) => (
            <Card key={m.organization?.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-bold">{m.organization?.name} <span className="text-[10px] ml-2 px-2 py-0.5 rounded bg-muted">{m.role}{m.suspended ? "（停止中）" : ""}</span></div>
                <div className="text-xs text-muted-foreground">{m.organization?.description}</div>
                <div className="text-[10px] text-muted-foreground">状態: {m.organization?.status}</div>
              </div>
              {["owner","admin"].includes(m.role) && (
                <Link to="/organizations/$orgId" params={{ orgId: m.organization?.id }} className="text-sm underline">管理 →</Link>
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="create" className="space-y-3">
          <Card className="p-4 space-y-2">
            <div className="font-bold">新しい組織を申請</div>
            <Input placeholder="組織名" value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea rows={3} placeholder="説明（任意）" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <Button onClick={createOrg}><Send className="h-4 w-4 mr-1" />申請を送信</Button>
            <div className="text-[11px] text-muted-foreground">運営が承認すると、あなたがオーナーになります。</div>
          </Card>
        </TabsContent>

        <TabsContent value="join" className="space-y-3">
          <Card className="p-4 space-y-2">
            <div className="font-bold">既存の組織に参加申請</div>
            <Input placeholder="組織IDを入力（管理者から共有してもらってください）" value={joinId} onChange={(e) => setJoinId(e.target.value)} />
            <Textarea rows={2} placeholder="メッセージ（任意）" value={joinMsg} onChange={(e) => setJoinMsg(e.target.value)} />
            <Button onClick={() => requestJoin()}><Send className="h-4 w-4 mr-1" />参加を申請</Button>
          </Card>
          <div className="text-xs text-muted-foreground">公開済み組織</div>
          {allOrgs.map((o: any) => (
            <Card key={o.id} className="p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-muted-foreground">{o.description}</div>
                <div className="text-[10px] text-muted-foreground">ID: {o.id}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => requestJoin(o.id)}>参加申請</Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="review" className="space-y-3">
          {joinReqs.map((r: any) => (
            <Card key={r.id} className="p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{r.profile?.display_name ?? r.profile?.username ?? r.user_id.slice(0,8)} → {r.organization?.name}</div>
                <div className="text-xs text-muted-foreground">{r.message}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => reviewJoin(r.id, true)}><Check className="h-4 w-4" /></Button>
                <Button size="sm" variant="destructive" onClick={() => reviewJoin(r.id, false)}><X className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="admin" className="space-y-3">
            {pendingOrgs.length === 0 && <Card className="p-6 text-sm text-muted-foreground">審査待ちの組織はありません</Card>}
            {pendingOrgs.map((o: any) => (
              <Card key={o.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-bold">{o.name}</div>
                  <div className="text-xs text-muted-foreground">{o.description}</div>
                  <div className="text-[10px] text-muted-foreground">申請者: {o.profile?.display_name ?? o.profile?.username}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => reviewOrg(o.id, true)}><Check className="h-4 w-4 mr-1" />承認</Button>
                  <Button size="sm" variant="destructive" onClick={() => reviewOrg(o.id, false)}><X className="h-4 w-4 mr-1" />却下</Button>
                </div>
              </Card>
            ))}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}