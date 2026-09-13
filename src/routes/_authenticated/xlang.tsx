import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ChevronRight, Flame, Heart, HeartCrack, Languages, LockKeyhole, Play, RotateCcw, Sparkles, Target, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { answerXLangQuestion, completeXLangLesson, loadXLangState, saveXLangState, type XLangState } from "@/lib/xlang";

export const Route = createFileRoute("/_authenticated/xlang")({ component: XLangPage });

const QUESTIONS = [
  { prompt: "Good morning!", answer: "おはよう！", choices: ["おやすみ！", "おはよう！", "ありがとう！", "またね！"] },
  { prompt: "I like music.", answer: "私は音楽が好きです。", choices: ["私は映画を見ます。", "私は本を読みます。", "私は音楽が好きです。", "私は料理をします。"] },
  { prompt: "Thank you very much.", answer: "どうもありがとう。", choices: ["どういたしまして。", "どうもありがとう。", "お元気ですか？", "また明日。"] },
  { prompt: "Where is the station?", answer: "駅はどこですか？", choices: ["駅はどこですか？", "駅に行きました。", "電車が好きです。", "これは駅です。"] },
  { prompt: "See you tomorrow!", answer: "また明日！", choices: ["こんにちは！", "また明日！", "お疲れさま！", "はじめまして！"] },
] as const;

function XLangPage() {
  const { user } = useAuth();
  const [state, setState] = useState<XLangState | null>(null);
  const [lesson, setLesson] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [complete, setComplete] = useState(false);
  useEffect(() => { if (user) setState(loadXLangState(user.id)); }, [user]);
  if (!state) return null;
  const question = QUESTIONS[index];
  const start = () => { setLesson(true); setIndex(0); setSelected(null); setScore(0); setComplete(false); };
  const answer = (value: string) => {
    if (selected) return;
    setSelected(value);
    if (value === question.answer) setScore((value) => value + 1);
    setState(answerXLangQuestion(state, value === question.answer));
  };
  const next = () => {
    if (!selected) return;
    if (index === QUESTIONS.length - 1) {
      const nextState = completeXLangLesson(state, score, QUESTIONS.length);
      setState(nextState);
      if (user) saveXLangState(user.id, nextState);
      setComplete(true);
    } else { setIndex((value) => value + 1); setSelected(null); }
  };
  if (lesson && complete) return <Complete state={state} score={score} onHome={() => setLesson(false)} onRetry={start} />;
  if (lesson) return <Lesson state={state} question={question} index={index} selected={selected} onAnswer={answer} onNext={next} onExit={() => setLesson(false)} />;
  const today = new Date().toISOString().slice(0, 10);
  const progress = state.dailyProgressDate === today ? state.dailyProgress : 0;
  return <div className="min-h-full bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/.14),transparent_35%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/.45))]"><div className="mx-auto max-w-6xl space-y-7 p-5 md:p-8"><header className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><Languages className="h-6 w-6" /></div><div><p className="text-sm font-bold text-primary">今日も一歩ずつ</p><h1 className="text-3xl font-black">Xlang</h1></div></div><div className="flex items-center gap-3 text-sm font-bold"><span className="flex items-center gap-1 text-orange-500"><Flame className="h-5 w-5 fill-current" />{state.streak}日</span><span className="flex items-center gap-1 text-rose-500"><Heart className="h-5 w-5 fill-current" />{state.hearts}</span><span className="text-primary">{state.xp} XP</span></div></header><section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]"><Card className="overflow-hidden border-primary/20 shadow-xl"><div className="bg-primary p-7 text-primary-foreground"><Badge className="border-0 bg-white/20 text-white">今日のレッスン</Badge><h2 className="mt-4 text-3xl font-black">基本のあいさつ</h2><p className="mt-2 text-primary-foreground/80">5問 · 約3分 · 初級</p><Progress value={Math.min(100, progress / state.dailyGoal * 100)} className="mt-6 h-3 bg-white/25 [&>div]:bg-white" /></div><div className="flex items-center justify-between gap-4 p-6"><div><p className="font-bold">学習を続けてストリークを守ろう</p><p className="mt-1 text-sm text-muted-foreground">正解するとXPを獲得できます。</p></div><Button size="lg" disabled={state.hearts === 0} onClick={start}><Play className="h-4 w-4 fill-current" />{state.hearts === 0 ? "ハート回復待ち" : "レッスン開始"}</Button></div></Card><Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Daily goal</p><h2 className="mt-2 text-xl font-bold">今日の目標</h2></div><Target className="h-6 w-6 text-primary" /></div><p className="mt-5 text-4xl font-black">{progress}<span className="ml-2 text-base font-normal text-muted-foreground">/ {state.dailyGoal} レッスン</span></p><Progress value={Math.min(100, progress / state.dailyGoal * 100)} className="mt-4 h-3" /></Card></section><section><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Learning path</p><h2 className="mt-1 text-xl font-bold">英語の学習パス</h2></div><span className="text-sm text-muted-foreground">Unit 1</span></div><div className="grid gap-3 sm:grid-cols-3">{["あいさつ", "日常会話", "会話チャレンジ"].map((title, item) => { const open = item === 0 || state.completedLessons >= item; return <Card key={title} className={`p-5 ${open ? "border-primary/30 bg-primary/5" : "bg-muted/30 opacity-65"}`}><div className="flex justify-between"><span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-black text-primary-foreground">{item + 1}</span>{open ? <Check className="h-5 w-5 text-primary" /> : <LockKeyhole className="h-4 w-4 text-muted-foreground" />}</div><p className="mt-5 font-bold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{item === 0 ? "Hello!" : item === 1 ? "Everyday life" : "Let's talk"}</p></Card>; })}</div></section></div></div>;
}

function Lesson({ state, question, index, selected, onAnswer, onNext, onExit }: { state: XLangState; question: (typeof QUESTIONS)[number]; index: number; selected: string | null; onAnswer: (value: string) => void; onNext: () => void; onExit: () => void }) {
  const correct = selected === question.answer;
  return <div className="min-h-full bg-[linear-gradient(180deg,hsl(var(--primary)/.08),hsl(var(--background))_35%)]"><div className="mx-auto max-w-2xl p-4 md:p-8"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={onExit} aria-label="レッスンを終了"><RotateCcw className="h-5 w-5" /></Button><Progress value={((index + (selected ? 1 : 0)) / QUESTIONS.length) * 100} className="h-3 flex-1" /><span className="flex items-center gap-1 text-rose-500"><Heart className="h-5 w-5 fill-current" />{state.hearts}</span></div><p className="mt-12 text-sm font-semibold text-muted-foreground">問題 {index + 1} / {QUESTIONS.length}</p><h1 className="mt-4 text-3xl font-black">日本語の意味を選んでください</h1><Card className="mt-8 p-8 text-center"><p className="text-3xl font-bold">{question.prompt}</p><p className="mt-3 text-sm text-muted-foreground">英語 → 日本語</p></Card><div className="mt-6 grid gap-3">{question.choices.map((choice) => { const answer = choice === question.answer; const chosen = choice === selected; const style = selected ? answer ? "border-emerald-500 bg-emerald-500/10" : chosen ? "border-rose-500 bg-rose-500/10" : "opacity-60" : "hover:border-primary"; return <Button key={choice} variant="outline" disabled={!!selected} onClick={() => onAnswer(choice)} className={`h-auto min-h-14 justify-start whitespace-normal p-4 text-left ${style}`}>{choice}</Button>; })}</div>{selected && <div className={`mt-6 rounded-xl border p-4 ${correct ? "border-emerald-500/40 bg-emerald-500/10" : "border-rose-500/40 bg-rose-500/10"}`}><p className="flex items-center gap-2 font-bold">{correct ? <Check className="h-5 w-5" /> : <HeartCrack className="h-5 w-5" />}{correct ? "正解！" : "もう一度覚えよう"}</p>{!correct && <p className="mt-1 text-sm">正解は「{question.answer}」です。</p>}<Button className="mt-4 w-full" onClick={onNext}>{index === QUESTIONS.length - 1 ? "レッスンを完了" : "次へ"}<ChevronRight className="h-4 w-4" /></Button></div>}</div></div>;
}

function Complete({ state, score, onHome, onRetry }: { state: XLangState; score: number; onHome: () => void; onRetry: () => void }) { return <div className="min-h-full bg-[linear-gradient(180deg,hsl(var(--primary)/.12),hsl(var(--background))_45%)]"><div className="mx-auto max-w-lg p-8 pt-16 text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-amber-400 text-white"><Trophy className="h-10 w-10" /></div><p className="mt-6 text-sm font-bold uppercase tracking-[.18em] text-primary">Lesson complete</p><h1 className="mt-2 text-4xl font-black">すごい！</h1><p className="mt-3 text-muted-foreground">今日のレッスンを完了しました。</p><div className="mt-8 grid grid-cols-3 gap-3"><Stat label="正解" value={`${score}/5`} /><Stat label="獲得XP" value={`+${score * 5 + 10}`} /><Stat label="ストリーク" value={`${state.streak}日`} /></div><div className="mt-8 flex gap-3"><Button className="flex-1" onClick={onHome}>学習パスへ</Button><Button variant="outline" className="flex-1" onClick={onRetry}>もう一度</Button></div></div></div>; }
function Stat({ label, value }: { label: string; value: string }) { return <Card className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-black">{value}</p></Card>; }
*** End Patch