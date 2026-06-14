import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, Coins, CheckCircle2, Sparkles, Filter } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/missions")({ component: MissionsPage });

// Templates come from DB (daily_mission_templates). Progress is computed live per category.
// バトル/チャット/OCR系は廃止
const HIDDEN_CATEGORIES = new Set(["battle", "ocr"]);
const HIDDEN_CODES = new Set(["chat_send_1", "chat_send_10"]);
const CATEGORY_LABELS: Record<string, string> = {
  all: "すべて", study: "学習", makron: "Makron", social: "ソーシャル",
  reflect: "ふりかえり", flash: "フラッシュ", focus: "集中", habit: "習慣",
  plan: "計画", goal: "目標", class: "クラス", meta: "ログイン", time: "時間帯",
  streak: "ストリーク", coin: "コイン", night: "夜活", morning: "朝活",
};

function MissionsPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [cat, setCat] = useState("all");
  const today = new Date().toISOString().slice(0, 10);

  const computeProgress = async (uid: string): Promise<Record<string, number>> => {
    const [{ data: logs }, { data: cards }, { data: stamps }, { data: ans }, { data: subs }, { data: refl }, { data: batt }] = await Promise.all([
      supabase.from("study_logs").select("duration_minutes").eq("user_id", uid).eq("date", today),
      supabase.from("flashcards").select("id, last_reviewed_at").eq("user_id", uid),
      supabase.from("habit_stamps").select("id").eq("user_id", uid).eq("date", today),
      (supabase as any).from("makron_answers").select("auto_correct, created_at").gte("created_at", today + "T00:00:00"),
      supabase.from("study_logs").select("subject_id").eq("user_id", uid).eq("date", today),
      supabase.from("daily_reflections").select("id").eq("user_id", uid).gte("created_at", today + "T00:00:00"),
      (supabase as any).from("quiz_battles").select("status, winner_id, created_at").gte("created_at", today + "T00:00:00").or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`),
    ]);
    const studyMin = (logs ?? []).reduce((s: number, r: any) => s + (r.duration_minutes ?? 0), 0);
    const reviewed = (cards ?? []).filter((c: any) => c.last_reviewed_at && c.last_reviewed_at.slice(0, 10) === today).length;
    const stampCount = (stamps ?? []).length;
    const mkAns = ans ?? [];
    const mkCorrect = mkAns.filter((a: any) => a.auto_correct).length;
    const subjects = new Set((subs ?? []).map((r: any) => r.subject_id).filter(Boolean)).size;
    const battlesPlayed = (batt ?? []).length;
    const battlesWon = (batt ?? []).filter((b: any) => b.winner_id === uid).length;
    return {
      study_10m: studyMin, study_30m: studyMin, study_60m: studyMin, study_120m: studyMin, study_180m: studyMin,
      makron_1q: mkAns.length, makron_5q: mkAns.length, makron_10q: mkAns.length, makron_20q: mkAns.length, makron_50q: mkAns.length,
      makron_correct_5: mkCorrect, makron_correct_20: mkCorrect,
      flashcard_10: reviewed, flashcard_50: reviewed,
      habit_stamp: stampCount, reflection: (refl ?? []).length,
      all_subjects: subjects, login: 1,
      battle_1: battlesPlayed, battle_3: battlesPlayed,
      battle_win_1: battlesWon, battle_win_3: battlesWon,
    };
  };

  const load = async () => {
    if (!user) return;
    const [{ data: tpl }, { data: claims }] = await Promise.all([
      (supabase as any).from("daily_mission_templates").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("daily_missions").select("kind").eq("user_id", user.id).eq("date", today).eq("completed", true),
    ]);
    setTemplates(tpl ?? []);
    setClaimed(new Set((claims ?? []).map((c: any) => c.kind)));
    setProgress(await computeProgress(user.id));
  };
  useEffect(() => { load(); }, [user?.id]);

  const claim = async (t: any) => {
    if (claimed.has(t.code)) return;
    const cur = progress[t.code] ?? 0;
    if (cur < t.target) return toast.error("まだ達成していません");
    await supabase.from("daily_missions").insert({
      user_id: user!.id, date: today, kind: t.code, target_value: t.target,
      reward_coins: t.reward_coins, progress: t.target, completed: true,
    });
    const { data: c } = await supabase.from("user_coins").select("balance, total_earned").eq("user_id", user!.id).maybeSingle();
    const bal = (c?.balance ?? 0) + t.reward_coins;
    const earned = (c?.total_earned ?? 0) + t.reward_coins;
    await supabase.from("user_coins").upsert({ user_id: user!.id, balance: bal, total_earned: earned });
    await (supabase as any).from("coin_transactions").insert({ user_id: user!.id, amount: t.reward_coins, reason: "mission:" + t.code });
    toast.success(`+${t.reward_coins} コイン獲得！`);
    load();
  };

  const cats = ["all", ...Array.from(new Set(templates.map((t) => t.category)))];
  const visible = cat === "all" ? templates : templates.filter((t) => t.category === cat);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-2"><Target /> デイリーミッション</h1>
      <p className="text-sm text-muted-foreground mb-4">毎日0時にリセット。{templates.length}個のミッションから自由に挑戦！</p>
      <div className="flex gap-1 flex-wrap mb-4">
        <Filter className="h-4 w-4 self-center text-muted-foreground" />
        {cats.map((c) => (
          <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} onClick={() => setCat(c)}>
            {CATEGORY_LABELS[c] ?? c}
          </Button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {visible.map((t) => {
          const cur = progress[t.code] ?? 0;
          const reached = cur >= t.target;
          const isClaimed = claimed.has(t.code);
          return (
            <Card key={t.id} className={`p-4 ${isClaimed ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" />{t.title}</div>
                  {t.description && <div className="text-[11px] text-muted-foreground">{t.description}</div>}
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{CATEGORY_LABELS[t.category] ?? t.category}</span>
              </div>
              <Progress value={Math.min(100, (cur / t.target) * 100)} className="mt-2 h-1.5" />
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-muted-foreground">{Math.min(cur, t.target)} / {t.target}</div>
                <div className="flex items-center gap-2">
                  <div className="text-xs flex items-center gap-1 text-amber-600 font-bold"><Coins className="w-3 h-3" />+{t.reward_coins}</div>
                  {t.reward_xp > 0 && <div className="text-[10px] text-primary">+{t.reward_xp}XP</div>}
                  <Button size="sm" disabled={isClaimed || !reached} onClick={() => claim(t)}>
                    {isClaimed ? <CheckCircle2 className="w-4 h-4" /> : reached ? "受取" : "未達"}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}