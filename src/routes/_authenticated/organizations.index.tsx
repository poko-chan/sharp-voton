import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ROLE_LABEL } from "@/lib/org-roles";
import { Building2, Check, X, Mail, Plus, KeyRound, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/organizations/")({
  head: () => {
    const title = "組織｜StudyΩ — 学校・塾・チームで学習を管理";
    const description = "StudyΩ の組織機能。参加コードでメンバーを集め、勉強時間の共有、組織専用のMakron問題集やクラスルーム管理ができます。";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: OrgsPage,
});



function OrgsPage() {
  const { user, isAdmin } = useAuth();
  const [myOrgs, setMyOrgs] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [openApp, setOpenApp] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: myApps } = await (supabase as any)
      .from("organization_applications")
      .select("id, org_name, org_type, status, created_at, admin_note, organization_id")
      .eq("applicant_id", user.id)
      .order("created_at", { ascending: false });
    setApps(myApps ?? []);
    const { data: mems, error } = await (supabase as any).from("organization_members")
      .select("role, suspended, organization:organizations(id, name, description, status, join_code, owner_id)")
      .eq("user_id", user.id);
    if (error) toast.error(error.message);
    setMyOrgs(mems ?? []);
    const { data: inv } = await (supabase as any).from("organization_invitations")
      .select("id, message, role, created_at, organization:organizations(id, name, description)")
      .eq("invitee_id", user.id).eq("status", "pending");
    setInvites(inv ?? []);
    const { data: reqs } = await (supabase as any).from("organization_join_requests")
      .select("id, status, created_at, organization:organizations(id, name)")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
    setRequests(reqs ?? []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const respond = async (id: string, accept: boolean) => {
    const { error } = await (supabase as any).rpc("org_respond_invitation", { _invite_id: id, _accept: accept });
    if (error) return toast.error(error.message);
    toast.success(accept ? "参加しました" : "招待を辞退しました");
    load();
  };

  const create = async () => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("org_create", { _name: name, _description: desc || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("組織を申請しました。運営の承認をお待ちください");
    setName(""); setDesc(""); setShowCreate(false); load();
  };

  const join = async () => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("org_join_by_code", { _code: code });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("参加申請を送信しました");
    setCode(""); load();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" />組織</h1>
      <p className="text-sm text-muted-foreground">
        1つのアカウントに複数の組織を紐づけられます。組織は誰でも申請でき、運営の承認後にメンバーを追加できます。
        {isAdmin && <> 審査は <Link to="/admin" search={{ tab: "orgs" } as any} className="underline">管理者ダッシュボード</Link> から。</>}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4 space-y-2">
          <div className="font-bold flex items-center gap-1"><KeyRound className="h-4 w-4" />参加コードで参加</div>
          <div className="flex gap-2">
            <Input placeholder="例: A1B2C3" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} />
            <Button onClick={join} disabled={busy || code.length < 4}>申請</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">経営者・共同管理者が承認するとメンバーになります。</p>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="font-bold flex items-center gap-1"><Plus className="h-4 w-4" />組織を作る（申請制）</div>
          {!showCreate ? (
            <Button variant="outline" onClick={() => setShowCreate(true)}>組織を申請する</Button>
          ) : (
            <>
              <Input placeholder="組織名" value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea placeholder="説明（任意）" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={create} disabled={busy || !name.trim()}>申請する</Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>やめる</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">申請者が経営者になります（経営者は1組織に1人）。</p>
            </>
          )}
        </Card>
      </div>

      {invites.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold flex items-center gap-1"><Mail className="h-4 w-4" />招待 ({invites.length})</h2>
          {invites.map((i: any) => (
            <Card key={i.id} className="p-3 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{i.organization?.name} <span className="text-[10px] ml-1 px-1.5 rounded bg-muted">{ROLE_LABEL[i.role] ?? i.role}</span></div>
                {i.message && <div className="text-xs text-muted-foreground">{i.message}</div>}
              </div>
              <Button size="sm" onClick={() => respond(i.id, true)}><Check className="h-4 w-4 mr-1" />参加</Button>
              <Button size="sm" variant="outline" onClick={() => respond(i.id, false)}><X className="h-4 w-4 mr-1" />辞退</Button>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-bold">マイ組織</h2>
        {myOrgs.length === 0 && <Card className="p-6 text-sm text-muted-foreground">まだ所属組織はありません</Card>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {myOrgs.map((m: any) => (
            <Card key={m.organization?.id} className="glass p-4 flex flex-col gap-3 rounded-2xl transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 shrink-0 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold">
                  {(m.organization?.name ?? "?").slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="font-bold truncate">{m.organization?.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted">{ROLE_LABEL[m.role] ?? m.role}</span>
                    {m.suspended && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">停止中</span>}
                    {m.organization?.status !== "approved" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700">承認待ち</span>}
                  </div>
                </div>
              </div>
              {m.organization?.description && (
                <div className="text-xs text-muted-foreground line-clamp-2">{m.organization.description}</div>
              )}
              <Button asChild className="mt-auto w-full">
                <Link to="/organizations/$orgId" params={{ orgId: m.organization?.id }}>開く</Link>
              </Button>
            </Card>
          ))}
        </div>
      </section>


      {requests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold flex items-center gap-1"><Clock className="h-4 w-4" />参加申請の状況</h2>
          {requests.map((r: any) => (
            <Card key={r.id} className="p-3 text-sm flex items-center justify-between">
              <span>{r.organization?.name}</span>
              <span className="text-xs text-muted-foreground">
                {r.status === "pending" ? "承認待ち" : r.status === "approved" ? "承認済み" : "却下"}
              </span>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
