import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, Coins, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/missions")({ component: MissionsPage });

const TEMPLATES = [
  { kind: "study_30min", label: "30分勉強する", target: 30, reward: 10 },
  { kind: "review_cards", label: "暗記カード10枚復習", target: 10, reward: 8 },
  { kind: "log_today", label: "今日の記録を1件追加", target: 1, reward: 5 },
  { kind: "habit_stamp", label: "習慣スタンプを1つ", target: 1, reward: 5 },
];

function MissionsPage() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<any[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  const computeProgress = async (uid: string) => {
    const [{ data: logs }, { data: cards }, { data: stamps }] = await Promise.all([
      supabase.from("study_logs").select("duration_minutes").eq("user_id", uid).eq("date", today),
      supabase.from("flashcards").select("id, last_reviewed_at").eq("user_id", uid),
      supabase.from("habit_stamps").select("id").eq("user_id", uid).eq("date", today),
    ]);
    const studyMin = (logs ?? []).reduce((s: number, r: any) => s + (r.duration_minutes ?? 0), 0);
    const reviewed = (cards ?? []).filter((c: any) => c.last_reviewed_at && c.last_reviewed_at.slice(0, 10) === today).length;
    const logCount = (logs ?? []).length;
    const stampCount = (stamps ?? []).length;
    return { study_30min: studyMin, review_cards: reviewed, log_today: logCount, habit_stamp: stampCount } as Record<string, number>;
  };

  const load = async () => {
    if (!user) return;
    const { data: existing } = await supabase.from("daily_missions").select("*").eq("user_id", user.id).eq("date", today);
    let rows = existing ?? [];
    if (rows.length === 0) {
      await supabase.from("daily_missions").insert(
        TEMPLATES.map((t) => ({ user_id: user.id, date: today, kind: t.kind, target_value: t.target, reward_coins: t.reward }))
      );
      const { data: again } = await supabase.from("daily_missions").select("*").eq("user_id", user.id).eq("date", today);
      rows = again ?? [];
    }
    const prog = await computeProgress(user.id);
    // sync progress to DB for any non-completed mission
    await Promise.all(
      rows.filter((m: any) => !m.completed).map((m: any) => {
        const p = Math.min(prog[m.kind] ?? 0, m.target_value);
        if (p !== m.progress) return supabase.from("daily_missions").update({ progress: p }).eq("id", m.id);
        return Promise.resolve();
      })
    );
    rows = rows.map((m: any) => ({ ...m, progress: m.completed ? m.target_value : Math.min(prog[m.kind] ?? 0, m.target_value) }));
    setMissions(rows);
  };
  useEffect(() => { load(); }, [user?.id]);

  const claim = async (m: any) => {
    if (m.completed) return;
    if ((m.progress ?? 0) < m.target_value) {
      toast.error("まだ達成していません");
      return;
    }
    await supabase.from("daily_missions").update({ completed: true, progress: m.target_value }).eq("id", m.id);
    const { data: c } = await supabase.from("user_coins").select("balance").eq("user_id", user!.id).maybeSingle();
    const bal = (c?.balance ?? 0) + m.reward_coins;
    await supabase.from("user_coins").upsert({ user_id: user!.id, balance: bal });
    toast.success(`+${m.reward_coins} コイン獲得！`);
    load();
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2"><Target /> デイリーミッション</h1>
      <p className="text-sm text-muted-foreground mb-4">毎日0時にリセット。条件を達成すると「完了」ボタンが押せます。</p>
      <div className="space-y-3">
        {missions.map((m) => {
          const tpl = TEMPLATES.find((t) => t.kind === m.kind);
          const reached = (m.progress ?? 0) >= m.target_value;
          return (
            <Card key={m.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="font-medium">{tpl?.label ?? m.kind}</div>
                <Progress value={(m.progress / m.target_value) * 100} className="mt-2 h-2" />
                <div className="text-xs text-muted-foreground mt-1">{m.progress} / {m.target_value}</div>
              </div>
              <div className="text-sm flex items-center gap-1"><Coins className="w-4 h-4" />+{m.reward_coins}</div>
              <Button size="sm" disabled={m.completed || !reached} onClick={() => claim(m)}>
                {m.completed ? <CheckCircle2 className="w-4 h-4" /> : reached ? "受取" : "未達成"}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}