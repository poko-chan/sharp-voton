import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Share2 } from "lucide-react";

export const Route = createFileRoute("/share/$token")({ component: SharedView });

function SharedView() {
  const { token } = useParams({ strict: false }) as { token: string };
  const [rows, setRows] = useState<Array<{ date: string; minutes: number; subject_name: string | null; color: string | null }>>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("share_study_summary", { _token: token });
      if (error) { setErr("リンクが無効か期限切れです"); return; }
      setRows((data as any) ?? []);
    })();
  }, [token]);

  const byDate = new Map<string, number>();
  for (const r of rows) byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.minutes);
  const sorted = Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  const total = rows.reduce((s, r) => s + r.minutes, 0);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Share2 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">学習状況（共有ビュー）</h1>
        </div>
        {err && <Card className="p-6 text-center text-muted-foreground">{err}</Card>}
        {!err && (
          <>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">直近30日 合計</div>
              <div className="text-3xl font-bold tabular-nums">{Math.floor(total/60)}h {total%60}m</div>
            </Card>
            <Card className="p-4">
              <h2 className="font-semibold mb-3">日別</h2>
              <div className="space-y-1.5">
                {sorted.map(([d, m]) => (
                  <div key={d} className="flex items-center gap-3 text-sm">
                    <span className="w-24 tabular-nums text-muted-foreground">{d}</span>
                    <div className="flex-1 h-3 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${Math.min(100, (m / 300) * 100)}%` }} />
                    </div>
                    <span className="w-16 text-right tabular-nums">{m}分</span>
                  </div>
                ))}
                {sorted.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">記録がありません</p>}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}