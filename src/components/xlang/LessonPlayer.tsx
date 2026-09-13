import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Heart, Volume2, X, Mic2, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { normalize, type XEx, type XLesson } from "@/lib/xlang-content";
import { speak } from "@/lib/xlang";
import { cn } from "@/lib/utils";

type Result = { correct: number; total: number; perfect: boolean; mistakes: string[] };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function LessonPlayer({
  lesson,
  hearts,
  onWrong,
  onExit,
  onComplete,
}: {
  lesson: XLesson;
  hearts: number;
  onWrong: () => void;
  onExit: () => void;
  onComplete: (r: Result) => void;
}) {
  const [queue, setQueue] = useState<XEx[]>(() => shuffle(lesson.exercises));
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState<null | boolean>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [mistakes, setMistakes] = useState<string[]>([]);
  const total = lesson.exercises.length;
  const ex = queue[index];

  const done = (ok: boolean, label: string) => {
    if (checked !== null) return;
    setChecked(ok);
    setAnswered((n) => n + 1);
    if (ok) setCorrectCount((n) => n + 1);
    else {
      setMistakes((m) => (m.includes(label) ? m : [...m, label]));
      onWrong();
      setQueue((q) => [...q, ex]);
    }
  };

  const next = () => {
    setChecked(null);
    if (index + 1 >= queue.length) {
      onComplete({
        correct: correctCount,
        total: Math.max(total, answered),
        perfect: mistakes.length === 0,
        mistakes,
      });
      return;
    }
    setIndex((i) => i + 1);
  };

  const progress = (Math.min(index, total) / total) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={onExit} aria-label="レッスンをやめる">
          <X className="h-5 w-5" />
        </Button>
        <Progress value={progress} className="h-3 flex-1" />
        <div className="flex items-center gap-1 text-sm font-bold text-rose-500">
          <Heart className="h-5 w-5 fill-rose-500" />
          {hearts}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-5 py-8">
          {ex && <ExerciseView key={index} ex={ex} locked={checked !== null} onAnswer={done} />}
        </div>
      </div>

      <div
        className={cn(
          "border-t px-5 py-4 transition-colors",
          checked === null
            ? "border-border/60"
            : checked
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-rose-500/40 bg-rose-500/10",
        )}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="text-sm font-semibold">
            {checked === null ? (
              <span className="text-muted-foreground">
                {index + 1} / {queue.length} 問
              </span>
            ) : checked ? (
              <span className="text-emerald-600">正解！</span>
            ) : (
              <span className="text-rose-600">おしい！もう一度あとで出題します</span>
            )}
          </div>
          {checked !== null && (
            <Button onClick={next} className="min-w-32 gap-2">
              つぎへ <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ExerciseView({
  ex,
  locked,
  onAnswer,
}: {
  ex: XEx;
  locked: boolean;
  onAnswer: (ok: boolean, label: string) => void;
}) {
  switch (ex.type) {
    case "choice":
      return <ChoiceEx ex={ex} locked={locked} onAnswer={onAnswer} />;
    case "listen":
      return <ListenEx ex={ex} locked={locked} onAnswer={onAnswer} />;
    case "wordbank":
      return <WordBankEx ex={ex} locked={locked} onAnswer={onAnswer} />;
    case "match":
      return <MatchEx ex={ex} locked={locked} onAnswer={onAnswer} />;
    case "type":
      return <TypeEx ex={ex} locked={locked} onAnswer={onAnswer} />;
    case "speak":
      return <SpeakEx ex={ex} locked={locked} onAnswer={onAnswer} />;
  }
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-6 text-2xl font-black tracking-tight">{children}</h2>;
}

function ChoiceEx({
  ex,
  locked,
  onAnswer,
}: {
  ex: Extract<XEx, { type: "choice" }>;
  locked: boolean;
  onAnswer: (ok: boolean, label: string) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div>
      <Heading>{ex.prompt}</Heading>
      <div className="grid gap-3 sm:grid-cols-2">
        {ex.options.map((o, i) => (
          <button
            key={o}
            disabled={locked}
            onClick={() => {
              setPicked(i);
              onAnswer(i === ex.answer, ex.prompt);
            }}
            className={cn(
              "rounded-2xl border-2 border-b-4 px-4 py-4 text-left font-semibold transition-all active:translate-y-0.5",
              picked === i
                ? i === ex.answer
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-rose-500 bg-rose-500/10"
                : "border-border hover:bg-accent/50",
            )}
          >
            {o}
          </button>
        ))}
      </div>
      {locked && ex.note && (
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          <Lightbulb className="mt-0.5 h-4 w-4 text-amber-500" />
          {ex.note}
        </p>
      )}
    </div>
  );
}

function ListenEx({
  ex,
  locked,
  onAnswer,
}: {
  ex: Extract<XEx, { type: "listen" }>;
  locked: boolean;
  onAnswer: (ok: boolean, label: string) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => {
    speak(ex.en);
  }, [ex.en]);
  return (
    <div>
      <Heading>聞こえた英語の意味は？</Heading>
      <div className="mb-6 flex items-center gap-3">
        <Button size="lg" onClick={() => speak(ex.en)} className="gap-2">
          <Volume2 className="h-5 w-5" /> もう一度聞く
        </Button>
        <Button variant="outline" onClick={() => speak(ex.en, 0.6)} className="gap-2">
          <Volume2 className="h-4 w-4" /> ゆっくり
        </Button>
      </div>
      <div className="grid gap-3">
        {ex.options.map((o, i) => (
          <button
            key={o}
            disabled={locked}
            onClick={() => {
              setPicked(i);
              onAnswer(i === ex.answer, ex.en);
            }}
            className={cn(
              "rounded-2xl border-2 border-b-4 px-4 py-3 text-left font-semibold transition-all",
              picked === i
                ? i === ex.answer
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-rose-500 bg-rose-500/10"
                : "border-border hover:bg-accent/50",
            )}
          >
            {o}
          </button>
        ))}
      </div>
      {locked && <p className="mt-5 text-sm text-muted-foreground">英文: {ex.en}</p>}
    </div>
  );
}

function WordBankEx({
  ex,
  locked,
  onAnswer,
}: {
  ex: Extract<XEx, { type: "wordbank" }>;
  locked: boolean;
  onAnswer: (ok: boolean, label: string) => void;
}) {
  const words = useMemo(
    () => shuffle([...ex.en.split(" "), ...ex.distractors]).map((w, i) => ({ w, id: `${w}-${i}` })),
    [ex],
  );
  const [picked, setPicked] = useState<string[]>([]);
  const sentence = picked.map((id) => words.find((x) => x.id === id)!.w).join(" ");

  return (
    <div>
      <Heading>日本語を英語にならべかえよう</Heading>
      <p className="mb-6 rounded-2xl bg-muted/60 p-4 text-lg font-semibold">{ex.ja}</p>
      <div className="mb-6 min-h-16 rounded-2xl border-2 border-dashed border-border p-3">
        <div className="flex flex-wrap gap-2">
          {picked.map((id) => (
            <button
              key={id}
              disabled={locked}
              onClick={() => setPicked((p) => p.filter((x) => x !== id))}
              className="rounded-xl border-2 border-b-4 border-border bg-background px-3 py-2 font-semibold"
            >
              {words.find((x) => x.id === id)!.w}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {words
          .filter((x) => !picked.includes(x.id))
          .map((x) => (
            <button
              key={x.id}
              disabled={locked}
              onClick={() => setPicked((p) => [...p, x.id])}
              className="rounded-xl border-2 border-b-4 border-border bg-background px-3 py-2 font-semibold transition-all hover:bg-accent/50 active:translate-y-0.5"
            >
              {x.w}
            </button>
          ))}
      </div>
      {!locked && (
        <Button
          className="mt-8 w-full"
          size="lg"
          disabled={picked.length === 0}
          onClick={() => onAnswer(normalize(sentence) === normalize(ex.en), ex.ja)}
        >
          こたえあわせ
        </Button>
      )}
      {locked && <p className="mt-6 text-sm text-muted-foreground">正解: {ex.en}</p>}
    </div>
  );
}

function MatchEx({
  ex,
  locked,
  onAnswer,
}: {
  ex: Extract<XEx, { type: "match" }>;
  locked: boolean;
  onAnswer: (ok: boolean, label: string) => void;
}) {
  const left = useMemo(() => shuffle(ex.pairs.map((p) => p[0])), [ex]);
  const right = useMemo(() => shuffle(ex.pairs.map((p) => p[1])), [ex]);
  const [sel, setSel] = useState<{ side: "l" | "r"; v: string } | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState(false);
  const reported = useRef(false);

  const pick = (side: "l" | "r", v: string) => {
    if (locked || matched.includes(v)) return;
    if (!sel) {
      setSel({ side, v });
      if (side === "l") speak(v);
      return;
    }
    if (sel.side === side) {
      setSel({ side, v });
      return;
    }
    const en = side === "l" ? v : sel.v;
    const ja = side === "l" ? sel.v : v;
    const ok = ex.pairs.some((p) => p[0] === en && p[1] === ja);
    if (ok) {
      const nextMatched = [...matched, en, ja];
      setMatched(nextMatched);
      setSel(null);
      if (nextMatched.length === ex.pairs.length * 2 && !reported.current) {
        reported.current = true;
        onAnswer(!wrong, ex.pairs[0][0]);
      }
    } else {
      setWrong(true);
      setSel(null);
    }
  };

  const btn = (side: "l" | "r", v: string) => (
    <button
      key={v}
      onClick={() => pick(side, v)}
      disabled={matched.includes(v)}
      className={cn(
        "rounded-2xl border-2 border-b-4 px-3 py-3 font-semibold transition-all",
        matched.includes(v)
          ? "border-emerald-500/40 bg-emerald-500/10 opacity-50"
          : sel?.v === v
            ? "border-primary bg-primary/10"
            : "border-border hover:bg-accent/50",
      )}
    >
      {v}
    </button>
  );

  return (
    <div>
      <Heading>ペアをえらぼう</Heading>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-3">{left.map((v) => btn("l", v))}</div>
        <div className="grid gap-3">{right.map((v) => btn("r", v))}</div>
      </div>
      {wrong && !locked && <p className="mt-4 text-sm text-rose-600">ペアがちがいます</p>}
    </div>
  );
}

function TypeEx({
  ex,
  locked,
  onAnswer,
}: {
  ex: Extract<XEx, { type: "type" }>;
  locked: boolean;
  onAnswer: (ok: boolean, label: string) => void;
}) {
  const [val, setVal] = useState("");
  const check = () => {
    const ok = [ex.en, ...(ex.alts ?? [])].some((a) => normalize(a) === normalize(val));
    onAnswer(ok, ex.ja);
  };
  return (
    <div>
      <Heading>英語で入力しよう</Heading>
      <p className="mb-6 rounded-2xl bg-muted/60 p-4 text-lg font-semibold">{ex.ja}</p>
      <Input
        value={val}
        disabled={locked}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && val.trim() && !locked) check();
        }}
        placeholder="Type in English..."
        className="h-14 text-lg"
        autoFocus
      />
      {!locked ? (
        <Button className="mt-8 w-full" size="lg" disabled={!val.trim()} onClick={check}>
          こたえあわせ
        </Button>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">正解: {ex.en}</p>
      )}
    </div>
  );
}

function SpeakEx({
  ex,
  locked,
  onAnswer,
}: {
  ex: Extract<XEx, { type: "speak" }>;
  locked: boolean;
  onAnswer: (ok: boolean, label: string) => void;
}) {
  const [heard, setHeard] = useState("");
  const [listening, setListening] = useState(false);

  const start = () => {
    const w = window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      onAnswer(true, ex.en);
      return;
    }
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = false;
    r.onresult = (e: any) => {
      const text = e.results[0][0].transcript as string;
      setHeard(text);
      const target = normalize(ex.en).split(" ");
      const said = normalize(text).split(" ");
      const hit = target.filter((t) => said.includes(t)).length / target.length;
      onAnswer(hit >= 0.6, ex.en);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    r.start();
    setListening(true);
  };

  return (
    <div>
      <Heading>声に出して言ってみよう</Heading>
      <p className="mb-3 rounded-2xl bg-muted/60 p-4 text-lg font-semibold">{ex.en}</p>
      <p className="mb-6 text-sm text-muted-foreground">{ex.ja}</p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => speak(ex.en)} className="gap-2">
          <Volume2 className="h-4 w-4" /> お手本を聞く
        </Button>
        <Button onClick={start} disabled={locked || listening} className="gap-2">
          <Mic2 className={cn("h-4 w-4", listening && "animate-pulse")} />
          {listening ? "聞いています..." : "話す"}
        </Button>
        {!locked && (
          <Button variant="ghost" onClick={() => onAnswer(true, ex.en)}>
            スキップ
          </Button>
        )}
      </div>
      {heard && <p className="mt-5 text-sm text-muted-foreground">聞き取り: {heard}</p>}
    </div>
  );
}
