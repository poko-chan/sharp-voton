import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Rocket, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type Step = { key: string; label: string; hint: string; to: string; done: boolean };

const DISMISS_KEY = "study.gettingStarted.dismissed.v1";

/** はじめかたチェックリスト（初期設定の進み具合） */
export function GettingStartedCard() {
  const { user } = useAuth();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (!user || dismissed) return;
    (async () => {
      const [prof, logs, goals, decks, events] = await Promise.all([
        (supabase as any).rpc("my_profile_private"),
        supabase
          .from("study_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase.from("goals").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase
          .from("flashcard_decks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        (supabase as any)
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      const p = (prof.data ?? {}) as any;
      setSteps([
        {
          key: "avatar",
          label: "プロフィール写真を設定",
          hint: "アイコンを登録すると仲間に見つけてもらいやすくなります",
          to: "/settings",
          done: Boolean(p.avatar_url),
        },
        {
          key: "log",
          label: "最初の勉強を記録",
          hint: "タイマーで測るだけでも記録されます",
          to: "/timer",
          done: (logs.count ?? 0) > 0,
        },
        {
          key: "goal",
          label: "学習目標を作る",
          hint: "目標があると毎日の進み具合が見えます",
          to: "/goals",
          done: (goals.count ?? 0) > 0,
        },
        {
          key: "deck",
          label: "暗記カードを1つ作る",
          hint: "覚えたい内容をカードにしておきましょう",
          to: "/flashcards",
          done: (decks.count ?? 0) > 0,
        },
        {
          key: "event",
          label: "予定をカレンダーに入れる",
          hint: "当日の朝に通知でお知らせします",
          to: "/calendar",
          done: (events.count ?? 0) > 0,
        },
      ]);
    })();
  }, [user?.id, dismissed]);

  if (dismissed || !steps) return null;
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <Card className="liquid-card border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="h-4 w-4 text-primary" /> はじめかた
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          title="あとで"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* noop */
            }
            setDismissed(true);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Progress value={(doneCount / steps.length) * 100} className="h-2 flex-1" />
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {doneCount}/{steps.length}
          </span>
        </div>
        <div className="space-y-1">
          {steps.map((s) => (
            <Link
              key={s.key}
              to={s.to}
              className={`flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-accent ${s.done ? "opacity-60" : ""}`}
            >
              {s.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0">
                <span className={`block text-sm font-medium ${s.done ? "line-through" : ""}`}>
                  {s.label}
                </span>
                {!s.done && <span className="block text-xs text-muted-foreground">{s.hint}</span>}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
