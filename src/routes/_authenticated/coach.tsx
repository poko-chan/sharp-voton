import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Flame, BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { localDateStr, addDaysStr } from "@/lib/date";
import { isAiUsable, aiStream } from "@/lib/ai-provider";
import { AiUnavailable } from "@/components/AiUnavailable";

export const Route = createFileRoute("/_authenticated/coach")({
  component: CoachPage,
});

function CoachPage() {
  const { user } = useAuth();
  const [advice, setAdvice] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [canAi, setCanAi] = useState<boolean>(false);
  const [stats, setStats] = useState<{ streak: number; todayMin: number; weekMin: number; daysSince: number } | null>(null);

  useEffect(() => { isAiUsable().then(setCanAi); }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("study_logs")
      .select("date, duration_minutes")
      .eq("user_id", user.id)
      .gte("date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
      .then(({ data }) => {
        const rows = data ?? [];
        const today = localDateStr();
        const todayMin = rows.filter((r) => r.date === today).reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
        const dayMap = new Map<string, number>();
        rows.forEach((r) => dayMap.set(r.date, (dayMap.get(r.date) ?? 0) + (r.duration_minutes ?? 0)));
        let streak = 0;
        const base = new Date();
        for (let i = 0; i < 365; i++) {
          const k = addDaysStr(base, -i);
          if ((dayMap.get(k) ?? 0) > 0) streak++;
          else break;
        }
        let weekMin = 0;
        for (let i = 0; i < 7; i++) weekMin += dayMap.get(addDaysStr(base, -i)) ?? 0;
        const last = rows.reduce<string | null>((m, r) => (r.duration_minutes > 0 && (!m || r.date > m) ? r.date : m), null);
        const daysSince = last ? Math.floor((new Date(today + "T00:00:00").getTime() - new Date(last + "T00:00:00").getTime()) / 86400000) : 999;
        setStats({ streak, todayMin, weekMin, daysSince });
      });
  }, [user]);

  const ask = async () => {
    setLoading(true);
    try {
      const subjList = "—";
      const goalList = "—";
      const s = stats;
      const prompt = `あなたは優しく現実的なAI学習コーチです。次のユーザーに、今日できる小さな一歩を提案してください。

【最近の学習】
- 連続日数: ${s?.streak ?? 0} 日
- 今日: ${s?.todayMin ?? 0} 分 / 今週: ${s?.weekMin ?? 0} 分
- 最終学習からの経過: ${s?.daysSince ?? "—"} 日

【ルール】
- 説教はしない。共感→小さな提案の順
- 「5分だけやる」「1問だけ解く」「教科書を開くだけ」など、最小行動を1〜3個提案
- 全くやってない場合でも、罪悪感をあおらない
- 250字以内
- マークダウン記号 (** や ##) は使わない、ふつうの文`;
      setAdvice("");
      await aiStream(prompt, (partial) => setAdvice(partial));
    } catch (e: any) {
      toast.error(e.message ?? "失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Sparkles className="text-primary" />AI コーチ</h1>
        <p className="text-muted-foreground">勉強が続かない日も、小さな一歩を一緒に。</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox icon={<Flame />} label="連続日数" value={`${stats.streak} 日`} />
          <StatBox icon={<BookOpen />} label="今日" value={`${stats.todayMin} 分`} />
          <StatBox icon={<BookOpen />} label="今週" value={`${stats.weekMin} 分`} />
          <StatBox icon={<BookOpen />} label="最終学習" value={stats.daysSince > 90 ? "—" : `${stats.daysSince}日前`} />
        </div>
      )}

      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">今のあなたへのアドバイス</h2>
        {!canAi && <AiUnavailable feature="AI コーチ" />}
        {advice ? (
          <p className="whitespace-pre-wrap text-sm leading-7">{advice}</p>
        ) : (
          <p className="text-sm text-muted-foreground">ボタンを押すと、あなたの最近の学習状況をもとに優しい声かけと小さな目標を提案します。</p>
        )}
        <Button onClick={ask} disabled={loading || !canAi}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          コーチに相談する
        </Button>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="font-semibold">今日できること（勉強しなくてもOK）</h2>
        <ul className="text-sm space-y-2 list-disc pl-5">
          <li><Link to="/micro" className="text-primary underline">マイクロ学習</Link> — 1問1分。0分の日を作らない。</li>
          <li><Link to="/listen" className="text-primary underline">耳で学ぶ</Link> — AI要約を読むだけ／聞くだけ。</li>
          <li><Link to="/tutor" className="text-primary underline">AIチューター</Link> — 困っていることを話すだけ。</li>
        </ul>
      </Card>
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </Card>
  );
}
