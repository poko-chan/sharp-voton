import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, Coins, CheckCircle2, Sparkles, Filter } from "lucide-react";
import { toast } from "sonner";
import { jstDateStr } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/missions")({ component: MissionsPage });

// Templates come from DB (daily_mission_templates). Progress is computed live per category.
// バトル/チャット/OCR系は廃止
const HIDDEN_CATEGORIES = new Set(["battle", "ocr", "habit", "reflect"]);
const HIDDEN_CODES = new Set(["chat_send_1", "chat_send_10"]);
const CATEGORY_LABELS: Record<string, string> = {
  all: "すべて", study: "学習", makron: "Makron", social: "ソーシャル",
  reflect: "ふりかえり", flash: "フラッシュ", focus: "集中",
  plan: "計画", goal: "目標", class: "クラス", meta: "ログイン", time: "時間帯",
  streak: "ストリーク", coin: "コイン", night: "夜活", morning: "朝活",
};

function MissionsPage() {
  const { user } = useAuth();
  const claimingRef = useRef<Set<string>>(new Set());
  const [templates, setTemplates] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [cat, setCat] = useState("all");
  // 日本時間でリセットされるように JST 基準の日付を使う
  const today = jstDateStr();

  const computeProgress = async (uid: string): Promise<Record<string, number>> => {
    const [{ data: logs }, { data: cards }, { data: ans }, { data: subs }] = await Promise.all([
      supabase.from("study_logs").select("duration_minutes").eq("user_id", uid).eq("date", today),
      supabase.from("flashcards").select("id, last_reviewed_at").eq("user_id", uid),
      (supabase as any).from("makron_answers").select("auto_correct, created_at").gte("created_at", today + "T00:00:00"),
      supabase.from("study_logs").select("subject_id").eq("user_id", uid).eq("date", today),
    ]);
    const studyMin = (logs ?? []).reduce((s: number, r: any) => s + (r.duration_minutes ?? 0), 0);
    const reviewed = (cards ?? []).filter((c: any) => c.last_reviewed_at && c.last_reviewed_at.slice(0, 10) === today).length;
    const mkAns = ans ?? [];
    const mkCorrect = mkAns.filter((a: any) => a.auto_correct).length;
    const subjects = new Set((subs ?? []).map((r: any) => r.subject_id).filter(Boolean)).size;
    return {
      study_10m: studyMin, study_30m: studyMin, study_60m: studyMin, study_120m: studyMin, study_180m: studyMin,
      makron_1q: mkAns.length, makron_5q: mkAns.length, makron_10q: mkAns.length, makron_20q: mkAns.length, makron_50q: mkAns.length,
      makron_correct_5: mkCorrect, makron_correct_20: mkCorrect,
      flashcard_10: reviewed, flashcard_50: reviewed,
      all_subjects: subjects, login: 1,
    };
  };

  const load = async () => {
    if (!user) return;
    const [{ data: tpl }, { data: claims }] = await Promise.all([
      (supabase as any).from("daily_mission_templates").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("daily_missions").select("kind").eq("user_id", user.id).eq("date", today).eq("completed", true),
    ]);
    setTemplates((tpl ?? []).filter((t: any) => !HIDDEN_CATEGORIES.has(t.category) && !HIDDEN_CODES.has(t.code)));
    setClaimed(new Set((claims ?? []).map((c: any) => c.kind)));
    setProgress(await computeProgress(user.id));
  };
  useEffect(() => { load(); }, [user?.id]);

  const claim = async (t: any) => {
    if (claimed.has(t.code) || claimingRef.current.has(t.code)) return;
    const cur = progress[t.code] ?? 0;
    if (cur < t.target) return toast.error("まだ達成していません");
    // クライアント側の二重送信防止
    claimingRef.current.add(t.code);
    setClaimed((prev) => new Set(prev).add(t.code));
    try {
      // サーバー側(DB)でも冪等: daily_missions の (user_id, date, kind) 一意制約により
      // 既に受取済みなら再付与されない
      const { data, error } = await (supabase as any).rpc("claim_daily_mission", {
        _kind: t.code, _date: today, _target: t.target, _reward_coins: t.reward_coins,
      });
      if (error) {
        toast.error(error.message);
        setClaimed((prev) => { const n = new Set(prev); n.delete(t.code); return n; });
        return;
      }
      if (data?.already_claimed) {
        toast.info("既に受け取り済みです");
      } else {
        toast.success(`+${data?.awarded ?? t.reward_coins} コイン獲得！`);
      }
      load();
    } finally {
      claimingRef.current.delete(t.code);
    }
  };

  const cats = ["all", ...Array.from(new Set(templates.map((t) => t.category)))];
  const visible = cat === "all" ? templates : templates.filter((t) => t.category === cat);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-2"><Target /> デイリーミッション</h1>
      <p className="text-sm text-muted-foreground mb-4">
        毎日0時にリセット。{templates.length}個のミッションから自由に挑戦！<br />
        <span className="text-xs">※「学習計画」=「学習」ページで作る今日のToDo / 「ふりかえり」=「ダッシュボード」で今日の学習をふりかえる機能です。</span>
      </p>
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