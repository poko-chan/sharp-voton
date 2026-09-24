import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MakronShell } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { GraduationCap, ChevronRight, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/makron/edu/")({
  head: () => ({
    meta: [
      { title: "Makron for education — 組織を選択 | Study#" },
      { name: "description", content: "Makron for education を利用する学校・組織を選びます。" },
    ],
  }),
  component: EduHub,
});

function EduHub() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<any[] | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: mem } = await (supabase as any)
        .from("organization_members")
        .select("organization_id, role, suspended")
        .eq("user_id", user.id)
        .eq("suspended", false);
      const ids = (mem ?? []).map((m: any) => m.organization_id);
      if (!ids.length) return setOrgs([]);
      const [{ data: o }, { data: s }] = await Promise.all([
        (supabase as any).from("organizations").select("id, name, description, status").in("id", ids),
        (supabase as any)
          .from("org_app_settings")
          .select("organization_id, enabled")
          .eq("app_key", "edu")
          .eq("enabled", true)
          .in("organization_id", ids),
      ]);
      const on = new Set((s ?? []).map((r: any) => r.organization_id));
      setOrgs((o ?? []).filter((x: any) => on.has(x.id) && x.status === "approved"));
    })();
  }, [user?.id]);

  return (
    <MakronShell title="Makron for education" subtitle="組織を選択">
      <div className="max-w-2xl mx-auto p-6 space-y-3">
        {orgs === null && <div className="text-sm text-muted-foreground">読み込み中…</div>}
        {orgs?.length === 0 && (
          <Card className="p-8 text-center space-y-2">
            <Building2 className="h-8 w-8 mx-auto text-muted-foreground" />
            <div className="font-bold">利用できる組織がありません</div>
            <p className="text-xs text-muted-foreground">
              所属する組織の管理者が「アプリ管理」で Makron for education を ON にすると表示されます。
            </p>
          </Card>
        )}
        {orgs?.map((o) => (
          <Link key={o.id} to="/makron/edu/$orgId" params={{ orgId: o.id }} className="block">
            <Card className="p-4 flex items-center gap-3 hover:border-primary transition">
              <div className="h-11 w-11 rounded-xl bg-primary/15 grid place-items-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{o.name}</div>
                {o.description && (
                  <div className="text-xs text-muted-foreground truncate">{o.description}</div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>
    </MakronShell>
  );
}
