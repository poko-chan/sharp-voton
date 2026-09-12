import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Brain,
  Check,
  Flame,
  Headphones,
  Keyboard,
  Languages,
  ListChecks,
  LockKeyhole,
  Mic2,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  Blocks,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  completeXLangLesson,
  loadXLangState,
  saveXLangState,
  XLANG_FORMATS,
  type XLangState,
} from "@/lib/xlang";

export const Route = createFileRoute("/_authenticated/xlang")({ component: XLangPage });

const FORMAT_ICONS = { Blocks, ListChecks, Headphones, Mic2, Brain, Keyboard } as const;

function XLangPage() {
  const { user, isAdmin } = useAuth();
  const [state, setState] = useState<XLangState | null>(null);
  const [started, setStarted] = useState(false);
  const [formats] = useState(() => [...XLANG_FORMATS].sort(() => Math.random() - 0.5));

  useEffect(() => {
    if (user && isAdmin) setState(loadXLangState(user.id));
  }, [user, isAdmin]);

  const finishLesson = (isCorrect: boolean) => {
    if (!user || !state) return;
    const next = completeXLangLesson(state, isCorrect);
    setState(next);
    saveXLangState(user.id, next);
    setStarted(false);
  };

  if (!isAdmin) return <ComingSoon />;
  if (!state) return null;

  const Icon = FORMAT_ICONS[formats[0].icon as keyof typeof FORMAT_ICONS];

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/.12),transparent_35%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/.45))]">
      <div className="mx-auto max-w-6xl space-y-8 p-5 md:p-8">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="outline" className="mb-3 border-primary/30 bg-primary/5 text-primary">
              管理者プレビュー
            </Badge>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Languages className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">Xlang</h1>
                <p className="text-sm text-muted-foreground">英語を、短く続けて、忘れにくく。</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4 text-primary" />
            今日の目標 1レッスン
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Flame} label="ストリーク" value={`${state.streak}日`} tone="text-orange-500" />
          <Metric icon={Sparkles} label="XP" value={`${state.xp}`} tone="text-primary" />
          <Metric icon={Trophy} label="クラウン" value={`${state.crownLevel} / 5`} tone="text-amber-500" />
          <Metric icon={RotateCcw} label="次の復習" value={state.nextReviewDate} tone="text-sky-500" />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <Card className="overflow-hidden border-primary/20 bg-background/80 shadow-xl shadow-primary/5">
            <div className="border-b border-border/60 bg-primary/[.04] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Micro lesson</p>
                  <h2 className="mt-2 text-2xl font-bold">Daily English · 5分</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    問題コンテンツを登録すると、ここに最適化されたレッスンが出題されます。
                  </p>
                </div>
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
                <span>レベル {state.difficulty} · {formats.length}形式をミックス</span>
                <span>{state.completedLessons % 3} / 3 回でクラウンアップ</span>
              </div>
              <Progress value={(state.completedLessons % 3) * 33.33} className="mt-2 h-2" />
            </div>
            <div className="p-6">
              {!started ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">出題エンジンの準備完了</p>
                    <p className="mt-1 text-sm text-muted-foreground">SRSの復習対象を優先して組み立てます。</p>
                  </div>
                  <Button onClick={() => setStarted(true)} className="gap-2">
                    <Play className="h-4 w-4" />
                    レッスンを開始
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <Icon className="h-4 w-4" /> 次の問題形式: {formats[0].label}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      問題データは未登録です。ここでは回答結果だけを記録して、学習ロジックを確認できます。
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={() => finishLesson(true)} className="flex-1 gap-2">
                      <Check className="h-4 w-4" /> 正解として完了
                    </Button>
                    <Button onClick={() => finishLesson(false)} variant="outline" className="flex-1 gap-2">
                      <RotateCcw className="h-4 w-4" /> 復習が必要
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="border-border/70 bg-background/70 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Adaptive engine</p>
                <h2 className="mt-2 text-xl font-bold">学習の仕組み</h2>
              </div>
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-6 space-y-5">
              <EngineRow label="正答率" value={`${state.accuracy}%`} progress={state.accuracy} />
              <EngineRow label="次回までの間隔" value={`${state.intervalDays}日`} progress={Math.min(100, state.intervalDays / 30 * 100)} />
              <div className="rounded-lg bg-muted/50 p-4 text-sm">
                <p className="font-semibold">難易度 {state.difficulty} / 5</p>
                <p className="mt-1 text-muted-foreground">正答率80%以上で上がり、55%未満で下がります。</p>
              </div>
            </div>
          </Card>
        </div>

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Learning path</p>
              <h2 className="mt-1 text-xl font-bold">英語の学習パス</h2>
            </div>
            <span className="text-sm text-muted-foreground">Unit 01</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["01", "First steps", "あいさつと基本表現", true],
              ["02", "Daily life", "日常のことば", state.completedLessons >= 3],
              ["03", "Real conversations", "会話を組み立てる", state.completedLessons >= 6],
            ].map(([number, title, description, unlocked]) => (
              <div key={number} className={`rounded-xl border p-4 ${unlocked ? "border-primary/30 bg-primary/5" : "border-border/60 bg-muted/30 opacity-65"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary">UNIT {number}</span>
                  {unlocked ? <Check className="h-4 w-4 text-primary" /> : <LockKeyhole className="h-4 w-4 text-muted-foreground" />}
                </div>
                <p className="mt-4 font-bold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ComingSoon() {
  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/.1),transparent_34%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/.45))]">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 p-5 md:p-12">
        <header className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Languages className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Xlang</h1>
            <p className="text-sm text-muted-foreground">英語を、短く続けて、忘れにくく。</p>
          </div>
        </header>
        <Card className="overflow-hidden border-primary/20 bg-background/80 p-7 shadow-xl shadow-primary/5 md:p-10">
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">準備中</Badge>
          <h2 className="mt-5 max-w-2xl text-3xl font-black tracking-tight md:text-4xl">あなたの英語学習を、毎日の習慣に。</h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">Xlangは、3〜5分のマイクロレッスンと間隔反復で、英語を無理なく定着させる学習サービスです。</p>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {[
              [Flame, "続ける仕組み", "ストリークとXPで毎日の学習を可視化"],
              [RotateCcw, "忘れる前に復習", "学習履歴から次の復習タイミングを調整"],
              [Sparkles, "あなたに合わせる", "正答率に応じて難易度を少しずつ最適化"],
              [ArrowRight, "学習パス", "単元とクラウンで次の目標を見える化"],
            ].map(([Icon, title, description]) => {
              const FeatureIcon = Icon as typeof Flame;
              return (
                <div key={title as string} className="flex gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
                  <FeatureIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div><p className="font-semibold">{title as string}</p><p className="mt-1 text-sm text-muted-foreground">{description as string}</p></div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4" />現在は管理者向けに仕組みを検証しています。</div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: string }) {
  return <Card className="flex items-center gap-3 border-border/60 bg-background/70 p-4"><Icon className={`h-5 w-5 ${tone}`} /><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold">{value}</p></div></Card>;
}

function EngineRow({ label, value, progress }: { label: string; value: string; progress: number }) {
  return <div><div className="mb-2 flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div><Progress value={progress} className="h-2" /></div>;
}
