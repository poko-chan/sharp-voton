import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Play, Pause, Square, RotateCcw, Maximize2, Minimize2, Wind, Timer as TimerIcon, Hourglass, Coffee, Plus, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimer, fmtMs } from "@/lib/timer-context";
import { MaterialPicker } from "@/components/MaterialPicker";
import { useOrderedSubjects } from "@/lib/subjects";

export const Route = createFileRoute("/_authenticated/timer")({
  component: TimerPage,
  head: () => ({
    meta: [
      { title: "学習タイマー | Study#" },
      { name: "description", content: "ストップウォッチ・カウントダウン・ポモドーロ・呼吸法。集中モードとリング表示で、勉強時間をそのまま学習記録に残せます。" },
      { property: "og:title", content: "学習タイマー | Study#" },
      { property: "og:description", content: "ストップウォッチ・ポモドーロ・呼吸法を1画面で。計測した時間はそのまま学習記録に保存されます。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/* ---------------- 共通パーツ ---------------- */

function Ring({
  progress, children, running, tone = "primary",
}: { progress: number; children: React.ReactNode; running?: boolean; tone?: "primary" | "warning" }) {
  const size = 280, stroke = 12, r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  const color = tone === "warning" ? "hsl(var(--warning, 38 92% 50%))" : "hsl(var(--primary))";
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)}
          className="transition-[stroke-dashoffset] duration-500 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center px-6">
        <div>{children}</div>
      </div>
      {running && (
        <span className="absolute inset-0 rounded-full ring-4 ring-primary/10 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}

function RecordFields({
  subject, setSubject, content, setContent, materialIds, setMaterialIds, disabled,
}: any) {
  const { subjects } = useOrderedSubjects();
  return (
    <div className="space-y-2 text-left max-w-md mx-auto">
      <Select value={subject} onValueChange={setSubject} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder="教科 (任意)" /></SelectTrigger>
        <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="やったこと・メモ" rows={2} disabled={disabled} />
      <div>
        <Label className="mb-1 block text-xs">使った教材（任意・複数可）</Label>
        <MaterialPicker variant="large" value={materialIds} onChange={setMaterialIds} disabled={disabled} />
      </div>
    </div>
  );
}

/* ---------------- ページ ---------------- */

function TimerPage() {
  const [focus, setFocus] = useState(false);
  const { state, elapsedMs, remainingMs, pause, resume } = useTimer();
  const initialTab =
    state?.kind === "countdown" ? "timer" :
    state?.kind === "pomodoro" ? "pomodoro" : "stopwatch";
  const [tab, setTab] = useState(initialTab);

  // タブタイトルに残り時間を表示
  useEffect(() => {
    if (!state) return;
    const label = state.kind === "stopwatch" ? fmtMs(elapsedMs) : fmtMs(remainingMs);
    document.title = `${state.running ? "▶" : "⏸"} ${label} | Study#`;
    return () => { document.title = "学習タイマー | Study#"; };
  }, [state, elapsedMs, remainingMs]);

  // 画面スリープ防止
  useEffect(() => {
    let lock: any = null;
    const req = async () => {
      try { if (state?.running && "wakeLock" in navigator) lock = await (navigator as any).wakeLock.request("screen"); } catch {}
    };
    req();
    return () => { try { lock?.release?.(); } catch {} };
  }, [state?.running]);

  // キーボードショートカット
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.code === "Space" && state) { e.preventDefault(); state.running ? pause() : resume(); }
      if (e.key.toLowerCase() === "f") setFocus((v) => !v);
      if (e.key === "Escape") setFocus(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, pause, resume]);

  return (
    <div className={cn("p-6 md:p-8 max-w-4xl mx-auto", focus && "fixed inset-0 z-50 max-w-none bg-background overflow-auto p-6")}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-foreground to-primary/70 bg-clip-text text-transparent">
            タイマー
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            ページを移動しても動き続けます・終了で学習記録に自動保存
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state && (
            <Badge variant={state.running ? "default" : "secondary"} className="hidden sm:inline-flex">
              {state.running ? "計測中" : "一時停止中"}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => setFocus((v) => !v)}>
            {focus ? <Minimize2 className="h-4 w-4 mr-1" /> : <Maximize2 className="h-4 w-4 mr-1" />}
            {focus ? "解除" : "集中モード"}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="stopwatch"><TimerIcon className="h-3.5 w-3.5 mr-1" />計測</TabsTrigger>
          <TabsTrigger value="timer"><Hourglass className="h-3.5 w-3.5 mr-1" />タイマー</TabsTrigger>
          <TabsTrigger value="pomodoro"><Coffee className="h-3.5 w-3.5 mr-1" />ポモドーロ</TabsTrigger>
          <TabsTrigger value="breath"><Wind className="h-3.5 w-3.5 mr-1" />呼吸</TabsTrigger>
        </TabsList>
        <TabsContent value="stopwatch"><Stopwatch /></TabsContent>
        <TabsContent value="timer"><CountdownTimer /></TabsContent>
        <TabsContent value="pomodoro"><Pomodoro /></TabsContent>
        <TabsContent value="breath"><Breathing /></TabsContent>
      </Tabs>

      <div className="mt-4 text-[11px] text-muted-foreground flex items-center gap-2 justify-center">
        <Keyboard className="h-3.5 w-3.5" />
        Space = 開始/一時停止 ・ F = 集中モード ・ Esc = 解除
      </div>
    </div>
  );
}

/* ---------------- ストップウォッチ ---------------- */

function Stopwatch() {
  const { state, elapsedMs, start, pause, resume, finish, clear } = useTimer();
  const isThis = state?.kind === "stopwatch";
  const [subject, setSubject] = useState(isThis ? state?.subjectId ?? "" : "");
  const [content, setContent] = useState(isThis ? state?.content ?? "" : "");
  const [record, setRecord] = useState(isThis ? state?.record ?? true : true);
  const [materialIds, setMaterialIds] = useState<string[]>(isThis ? state?.materialIds ?? [] : []);
  const running = isThis && state?.running;
  const min = Math.floor(elapsedMs / 60000);

  return (
    <Card className="p-6 md:p-8 mt-4 space-y-6 text-center">
      <Ring progress={isThis ? (elapsedMs % 3600000) / 3600000 : 0} running={!!running}>
        <div className="text-5xl font-mono font-bold tabular-nums tracking-tight">{fmtMs(isThis ? elapsedMs : 0)}</div>
        <div className="text-xs text-muted-foreground mt-1">{isThis ? `${min}分 経過` : "経過時間なし"}</div>
      </Ring>

      <div className="flex justify-center gap-3 flex-wrap">
        {!isThis ? (
          <Button size="lg" className="px-8" onClick={() => start({ kind: "stopwatch", targetMs: 0, subjectId: subject, content, record, materialIds })}>
            <Play className="mr-2 h-4 w-4" /> 開始
          </Button>
        ) : running ? (
          <Button size="lg" variant="secondary" onClick={pause}><Pause className="mr-2 h-4 w-4" /> 一時停止</Button>
        ) : (
          <Button size="lg" onClick={resume}><Play className="mr-2 h-4 w-4" /> 再開</Button>
        )}
        {isThis && <Button size="lg" onClick={finish}><Square className="mr-2 h-4 w-4" /> 終了して記録</Button>}
        {isThis && <Button size="lg" variant="ghost" onClick={clear}><RotateCcw className="mr-2 h-4 w-4" /> 破棄</Button>}
      </div>

      <div className="flex items-center justify-center gap-3 pt-2 border-t">
        <Switch checked={record} onCheckedChange={setRecord} id="rec-sw" disabled={isThis} />
        <Label htmlFor="rec-sw" className="text-sm">終了時に学習記録へ保存する</Label>
      </div>
      {record && (
        <RecordFields
          subject={subject} setSubject={setSubject} content={content} setContent={setContent}
          materialIds={materialIds} setMaterialIds={setMaterialIds} disabled={isThis}
        />
      )}
    </Card>
  );
}

/* ---------------- カウントダウン ---------------- */

const PRESETS = [5, 10, 15, 25, 30, 45, 60, 90];

function CountdownTimer() {
  const { state, elapsedMs, remainingMs, start, pause, resume, finish, clear } = useTimer();
  const isThis = state?.kind === "countdown";
  const [subject, setSubject] = useState(isThis ? state?.subjectId ?? "" : "");
  const [content, setContent] = useState(isThis ? state?.content ?? "" : "");
  const [record, setRecord] = useState(isThis ? state?.record ?? true : true);
  const [materialIds, setMaterialIds] = useState<string[]>(isThis ? state?.materialIds ?? [] : []);
  const [minutes, setMinutes] = useState(25);
  const running = isThis && state?.running;
  const total = isThis ? state!.targetMs : minutes * 60000;
  const progress = total > 0 ? (isThis ? elapsedMs / total : 0) : 0;

  const startWith = (m: number) =>
    start({ kind: "countdown", targetMs: m * 60000, subjectId: subject, content, record, materialIds });

  return (
    <Card className="p-6 md:p-8 mt-4 space-y-6 text-center">
      <Ring progress={progress} running={!!running}>
        <div className="text-5xl font-mono font-bold tabular-nums">{fmtMs(isThis ? remainingMs : minutes * 60000)}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {isThis ? `${Math.round(progress * 100)}% 完了` : `${minutes}分でスタート`}
        </div>
      </Ring>

      {!isThis && (
        <div className="space-y-3">
          <div className="flex flex-wrap justify-center gap-2">
            {PRESETS.map((m) => (
              <Button key={m} size="sm" variant={minutes === m ? "default" : "outline"} className="rounded-full px-4" onClick={() => setMinutes(m)}>
                {m}分
              </Button>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button size="icon" variant="outline" onClick={() => setMinutes((v) => Math.max(1, v - 5))}>-5</Button>
            <Input type="number" value={minutes} onChange={(e) => setMinutes(Math.max(1, +e.target.value))} className="w-20 text-center" />
            <span className="text-sm">分</span>
            <Button size="icon" variant="outline" onClick={() => setMinutes((v) => v + 5)}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <div className="flex justify-center gap-3 flex-wrap">
        {!isThis ? (
          <Button size="lg" className="px-8" onClick={() => startWith(minutes)}><Play className="mr-2 h-4 w-4" /> 開始</Button>
        ) : (
          <>
            {running
              ? <Button size="lg" variant="secondary" onClick={pause}><Pause className="mr-2 h-4 w-4" /> 一時停止</Button>
              : <Button size="lg" onClick={resume}><Play className="mr-2 h-4 w-4" /> 再開</Button>}
            <Button size="lg" onClick={finish}><Square className="mr-2 h-4 w-4" /> 終了して記録</Button>
            <Button size="lg" variant="ghost" onClick={clear}>破棄</Button>
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 pt-2 border-t">
        <Switch checked={record} onCheckedChange={setRecord} id="rec-ct" disabled={isThis} />
        <Label htmlFor="rec-ct" className="text-sm">終了時に学習記録へ保存する</Label>
      </div>
      {record && (
        <RecordFields
          subject={subject} setSubject={setSubject} content={content} setContent={setContent}
          materialIds={materialIds} setMaterialIds={setMaterialIds} disabled={isThis}
        />
      )}
    </Card>
  );
}

/* ---------------- ポモドーロ ---------------- */

function Pomodoro() {
  const { state, elapsedMs, remainingMs, start, pause, resume, clear } = useTimer();
  const isThis = state?.kind === "pomodoro";
  const [subject, setSubject] = useState(isThis ? state?.subjectId ?? "" : "");
  const [content, setContent] = useState(isThis ? state?.content ?? "" : "");
  const [focusMin, setFocusMin] = useState(isThis ? state?.focusMin ?? 25 : 25);
  const [breakMin, setBreakMin] = useState(isThis ? state?.breakMin ?? 5 : 5);
  const [materialIds, setMaterialIds] = useState<string[]>(isThis ? state?.materialIds ?? [] : []);
  const mode = isThis ? state?.pomoMode ?? "focus" : "focus";
  const cycles = isThis ? state?.cycles ?? 0 : 0;
  const running = isThis && state?.running;
  const total = isThis ? state!.targetMs : focusMin * 60000;
  const progress = total > 0 && isThis ? elapsedMs / total : 0;

  return (
    <Card className="p-6 md:p-8 mt-4 space-y-6 text-center">
      <div className="flex items-center justify-center gap-2 text-sm">
        <Badge variant={mode === "focus" ? "default" : "secondary"} className="text-xs">
          {mode === "focus" ? "🎯 集中" : "☕ 休憩"}
        </Badge>
        <span className="text-muted-foreground">完了サイクル {cycles}</span>
        <div className="flex gap-1 ml-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className={cn("h-2 w-2 rounded-full", i < cycles % 4 ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </div>

      <Ring progress={progress} running={!!running} tone={mode === "focus" ? "primary" : "warning"}>
        <div className="text-5xl font-mono font-bold tabular-nums">{fmtMs(isThis ? remainingMs : focusMin * 60000)}</div>
        <div className="text-xs text-muted-foreground mt-1">{focusMin}分集中 / {breakMin}分休憩</div>
      </Ring>

      {!isThis && (
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-left">
          <div><Label className="text-xs">集中(分)</Label><Input type="number" value={focusMin} onChange={(e) => setFocusMin(Math.max(1, +e.target.value))} /></div>
          <div><Label className="text-xs">休憩(分)</Label><Input type="number" value={breakMin} onChange={(e) => setBreakMin(Math.max(1, +e.target.value))} /></div>
        </div>
      )}

      <div className="flex justify-center gap-3 flex-wrap">
        {!isThis ? (
          <Button size="lg" className="px-8" onClick={() => start({ kind: "pomodoro", targetMs: focusMin * 60000, pomoMode: "focus", focusMin, breakMin, cycles: 0, subjectId: subject, content, record: true, materialIds })}>
            <Play className="mr-2 h-4 w-4" /> 開始
          </Button>
        ) : running ? (
          <Button size="lg" variant="secondary" onClick={pause}><Pause className="mr-2 h-4 w-4" /> 一時停止</Button>
        ) : (
          <Button size="lg" onClick={resume}><Play className="mr-2 h-4 w-4" /> 再開</Button>
        )}
        {isThis && <Button size="lg" variant="ghost" onClick={clear}><RotateCcw className="mr-2 h-4 w-4" /> リセット</Button>}
      </div>

      <div className="pt-2 border-t">
        <RecordFields
          subject={subject} setSubject={setSubject} content={content} setContent={setContent}
          materialIds={materialIds} setMaterialIds={setMaterialIds} disabled={isThis}
        />
      </div>
    </Card>
  );
}

/* ---------------- 呼吸法 ---------------- */

function Breathing() {
  const [phase, setPhase] = useState<"吸う" | "止める" | "吐く">("吐く");
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState(0);
  const roundRef = useRef(0);

  useEffect(() => {
    if (!running) { setPhase("吐く"); return; }
    const seq: { p: typeof phase; d: number }[] = [
      { p: "吸う", d: 4000 }, { p: "止める", d: 4000 }, { p: "吐く", d: 6000 },
    ];
    let i = 0;
    setPhase(seq[0].p);
    let timeoutId: ReturnType<typeof setTimeout>;
    const tick = () => {
      i = (i + 1) % seq.length;
      if (i === 0) { roundRef.current += 1; setRounds(roundRef.current); }
      setPhase(seq[i].p);
      timeoutId = setTimeout(tick, seq[i].d);
    };
    timeoutId = setTimeout(tick, seq[0].d);
    return () => clearTimeout(timeoutId);
  }, [running]);

  const size = phase === "吸う" || phase === "止める" ? "w-64 h-64" : "w-32 h-32";
  const duration = phase === "吐く" ? "duration-[6000ms]" : "duration-[4000ms]";

  return (
    <Card className="p-6 md:p-8 mt-4 space-y-6 text-center">
      <p className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
        <Wind className="h-4 w-4" /> 4-4-6呼吸法でリラックス ・ 完了 {rounds} 回
      </p>
      <div className="h-72 flex items-center justify-center">
        <div className={cn(
          "rounded-full bg-primary/20 ring-8 ring-primary/5 transition-all ease-in-out flex items-center justify-center text-2xl font-bold",
          size, duration,
        )}>{running ? phase : "準備"}</div>
      </div>
      <Button size="lg" className="px-8" onClick={() => setRunning((v) => !v)}>{running ? "停止" : "開始"}</Button>
    </Card>
  );
}
