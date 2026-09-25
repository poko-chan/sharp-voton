import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScratchPad } from "@/components/makron/ScratchPad";
import { toast } from "sonner";
import { ArrowLeft, Flame, Star, RotateCcw, CheckCircle2, XCircle } from "lucide-react";

type Q = {
  id: string;
  body: string;
  kind: string;
  choices: any;
  level: number;
  unit_id: string;
  hint_text: string | null;
};

export function EduWorkspace({ orgId }: { orgId: string }) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [unitId, setUnitId] = useState<string>("");
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const [{ data: s }, { data: u }, { data: st }] = await Promise.all([
        (supabase as any).from("org_edu_subjects").select("*").eq("organization_id", orgId).order("sort_order"),
        (supabase as any).from("org_edu_units").select("*").eq("organization_id", orgId).order("sort_order"),
        (supabase as any)
          .from("org_edu_streaks")
          .select("current_streak")
          .eq("organization_id", orgId)
          .eq("user_id", user?.id ?? "")
          .maybeSingle(),
      ]);
      setSubjects(s ?? []);
      setUnits(u ?? []);
      setStreak(st?.current_streak ?? 0);
    })();
  }, [orgId]);

  if (unitId) {
    return (
      <Solver
        orgId={orgId}
        unit={units.find((u) => u.id === unitId)}
        units={units}
        streak={streak}
        onExit={() => setUnitId("")}
      />
    );
  }

  const subjUnits = units.filter((u) => u.subject_id === subjectId);
  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-bold mb-2">① 教科をえらぶ</div>
        {subjects.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            まだ教科がありません。先生が「問題管理」から作成できます。
          </Card>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => setSubjectId(s.id)}
              className={`rounded-xl border-2 p-4 text-left font-bold transition ${subjectId === s.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
            >
              <span className="inline-block h-3 w-3 rounded-full mr-2" style={{ background: s.color }} />
              {s.name}
            </button>
          ))}
        </div>
      </div>
      {subjectId && (
        <div>
          <div className="text-sm font-bold mb-2">② 単元をえらぶ</div>
          {subjUnits.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">この教科に単元はありません</Card>
          )}
          <div className="grid sm:grid-cols-2 gap-2">
            {subjUnits.map((u) => (
              <Card
                key={u.id}
                onClick={() => setUnitId(u.id)}
                className="p-4 cursor-pointer hover:border-primary transition"
              >
                <div className="font-bold">{u.title}</div>
                <div className="text-xs text-muted-foreground">
                  レベル {u.level}
                  {u.description ? ` ・ ${u.description}` : ""}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Solver({
  orgId,
  unit,
  units,
  streak,
  onExit,
}: {
  orgId: string;
  unit: any;
  units: any[];
  streak: number;
  onExit: () => void;
}) {
  const [main, setMain] = useState<Q[]>([]);
  const [basics, setBasics] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [queue, setQueue] = useState<Q[]>([]); // さかのぼり割り込み
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<null | { ok: boolean; answer: string; explanation: string }>(null);
  const [wrongRun, setWrongRun] = useState(0);
  const [stars, setStars] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [padKey, setPadKey] = useState(0);
  const startedAt = useRef(Date.now());
  const times = useRef<number[]>([]);
  const channel = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const lower = units
        .filter((u) => u.subject_id === unit.subject_id && u.level < unit.level)
        .map((u) => u.id);
      const [{ data: m }, { data: b }] = await Promise.all([
        (supabase as any)
          .from("org_edu_questions")
          .select("id, body, kind, choices, level, unit_id, hint_text")
          .eq("unit_id", unit.id)
          .order("level")
          .order("sort_order"),
        lower.length
          ? (supabase as any)
              .from("org_edu_questions")
              .select("id, body, kind, choices, level, unit_id, hint_text")
              .in("unit_id", lower)
              .limit(50)
          : Promise.resolve({ data: [] }),
      ]);
      setMain(m ?? []);
      // 下位単元がなければ同じ単元の低レベル問題を基礎として使う
      const minLv = Math.min(...(m ?? []).map((x: Q) => x.level));
      setBasics((b ?? []).length ? b : (m ?? []).filter((x: Q) => x.level === minLv));
    })();
  }, [unit, units]);

  // 先生用ポータルへ「解答中」を伝える
  useEffect(() => {
    let alive = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !alive) return;
      const ch = supabase.channel(`edu-live-${orgId}`, { config: { presence: { key: user.id } } });
      channel.current = ch;
      ch.subscribe((s) => {
        if (s === "SUBSCRIBED") ch.track({ state: "solving", unit: unit.title, at: Date.now() });
      });
    })();
    return () => {
      alive = false;
      if (channel.current) supabase.removeChannel(channel.current);
    };
  }, [orgId, unit]);

  const current: Q | undefined = queue[0] ?? main[idx];
  const isBasic = queue.length > 0;
  const total = main.length;
  const progress = total ? Math.round((Math.min(idx, total) / total) * 100) : 0;
  const choices: string[] = useMemo(
    () => (Array.isArray(current?.choices) ? (current!.choices as any[]).map(String) : []),
    [current],
  );
  const resumeKey = `edu-resume-${unit.id}`;

  // 途中から再開
  useEffect(() => {
    if (!main.length) return;
    try {
      const saved = JSON.parse(localStorage.getItem(resumeKey) ?? "null");
      if (saved && saved.idx > 0 && saved.idx < main.length) {
        setIdx(saved.idx);
        setStars(saved.stars ?? 0);
        setCorrect(saved.correct ?? 0);
        toast(`前回の続き（${saved.idx + 1}問目）から再開します`);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [main.length]);
  useEffect(() => {
    if (!main.length || done) return;
    localStorage.setItem(resumeKey, JSON.stringify({ idx, stars, correct }));
  }, [idx, stars, correct, main.length, done, resumeKey]);

  // キーボード: 数字で選択肢、Enterで次へ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (result && e.key === "Enter") {
        e.preventDefault();
        next();
        return;
      }
      if (tag === "INPUT" || tag === "TEXTAREA" || result) return;
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length) setAnswer(choices[n - 1]);
      else if (e.key === "Enter" && answer.trim()) submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const submit = async () => {
    if (!current || !answer.trim()) return;
    const { data, error } = await (supabase as any).rpc("org_edu_check_answer", {
      _question: current.id,
      _answer: answer.trim(),
    });
    if (error) return toast.error(error.message);
    times.current.push(Math.round((Date.now() - startedAt.current) / 1000));
    const ok = !!data?.correct;
    setResult({ ok, answer: data?.answer ?? "", explanation: data?.explanation ?? "" });
    if (ok) {
      setWrongRun(0);
      setStars((s) => s + (isBasic ? 1 : 2));
      if (!isBasic) setCorrect((c) => c + 1);
    } else {
      const run = wrongRun + 1;
      setWrongRun(run);
      if (run >= 2 && !isBasic && basics.length) {
        const pick = [...basics].sort(() => Math.random() - 0.5).slice(0, 2);
        setQueue(pick);
        setWrongRun(0);
        toast("さかのぼり学習モード：基礎を2問はさみます");
      }
    }
  };

  const next = async () => {
    setResult(null);
    setAnswer("");
    setPadKey((k) => k + 1);
    startedAt.current = Date.now();
    if (isBasic) {
      // 本問題に戻る前に、今の基礎問題を消化
      setQueue((q) => q.slice(1));
      return;
    }
    if (idx + 1 < total) return setIdx(idx + 1);
    setIdx(total);
    setDone(true);
    localStorage.removeItem(resumeKey);
    await (supabase as any).rpc("org_edu_record_result", {
      _org: orgId,
      _correct: correct,
      _xp: correct * 10,
    });
  };

  if (done) {
    const avg = times.current.length
      ? Math.round(times.current.reduce((a, b) => a + b, 0) / times.current.length)
      : 0;
    return (
      <Card className="p-8 text-center space-y-3">
        <div className="text-2xl font-extrabold">おつかれさま！</div>
        <div className="text-sm">
          {correct} / {total} 問正解 ・ ★{stars} ・ 平均 {avg} 秒/問
        </div>
        <Button onClick={onExit}>単元選択へ戻る</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs font-bold flex items-center gap-1">
          <Flame className="h-4 w-4 text-orange-500" />
          {streak}日
        </span>
        <span className="text-xs font-bold flex items-center gap-1">
          <Star className="h-4 w-4 text-amber-500" />
          {stars}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        {unit.title} ・ {Math.min(idx + 1, total)} / {total}
      </div>

      {!current ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          この単元にはまだ問題がありません
        </Card>
      ) : (
        <>
          {isBasic && (
            <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-xs font-bold flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              さかのぼり学習中：基礎を確認しよう
            </div>
          )}
          <Card className="p-5">
            <div className="text-lg font-bold whitespace-pre-wrap">{current.body}</div>
            {current.hint_text && !result && (
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">ヒント</summary>
                {current.hint_text}
              </details>
            )}
          </Card>
          <ScratchPad key={padKey} />
          {choices.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {choices.map((c, i) => (
                <Button
                  key={c}
                  className="h-12 justify-start"
                  variant={answer === c ? "default" : "outline"}
                  disabled={!!result}
                  onClick={() => setAnswer(c)}
                >
                  <span className="mr-2 text-xs opacity-60">{i + 1}</span>
                  {c}
                </Button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={answer}
              disabled={!!result}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !result && submit()}
              placeholder="最終的な答え"
            />
            {!result ? (
              <Button onClick={submit} disabled={!answer.trim()}>
                解答する
              </Button>
            ) : (
              <Button onClick={next}>次へ</Button>
            )}
          </div>
          {result && (
            <Card
              className={`p-4 border-2 ${result.ok ? "border-emerald-500 bg-emerald-500/10" : "border-destructive bg-destructive/10"}`}
            >
              <div className="font-extrabold flex items-center gap-2">
                {result.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                {result.ok ? "正解！" : `不正解　正解：${result.answer}`}
              </div>
              {result.explanation && (
                <div className="text-sm mt-2 whitespace-pre-wrap">{result.explanation}</div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
