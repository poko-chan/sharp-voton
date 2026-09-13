import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
<<<<<<< HEAD
  Check,
  ChevronRight,
  Flame,
  Heart,
  HeartCrack,
  LockKeyhole,
  Languages,
  Play,
=======
  ArrowRight,
  BookOpen,
  Check,
  Coffee,
  Crown,
  Flame,
  Gem,
  Heart,
  Languages,
  LockKeyhole,
  MessageCircle,
  Plane,
>>>>>>> 928e33fa8724ee0583c4a930d3359d06897ff491
  RotateCcw,
  Sparkles,
  Star,
  Target,
  Trophy,
<<<<<<< HEAD
=======
  Volume2,
  type LucideIcon,
>>>>>>> 928e33fa8724ee0583c4a930d3359d06897ff491
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { LessonPlayer } from "@/components/xlang/LessonPlayer";
import { XLANG_UNITS, ALL_LESSONS, type XLesson } from "@/lib/xlang-content";
import {
<<<<<<< HEAD
  answerXLangQuestion,
  completeXLangLesson,
=======
  finishLesson,
>>>>>>> 928e33fa8724ee0583c4a930d3359d06897ff491
  loadXLangState,
  loseHeart,
  MAX_HEARTS,
  refillHearts,
  saveXLangState,
  speak,
  type XLangState,
} from "@/lib/xlang";

export const Route = createFileRoute("/_authenticated/xlang")({
  component: XLangPage,
  head: () => ({
    meta: [
      { title: "Xlang | 毎日つづく英語トレーニング - Study#" },
      {
        name: "description",
        content:
          "Xlang は 3〜5分のマイクロレッスンと間隔反復で英語を定着させる学習モード。並び替え・リスニング・発音・ペアマッチングを毎日続けられます。",
      },
      { property: "og:title", content: "Xlang | 毎日つづく英語トレーニング" },
      {
        property: "og:description",
        content: "ハート・ストリーク・クラウンで続く、ゲーム感覚の英語レッスン。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

<<<<<<< HEAD
const QUESTIONS = [
  { prompt: "Good morning!", translation: "おはよう！", choices: ["おやすみ！", "おはよう！", "ありがとう！", "またね！"] },
  { prompt: "I like music.", translation: "私は音楽が好きです。", choices: ["私は映画を見ます。", "私は本を読みます。", "私は音楽が好きです。", "私は料理をします。"] },
  { prompt: "Thank you very much.", translation: "どうもありがとう。", choices: ["どういたしまして。", "どうもありがとう。", "お元気ですか？", "また明日。"] },
  { prompt: "Where is the station?", translation: "駅はどこですか？", choices: ["駅はどこですか？", "駅に行きました。", "電車が好きです。", "これは駅です。"] },
  { prompt: "See you tomorrow!", translation: "また明日！", choices: ["こんにちは！", "また明日！", "お疲れさま！", "はじめまして！"] },
] as const;
=======
const LESSON_ICONS: Record<XLesson["icon"], LucideIcon> = {
  star: Star,
  book: BookOpen,
  chat: MessageCircle,
  trophy: Trophy,
  coffee: Coffee,
  plane: Plane,
};
>>>>>>> 928e33fa8724ee0583c4a930d3359d06897ff491

function XLangPage() {
  const { user } = useAuth();
  const [state, setState] = useState<XLangState | null>(null);
<<<<<<< HEAD
  const [started, setStarted] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [lessonDone, setLessonDone] = useState(false);
=======
  const [active, setActive] = useState<XLesson | null>(null);
  const [result, setResult] = useState<{
    lesson: XLesson;
    xp: number;
    correct: number;
    total: number;
    mistakes: string[];
  } | null>(null);
>>>>>>> 928e33fa8724ee0583c4a930d3359d06897ff491

  useEffect(() => {
    if (user) setState(loadXLangState(user.id));
  }, [user]);

<<<<<<< HEAD
  const answer = (choice: string) => {
    if (!state || selected) return;
    const current = QUESTIONS[questionIndex];
    const isCorrect = choice === current.translation;
    setSelected(choice);
    if (isCorrect) setCorrectAnswers((count) => count + 1);
    setState(answerXLangQuestion(state, isCorrect));
  };

  const nextQuestion = () => {
    if (!state || !selected) return;
    if (questionIndex === QUESTIONS.length - 1) {
      const score = correctAnswers + (selected === QUESTIONS[questionIndex].translation ? 1 : 0);
      const next = completeXLangLesson(state, score, QUESTIONS.length);
      setState(next);
      saveXLangState(user!.id, next);
      setLessonDone(true);
      return;
    }
    setQuestionIndex((index) => index + 1);
    setSelected(null);
  };

  const startLesson = () => {
    setStarted(true);
    setQuestionIndex(0);
    setSelected(null);
    setCorrectAnswers(0);
    setLessonDone(false);
  };

  if (!state) return null;

  const question = QUESTIONS[questionIndex];
  const isCorrect = selected === question.translation;
  const dailyProgress = state.dailyProgressDate === new Date().toISOString().slice(0, 10) ? state.dailyProgress : 0;

  if (started) {
    if (lessonDone) {
      return <LessonComplete state={state} score={correctAnswers} onContinue={() => setStarted(false)} onRetry={startLesson} />;
    }
    return (
      <div className="min-h-full bg-[linear-gradient(180deg,hsl(var(--primary)/.08),hsl(var(--background))_35%)]">
        <div className="mx-auto flex min-h-full max-w-2xl flex-col p-4 md:p-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setStarted(false)} aria-label="レッスンを終了"><RotateCcw className="h-5 w-5" /></Button>
            <Progress value={((questionIndex + (selected ? 1 : 0)) / QUESTIONS.length) * 100} className="h-3 flex-1" />
            <div className="flex items-center gap-1 text-rose-500"><Heart className="h-5 w-5 fill-current" />{state.hearts}</div>
          </div>
          <div className="mt-12 flex flex-1 flex-col">
            <p className="text-sm font-semibold text-muted-foreground">問題 {questionIndex + 1} / {QUESTIONS.length}</p>
            <h1 className="mt-4 text-3xl font-black tracking-tight">日本語の意味を選んでください</h1>
            <Card className="mt-8 border-primary/20 bg-background p-7 text-center shadow-lg shadow-primary/10">
              <p className="text-3xl font-bold tracking-tight">{question.prompt}</p>
              <p className="mt-3 text-sm text-muted-foreground">英語 → 日本語</p>
            </Card>
            <div className="mt-6 grid gap-3">
              {question.choices.map((choice) => {
                const correct = choice === question.translation;
                const chosen = choice === selected;
                const style = selected
                  ? correct ? "border-emerald-500 bg-emerald-500/10 text-emerald-700" : chosen ? "border-rose-500 bg-rose-500/10 text-rose-700" : "border-border/60 opacity-60"
                  : "border-border/70 bg-background hover:border-primary hover:bg-primary/5";
                return <Button key={choice} variant="outline" className={`h-auto min-h-14 justify-start whitespace-normal p-4 text-left ${style}`} onClick={() => answer(choice)} disabled={!!selected}>{choice}</Button>;
              })}
            </div>
            {selected && (
              <div className={`mt-6 rounded-xl border p-4 ${isCorrect ? "border-emerald-500/40 bg-emerald-500/10" : "border-rose-500/40 bg-rose-500/10"}`}>
                <div className="flex items-center gap-2 font-bold">{isCorrect ? <Check className="h-5 w-5" /> : <HeartCrack className="h-5 w-5" />}{isCorrect ? "正解！" : "もう一度覚えよう"}</div>
                {!isCorrect && <p className="mt-1 text-sm">正解は「{question.translation}」です。</p>}
                <Button className="mt-4 w-full" onClick={nextQuestion}>{questionIndex === QUESTIONS.length - 1 ? "レッスンを完了" : "次へ"}<ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/.14),transparent_35%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/.45))]">
      <div className="mx-auto max-w-6xl space-y-7 p-5 md:p-8">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"><Languages className="h-6 w-6" /></div><div><p className="text-sm font-bold text-primary">今日も一歩ずつ</p><h1 className="text-3xl font-black tracking-tight">Xlang</h1></div></div>
          <div className="flex items-center gap-3 text-sm font-semibold"><span className="flex items-center gap-1 text-orange-500"><Flame className="h-5 w-5 fill-current" />{state.streak}日</span><span className="flex items-center gap-1 text-rose-500"><Heart className="h-5 w-5 fill-current" />{state.hearts}</span><span className="text-primary">{state.xp} XP</span></div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
          <Card className="overflow-hidden border-primary/20 bg-background/90 shadow-xl shadow-primary/10">
            <div className="bg-primary p-6 text-primary-foreground md:p-8"><div className="flex items-start justify-between"><div><Badge className="border-0 bg-white/20 text-white">今日のレッスン</Badge><h2 className="mt-4 text-3xl font-black">基本のあいさつ</h2><p className="mt-2 text-primary-foreground/80">5問 · 約3分 · 初級</p></div><Sparkles className="h-9 w-9" /></div><div className="mt-6 flex items-center gap-3"><Progress value={Math.min(100, (dailyProgress / state.dailyGoal) * 100)} className="h-3 bg-white/25 [&>div]:bg-white" /><span className="text-sm font-bold">{dailyProgress}/{state.dailyGoal}</span></div></div>
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">学習を続けてストリークを守ろう</p><p className="mt-1 text-sm text-muted-foreground">正解するとXPを獲得できます。</p></div><Button size="lg" onClick={startLesson} className="gap-2"><Play className="h-4 w-4 fill-current" />レッスン開始</Button></div>
          </Card>
          <Card className="border-border/70 bg-background/80 p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Daily goal</p><h2 className="mt-2 text-xl font-bold">今日の目標</h2></div><Target className="h-6 w-6 text-primary" /></div><div className="mt-5 flex items-end gap-2"><span className="text-4xl font-black">{dailyProgress}</span><span className="mb-1 text-muted-foreground">/ {state.dailyGoal} レッスン</span></div><Progress value={Math.min(100, dailyProgress / state.dailyGoal * 100)} className="mt-4 h-3" /><p className="mt-3 text-sm text-muted-foreground">毎日少しずつが、いちばん強い。</p></Card>
        </section>

        <section><div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Learning path</p><h2 className="mt-1 text-xl font-bold">英語の学習パス</h2></div><span className="text-sm text-muted-foreground">Unit 1</span></div><div className="grid gap-3 sm:grid-cols-3">{[["あいさつ", "Hello!", true], ["日常会話", "Everyday life", state.completedLessons >= 1], ["会話チャレンジ", "Let's talk", state.completedLessons >= 3]].map(([title, subtitle, unlocked], index) => <Card key={title as string} className={`p-5 ${unlocked ? "border-primary/30 bg-primary/5" : "border-border/60 bg-muted/30 opacity-65"}`}><div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground">{index + 1}</span>{unlocked ? <Check className="h-5 w-5 text-primary" /> : <LockKeyhole className="h-4 w-4 text-muted-foreground" />}</div><p className="mt-5 font-bold">{title as string}</p><p className="mt-1 text-sm text-muted-foreground">{subtitle as string}</p></Card>)}</div></section>
      </div>
    </div>
  );
}

function LessonComplete({ state, score, onContinue, onRetry }: { state: XLangState; score: number; onContinue: () => void; onRetry: () => void }) {
  return <div className="min-h-full bg-[linear-gradient(180deg,hsl(var(--primary)/.12),hsl(var(--background))_45%)]"><div className="mx-auto flex max-w-lg flex-col items-center p-6 pt-16 text-center"><div className="grid h-20 w-20 place-items-center rounded-full bg-amber-400 text-white shadow-xl shadow-amber-400/30"><Trophy className="h-10 w-10" /></div><p className="mt-6 text-sm font-bold uppercase tracking-[.18em] text-primary">Lesson complete</p><h1 className="mt-2 text-4xl font-black">すごい！</h1><p className="mt-3 text-muted-foreground">今日のレッスンを完了しました。</p><div className="mt-8 grid w-full grid-cols-3 gap-3"><Metric label="正解" value={`${score}/5`} /><Metric label="獲得XP" value={`+${score * 5 + 10}`} /><Metric label="ストリーク" value={`${state.streak}日`} /></div><div className="mt-8 flex w-full flex-col gap-3 sm:flex-row"><Button className="flex-1" onClick={onContinue}>学習パスへ</Button><Button variant="outline" className="flex-1" onClick={onRetry}>もう一度</Button></div></div></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-black">{value}</p></Card>;
}

/*
  The former admin preview is intentionally kept below while the feature rolls out.
*/
/*
  const finishLesson = (isCorrect: boolean) => {
    if (!user || !state) return;
    const next = completeXLangLesson(state, isCorrect);
    setState(next);
    saveXLangState(user.id, next);
    setStarted(false);
=======
  const update = (fn: (s: XLangState) => XLangState) => {
    setState((prev) => {
      if (!prev || !user) return prev;
      const next = fn(prev);
      saveXLangState(user.id, next);
      return next;
    });
>>>>>>> 928e33fa8724ee0583c4a930d3359d06897ff491
  };

  const unlocked = useMemo(() => {
    const crowns = state?.lessonCrowns ?? {};
    const set = new Set<string>();
    let prevDone = true;
    for (const l of ALL_LESSONS) {
      if (prevDone) set.add(l.id);
      prevDone = (crowns[l.id] ?? 0) > 0;
    }
    return set;
  }, [state]);

  if (!isAdmin) return <ComingSoon />;
  if (!state) return null;

  const goalPct = Math.min(100, (state.dailyXp / state.dailyGoal) * 100);
  const totalLessons = ALL_LESSONS.length;
  const doneLessons = ALL_LESSONS.filter((l) => (state.lessonCrowns[l.id] ?? 0) > 0).length;

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/.12),transparent_35%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/.45))]">
      <div className="mx-auto max-w-6xl space-y-8 p-5 md:p-8">
        <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Languages className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight">Xlang</h1>
                <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                  管理者プレビュー
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">英語を、短く続けて、忘れにくく。</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill icon={Flame} tone="text-orange-500" value={`${state.streak}`} label="日" />
            <Pill icon={Gem} tone="text-sky-500" value={`${state.gems}`} label="ジェム" />
            <Pill icon={Crown} tone="text-amber-500" value={`${state.crownLevel}`} label="クラウン" />
            <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-sm font-bold">
              {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                <Heart
                  key={i}
                  className={cn(
                    "h-4 w-4",
                    i < state.hearts ? "fill-rose-500 text-rose-500" : "text-muted-foreground/40",
                  )}
                />
              ))}
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
          <Card className="border-primary/20 bg-background/80 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Target className="h-4 w-4 text-primary" /> 今日の目標
              </div>
              <span className="text-sm text-muted-foreground">
                {state.dailyXp} / {state.dailyGoal} XP
              </span>
            </div>
            <Progress value={goalPct} className="mt-3 h-3" />
            <div className="mt-4 flex flex-wrap gap-2">
              {[20, 30, 50].map((g) => (
                <Button
                  key={g}
                  size="sm"
                  variant={state.dailyGoal === g ? "default" : "outline"}
                  onClick={() => update((s) => ({ ...s, dailyGoal: g }))}
                >
                  {g} XP / 日
                </Button>
              ))}
            </div>
          </Card>

          <Card className="bg-background/70 p-5">
            <div className="grid grid-cols-2 gap-4 text-center">
              <Stat label="正答率" value={`${state.accuracy}%`} />
              <Stat label="レベル" value={`${state.difficulty} / 5`} />
              <Stat label="完了レッスン" value={`${doneLessons} / ${totalLessons}`} />
              <Stat label="次の復習" value={state.nextReviewDate.slice(5)} />
            </div>
          </Card>
        </div>

        {state.hearts === 0 && (
          <Card className="flex flex-col gap-3 border-rose-500/30 bg-rose-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-rose-600">ハートが なくなりました</p>
              <p className="text-sm text-muted-foreground">
                20分ごとに1つ回復します。ジェム5個ですぐ全回復できます。
              </p>
            </div>
            <Button
              disabled={state.gems < 5}
              onClick={() => update((s) => refillHearts({ ...s, gems: s.gems - 5 }))}
              className="gap-2"
            >
              <Gem className="h-4 w-4" /> ジェム5でかいふく
            </Button>
          </Card>
        )}

        {XLANG_UNITS.map((unit) => (
          <section key={unit.id}>
            <div
              className={cn(
                "mb-5 flex items-end justify-between rounded-2xl bg-gradient-to-r p-5",
                unit.hue,
              )}
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-muted-foreground">
                  UNIT {unit.number}
                </p>
                <h2 className="mt-1 text-2xl font-black">{unit.title}</h2>
                <p className="text-sm text-muted-foreground">{unit.subtitle}</p>
              </div>
              <span className="text-sm font-semibold text-muted-foreground">
                {unit.lessons.filter((l) => (state.lessonCrowns[l.id] ?? 0) > 0).length} /{" "}
                {unit.lessons.length}
              </span>
            </div>

            <div className="relative mx-auto flex max-w-xl flex-col items-center gap-6">
              {unit.lessons.map((lesson, i) => {
                const crowns = state.lessonCrowns[lesson.id] ?? 0;
                const open = unlocked.has(lesson.id);
                const Icon = LESSON_ICONS[lesson.icon];
                const offset = ["translate-x-0", "translate-x-16", "-translate-x-16"][i % 3];
                return (
                  <div key={lesson.id} className={cn("flex flex-col items-center", offset)}>
                    <button
                      disabled={!open || state.hearts === 0}
                      onClick={() => setActive(lesson)}
                      aria-label={`${lesson.title} のレッスンを開始`}
                      className={cn(
                        "grid h-20 w-20 place-items-center rounded-full border-b-[6px] transition-all active:translate-y-1 disabled:cursor-not-allowed",
                        crowns >= 3
                          ? "border-amber-600 bg-amber-400 text-amber-950"
                          : open
                            ? "border-primary/70 bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110"
                            : "border-border bg-muted text-muted-foreground opacity-70",
                      )}
                    >
                      {open ? <Icon className="h-8 w-8" /> : <LockKeyhole className="h-7 w-7" />}
                    </button>
                    <p className="mt-2 text-sm font-bold">{lesson.title}</p>
                    <div className="flex gap-0.5">
                      {[0, 1, 2].map((c) => (
                        <Crown
                          key={c}
                          className={cn(
                            "h-3.5 w-3.5",
                            c < crowns ? "fill-amber-400 text-amber-500" : "text-muted-foreground/30",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <Card className="bg-background/70 p-5">
          <div className="flex items-center gap-2 font-bold">
            <Volume2 className="h-4 w-4 text-primary" /> 音声チェック
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            端末の読み上げ機能を使っています。聞こえない場合は音量を確認してください。
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => speak("Hello! Let's study English.")}>
            テスト再生
          </Button>
        </Card>
      </div>

      {active && (
        <LessonPlayer
          lesson={active}
          hearts={state.hearts}
          onWrong={() => update(loseHeart)}
          onExit={() => setActive(null)}
          onComplete={(r) => {
            const res = finishLesson(state, {
              lessonId: active.id,
              correct: r.correct,
              total: r.total,
              perfect: r.perfect,
            });
            update(() => res.state);
            setResult({
              lesson: active,
              xp: res.gainedXp,
              correct: r.correct,
              total: r.total,
              mistakes: r.mistakes,
            });
            setActive(null);
          }}
        />
      )}

      {result && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-5 backdrop-blur">
          <Card className="w-full max-w-md p-7 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-400 text-amber-950">
              <Trophy className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-2xl font-black">レッスン完了！</h2>
            <p className="mt-1 text-sm text-muted-foreground">{result.lesson.title}</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Stat label="獲得XP" value={`+${result.xp}`} />
              <Stat
                label="正答率"
                value={`${Math.round((result.correct / Math.max(1, result.total)) * 100)}%`}
              />
              <Stat label="ストリーク" value={`${state.streak}日`} />
            </div>
            {result.mistakes.length > 0 && (
              <div className="mt-5 rounded-xl bg-muted/60 p-3 text-left text-sm">
                <p className="font-semibold">復習したい問題</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {result.mistakes.slice(0, 5).map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6 flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => {
                  const l = result.lesson;
                  setResult(null);
                  setActive(l);
                }}
              >
                <RotateCcw className="h-4 w-4" /> もう一度
              </Button>
              <Button className="flex-1 gap-2" onClick={() => setResult(null)}>
                つづける <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Pill({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-sm font-bold">
      <Icon className={cn("h-4 w-4", tone)} />
      {value}
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}
*/

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
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
            準備中
          </Badge>
          <h2 className="mt-5 max-w-2xl text-3xl font-black tracking-tight md:text-4xl">
            あなたの英語学習を、毎日の習慣に。
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Xlangは、3〜5分のマイクロレッスンと間隔反復で、英語を無理なく定着させる学習サービスです。
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {[
              [Flame, "続ける仕組み", "ストリークとXPで毎日の学習を可視化"],
              [RotateCcw, "忘れる前に復習", "間違えた問題をその場で再出題"],
              [Sparkles, "あなたに合わせる", "正答率に応じて難易度を最適化"],
              [Check, "6つの出題形式", "並び替え・選択・リスニング・発音など"],
            ].map(([Icon, title, description]) => {
              const FeatureIcon = Icon as LucideIcon;
              return (
                <div
                  key={title as string}
                  className="flex gap-3 rounded-xl border border-border/60 bg-muted/30 p-4"
                >
                  <FeatureIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-semibold">{title as string}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{description as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <LockKeyhole className="h-4 w-4" />
            現在は管理者向けに仕組みを検証しています。
          </div>
        </Card>
      </div>
    </div>
  );
}
