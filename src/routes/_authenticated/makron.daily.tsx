import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MakronShell } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Flame, CheckCircle2, Play, Gift, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/makron/daily")({ component: DailyPage });

type Status = { date: string; completed: boolean; streak: number; total_questions: number; best_score?: number; attempts?: number; can_retry?: boolean };

function DailyPage() {
  const nav = useNavigate();
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Array<{ date: string; score: number; total: number }>>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).rpc("makron_daily_status");
      if (data && data[0]) setS(data[0]);
      const { data: h } = await (supabase as any)
        .from("makron_daily_completions")
        .select("date, score, total")
        .order("date", { ascending: false })
        .limit(14);
      setHistory(h ?? []);
    })();
  }, []);

  const start = async () => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("makron_start_daily_session");
    setBusy(false);
    if (error) {
      if (error.message?.includes("today_completed")) return toast.info("今日はもう完了しています！");
      if (error.message?.includes("today_retry_used")) return toast.info("今日の再挑戦は終了しました（1日2回まで）");
      if (error.message?.includes("no_questions_available")) return toast.error("デイリー問題がまだ用意されていません");
      return toast.error(error.message);
    }
    nav({ to: "/makron/session/$sessionId", params: { sessionId: data } });
  };

  return (
    <MakronShell title="デイリー演習" subtitle="毎日10問・完了で +50XP / +20コイン" back="/makron">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Card className="p-6 bg-gradient-to-br from-primary/15 to-amber-500/10 border-primary/30">
          <div className="flex items-center gap-4">
            <CalendarDays className="h-12 w-12 text-primary" />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">{s?.date}</div>
              <div className="text-2xl font-bold mt-0.5">
                {s?.completed
                  ? "今日のデイリーは完了済み"
                  : s?.can_retry
                  ? `再挑戦できます (${s?.best_score ?? 0} / ${s?.total_questions ?? 0}点)`
                  : `今日のデイリー演習 (${s?.total_questions ?? 0}問)`}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center text-amber-600">
                <Flame className="h-5 w-5" />
                <span className="text-3xl font-black tabular-nums">{s?.streak ?? 0}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">連続記録</div>
            </div>
          </div>
          <div className="mt-5">
            {s?.completed ? (
              <div className="flex items-center gap-2 text-green-600 font-bold">
                <CheckCircle2 className="h-5 w-5" /> 明日また挑戦しましょう
              </div>
            ) : (
              <>
                <Button size="lg" className="w-full" onClick={start} disabled={busy || !s || s.total_questions === 0}>
                  <Play className="h-5 w-5 mr-2" />
                  {busy ? "開始中..." : s?.can_retry ? "もう一回挑戦する（最後の1回）" : "デイリー演習を始める"}
                </Button>
                {s?.can_retry && (
                  <div className="text-[11px] text-muted-foreground mt-2 text-center">
                    満点ではなかったので、もう1回だけ再挑戦できます。
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3 font-bold"><Gift className="h-4 w-4 text-primary" />報酬</div>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• 正解ごとに通常のXP / コインを獲得</li>
            <li>• 完了で <span className="font-bold text-foreground">+50XP / +20コイン</span> のボーナス</li>
            <li>• 連続日数（ストリーク）はプロフィールに反映</li>
          </ul>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3 font-bold"><Trophy className="h-4 w-4 text-amber-500" />最近の記録</div>
          {history.length === 0 ? (
            <div className="text-sm text-muted-foreground">まだ記録がありません</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {history.map((h) => (
                <li key={h.date} className="py-2 flex items-center justify-between text-sm">
                  <span className="tabular-nums">{h.date}</span>
                  <span className="font-bold tabular-nums">{h.score} / {h.total}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="text-center">
          <Link to="/makron"><Button variant="ghost" size="sm">Makronトップへ</Button></Link>
        </div>
      </div>
    </MakronShell>
  );
}