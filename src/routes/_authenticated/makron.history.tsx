import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MakronShell } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/makron/history")({ component: HistoryPage });

function HistoryPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).from("makron_sessions")
        .select("*, unit:makron_units(title, subject)")
        .eq("user_id", user.id).order("started_at", { ascending: false }).limit(100);
      setRows(data ?? []);
    })();
  }, [user?.id]);

  return (
    <MakronShell back="/makron/units" title="受験履歴">
      <div className="max-w-4xl mx-auto p-6 space-y-3">
        {rows.length === 0 && <Card className="p-8 text-center text-muted-foreground text-sm">まだ履歴はありません</Card>}
        {rows.map((r) => (
          <Card key={r.id} className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{r.unit?.title ?? "(削除済み)"}</div>
              <div className="text-[11px] text-muted-foreground">{new Date(r.started_at).toLocaleString("ja-JP")} — {r.unit?.subject ?? ""}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold tabular-nums">{r.total_score ?? "-"} / {r.total_points ?? "-"}</div>
              <div className="text-[10px] text-muted-foreground">+{r.xp_awarded} XP</div>
            </div>
            <Link to="/makron/result/$sessionId" params={{ sessionId: r.id }}>
              <Button size="sm" variant="outline">詳細</Button>
            </Link>
          </Card>
        ))}
      </div>
    </MakronShell>
  );
}