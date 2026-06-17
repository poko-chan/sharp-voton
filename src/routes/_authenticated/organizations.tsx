import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Check, X, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/organizations")({ component: OrgsPage });

function OrgsPage() {
  const { user, isAdmin } = useAuth();
  const [myOrgs, setMyOrgs] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data: mems } = await (supabase as any).from("organization_members")
      .select("role, suspended, organization:organizations(id, name, description, status)")
      .eq("user_id", user.id);
    setMyOrgs(mems ?? []);
    const { data: inv } = await (supabase as any).from("organization_invitations")
      .select("id, message, role, created_at, organization:organizations(id, name, description)")
      .eq("invitee_id", user.id).eq("status", "pending");
    setInvites(inv ?? []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const respond = async (id: string, accept: boolean) => {
    const { error } = await (supabase as any).rpc("org_respond_invitation", { _invite_id: id, _accept: accept });
    if (error) return toast.error(error.message);
    toast.success(accept ? "参加しました" : "招待を辞退しました");
    load();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" />組織</h1>
      <p className="text-sm text-muted-foreground">
        組織は運営（管理者）のみが作成できます。組織オーナーから招待を受けて参加します。
        {isAdmin && <> 組織の新規作成・審査は <Link to="/admin" search={{ tab: "orgs" } as any} className="underline">管理者ダッシュボード</Link> から。</>}
      </p>

      {invites.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold flex items-center gap-1"><Mail className="h-4 w-4" />招待 ({invites.length})</h2>
          {invites.map((i: any) => (
            <Card key={i.id} className="p-3 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{i.organization?.name} <span className="text-[10px] ml-1 px-1.5 rounded bg-muted">{i.role}</span></div>
                {i.message && <div className="text-xs text-muted-foreground">{i.message}</div>}
              </div>
              <Button size="sm" onClick={() => respond(i.id, true)}><Check className="h-4 w-4 mr-1" />参加</Button>
              <Button size="sm" variant="outline" onClick={() => respond(i.id, false)}><X className="h-4 w-4 mr-1" />辞退</Button>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold">マイ組織</h2>
        {myOrgs.length === 0 && <Card className="p-6 text-sm text-muted-foreground">まだ所属組織はありません</Card>}
        {myOrgs.map((m: any) => (
          <Card key={m.organization?.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-bold">{m.organization?.name} <span className="text-[10px] ml-2 px-2 py-0.5 rounded bg-muted">{m.role}{m.suspended ? "（停止中）" : ""}</span></div>
              <div className="text-xs text-muted-foreground">{m.organization?.description}</div>
            </div>
            {["owner","admin"].includes(m.role) && (
              <Link to="/organizations/$orgId" params={{ orgId: m.organization?.id }} className="text-sm underline">管理 →</Link>
            )}
          </Card>
        ))}
      </section>
    </div>
  );
}