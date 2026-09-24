import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/org-apps";
import { MakronShell } from "@/components/makron/MakronShell";
import { OrgEdu } from "@/components/org/OrgEdu";
import { OrgMakron } from "@/components/org/OrgMakron";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ClipboardList, Trophy, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/makron/edu/$orgId")({
  head: () => ({
    meta: [
      { title: "Makron for education | Study#" },
      { name: "description", content: "組織専用の問題演習・課題・成績・ランキング。" },
    ],
  }),
  component: EduOrgPage,
});

type Tab = "learn" | "tasks" | "rank" | "grades";

function EduOrgPage() {
  const { orgId } = Route.useParams();
  const ctx = useOrg(orgId);
  const [tab, setTab] = useState<Tab>("learn");

  if (ctx.loading) return <div className="p-6 text-sm text-muted-foreground">読み込み中…</div>;
  if (!ctx.myRole && !ctx.canAdmin)
    return <div className="p-6 text-sm text-muted-foreground">この組織に参加していません。</div>;

  const tabs: { k: Tab; label: string; icon: any; staff?: boolean }[] = [
    { k: "learn", label: "学習", icon: BookOpen },
    { k: "tasks", label: "課題", icon: ClipboardList },
    { k: "rank", label: "ランキング", icon: Trophy },
    { k: "grades", label: "成績一覧", icon: BarChart3, staff: true },
  ];

  return (
    <MakronShell title="Makron for education" subtitle={ctx.org?.name ?? ""}>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/makron/edu" className="text-xs underline text-muted-foreground mr-2">
            ← 組織を選び直す
          </Link>
          {tabs
            .filter((t) => !t.staff || ctx.isStaff)
            .map((t) => (
              <Button
                key={t.k}
                size="sm"
                variant={tab === t.k ? "default" : "outline"}
                onClick={() => setTab(t.k)}
              >
                <t.icon className="h-4 w-4 mr-1" />
                {t.label}
              </Button>
            ))}
        </div>
        {tab === "learn" && <OrgEdu orgId={orgId} ctx={ctx} />}
        {tab === "tasks" && <OrgMakron orgId={orgId} ctx={ctx} />}
        {tab === "rank" && <Ranking orgId={orgId} />}
        {tab === "grades" && ctx.isStaff && <Grades orgId={orgId} />}
      </div>
    </MakronShell>
  );
}

function Ranking({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    (supabase as any)
      .rpc("org_edu_ranking", { _org: orgId })
      .then(({ data }: any) => setRows(data ?? []));
  }, [orgId]);
  if (!rows) return <div className="text-sm text-muted-foreground">読み込み中…</div>;
  if (!rows.length)
    return <Card className="p-8 text-center text-sm text-muted-foreground">まだ記録がありません</Card>;
  return (
    <Card className="divide-y">
      {rows.map((r, i) => (
        <div key={r.user_id} className="flex items-center gap-3 p-3">
          <div
            className={`w-8 text-center font-extrabold ${i < 3 ? "text-primary text-lg" : "text-muted-foreground"}`}
          >
            {i + 1}
          </div>
          <div className="flex-1 font-medium truncate">{r.display_name}</div>
          <div className="text-xs text-muted-foreground">🔥{r.current_streak}日</div>
          <div className="text-xs text-muted-foreground w-16 text-right">正解 {r.total_correct}</div>
          <div className="font-bold w-20 text-right">{r.xp} XP</div>
        </div>
      ))}
    </Card>
  );
}

function Grades({ orgId }: { orgId: string }) {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("org_edu_attempts")
        .select("user_id, correct, created_at")
        .eq("organization_id", orgId)
        .limit(5000);
      setAttempts(data ?? []);
      const ids = [...new Set((data ?? []).map((a: any) => a.user_id))];
      if (ids.length) {
        const { data: p } = await (supabase as any)
          .from("profiles")
          .select("id, display_name")
          .in("id", ids);
        const m: Record<string, string> = {};
        for (const x of p ?? []) m[x.id] = x.display_name ?? "ユーザー";
        setNames(m);
      }
    })();
  }, [orgId]);

  const rows = useMemo(() => {
    const m: Record<string, { total: number; ok: number; last: string }> = {};
    for (const a of attempts) {
      const r = (m[a.user_id] ??= { total: 0, ok: 0, last: a.created_at });
      r.total++;
      if (a.correct) r.ok++;
      if (a.created_at > r.last) r.last = a.created_at;
    }
    return Object.entries(m).sort((a, b) => b[1].total - a[1].total);
  }, [attempts]);

  if (!rows.length)
    return <Card className="p-8 text-center text-sm text-muted-foreground">まだ解答がありません</Card>;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="text-left p-2">生徒</th>
            <th className="p-2">解答数</th>
            <th className="p-2">正解数</th>
            <th className="p-2">正答率</th>
            <th className="p-2">最終解答</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([uid, r]) => {
            const pct = Math.round((r.ok / r.total) * 100);
            return (
              <tr key={uid} className="border-t">
                <td className="p-2 font-medium">{names[uid] ?? "ユーザー"}</td>
                <td className="p-2 text-center">{r.total}</td>
                <td className="p-2 text-center">{r.ok}</td>
                <td className={`p-2 text-center font-bold ${pct < 50 ? "text-destructive" : ""}`}>
                  {pct}%
                </td>
                <td className="p-2 text-center text-xs text-muted-foreground">
                  {new Date(r.last).toLocaleDateString("ja-JP")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
