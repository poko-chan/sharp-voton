import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Timer, Brain, Trophy, Users, Settings } from "lucide-react";

const STEPS = [
  {
    icon: BookOpen,
    title: "Study# へようこそ",
    body: "勉強記録・タイマー・演習・暗記カードなど、学習に必要な道具をひとつにまとめたアプリです。かんたんに使い方を紹介します。",
  },
  {
    icon: Timer,
    title: "勉強を記録する",
    body: "「タイマー」で集中時間を計り、「勉強記録」で教科・教材ごとの学習内容を残せます。記録はダッシュボードのグラフに自動で反映されます。",
  },
  {
    icon: Brain,
    title: "演習と暗記カード",
    body: "Markon の問題パックで演習し、暗記カードで復習。まちがえた問題は自動でまとめられ、効率よく復習できます。",
  },
  {
    icon: Trophy,
    title: "目標とレベル",
    body: "学習目標を設定すると進捗ゲージで達成度が見えます。勉強するほど XP とコインが貯まり、アイテムと交換できます。",
  },
  {
    icon: Users,
    title: "友だち・タイムライン",
    body: "フレンドと学習記録を共有したり、チャットで励まし合ったりできます。組織（学校・塾）に招待されると専用アプリも使えます。",
  },
  {
    icon: Settings,
    title: "設定でカスタマイズ",
    body: "テーマ・通知・言語・ログイン方法などは設定画面から変更できます。それでは、学習を始めましょう！",
  },
];

/** アカウント作成後に一度だけ表示するチュートリアル。 */
export function TutorialOverlay({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const step = STEPS[i];
  const Icon = step.icon;

  const finish = async () => {
    setBusy(true);
    if (user) {
      await supabase.from("profiles").update({ tutorial_done: true } as any).eq("id", user.id);
    }
    setBusy(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-background/90 backdrop-blur p-4">
      <Card className="w-full max-w-md p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <div className="text-xs text-muted-foreground">
            チュートリアル {i + 1} / {STEPS.length}
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight">{step.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, n) => (
            <span
              key={n}
              className={`h-1.5 flex-1 rounded-full transition ${n <= i ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish} disabled={busy}>
            スキップ
          </Button>
          <div className="flex gap-2">
            {i > 0 && (
              <Button variant="outline" onClick={() => setI(i - 1)} disabled={busy}>
                戻る
              </Button>
            )}
            {i < STEPS.length - 1 ? (
              <Button onClick={() => setI(i + 1)}>次へ</Button>
            ) : (
              <Button onClick={finish} disabled={busy}>
                はじめる
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default TutorialOverlay;
