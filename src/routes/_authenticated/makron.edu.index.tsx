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
          .in("organization_id", ids),
      ]);
      // 設定が無い組織は「ON」とみなす（組織ホームのアプリ一覧と同じ扱い）
      const off = new Set((s ?? []).filter((r: any) => r.enabled === false).map((r: any) => r.organization_id));
      const role = new Map((mem ?? []).map((m: any) => [m.organization_id, m.role]));
      setOrgs(
        (o ?? [])
          .filter((x: any) => !off.has(x.id) && x.status === "approved")
          .map((x: any) => ({ ...x, role: role.get(x.id) })),
      );
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
              承認済みの組織に参加すると表示されます。組織の「アプリ管理」でOFFにされている場合は表示されません。
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
              {o.role && o.role !== "member" && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
                  {o.role === "owner" ? "所有者" : o.role === "admin" ? "管理者" : "先生"}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>
    </MakronShell>
  );
}
