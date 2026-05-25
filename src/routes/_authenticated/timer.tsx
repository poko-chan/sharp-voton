import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Play, Pause, Square, RotateCcw, Maximize2, Minimize2, Volume2, VolumeX, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimer, fmtMs } from "@/lib/timer-context";

export const Route = createFileRoute("/_authenticated/timer")({
  component: TimerPage,
});

function TimerPage() {
  const [focus, setFocus] = useState(false);
  const { state } = useTimer();
  const initialTab =
    state?.kind === "countdown" ? "timer" :
    state?.kind === "pomodoro" ? "pomodoro" : "stopwatch";
  return (
    <div className={cn("p-8 max-w-4xl mx-auto", focus && "fixed inset-0 z-50 max-w-none bg-background overflow-auto p-6")}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">タイマー</h1>
        <div className="flex items-center gap-2">
          <NoiseControl />
          <Button variant="outline" size="sm" onClick={() => setFocus((v) => !v)}>
            {focus ? <Minimize2 className="h-4 w-4 mr-1" /> : <Maximize2 className="h-4 w-4 mr-1" />}
            {focus ? "解除" : "集中モード"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">💡 タイマーは他のページに移動しても動き続けます。</p>
      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="stopwatch">ストップウォッチ</TabsTrigger>
          <TabsTrigger value="timer">タイマー</TabsTrigger>
          <TabsTrigger value="pomodoro">ポモドーロ</TabsTrigger>
          <TabsTrigger value="breath">呼吸法</TabsTrigger>
        </TabsList>
        <TabsContent value="stopwatch"><Stopwatch /></TabsContent>
        <TabsContent value="timer"><CountdownTimer /></TabsContent>
        <TabsContent value="pomodoro"><Pomodoro /></TabsContent>
        <TabsContent value="breath"><Breathing /></TabsContent>
      </Tabs>
    </div>
  );
}

function useSubjects() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("subjects").select("id,name").eq("user_id", user.id).then(({ data }) => setSubjects(data ?? []));
  }, [user]);
  return subjects;
}

function Stopwatch() {
  const subjects = useSubjects();
  const { state, elapsedMs, start, pause, resume, finish, clear } = useTimer();
  const isThis = state?.kind === "stopwatch";
  const [subject, setSubject] = useState(isThis ? state?.subjectId ?? "" : "");
  const [content, setContent] = useState(isThis ? state?.content ?? "" : "");
  const [record, setRecord] = useState(isThis ? state?.record ?? true : true);

  const running = isThis && state?.running;

  return (
    <Card className="p-8 mt-4 space-y-6 text-center">
      <div className="flex items-center justify-center gap-3">
        <Switch checked={record} onCheckedChange={setRecord} id="rec-sw" disabled={isThis} />
        <Label htmlFor="rec-sw">終了時に記録する</Label>
      </div>
      {record && (
        <div className="space-y-2 text-left max-w-md mx-auto">
          <Select value={subject} onValueChange={setSubject} disabled={isThis}>
            <SelectTrigger><SelectValue placeholder="教科 (任意)" /></SelectTrigger>
            <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="やったこと・メモ" rows={2} disabled={isThis} />
        </div>
      )}
      <div className="text-7xl font-mono font-bold tabular-nums tracking-wider">{fmtMs(isThis ? elapsedMs : 0)}</div>
      <div className="flex justify-center gap-3 flex-wrap">
        {!isThis ? (
          <Button size="lg" onClick={() => start({ kind: "stopwatch", targetMs: 0, subjectId: subject, content, record })}>
            <Play className="mr-2 h-4 w-4" /> 開始
          </Button>
        ) : running ? (
          <Button size="lg" variant="secondary" onClick={pause}><Pause className="mr-2 h-4 w-4" /> 一時停止</Button>
        ) : (
          <Button size="lg" onClick={resume}><Play className="mr-2 h-4 w-4" /> 再開</Button>
        )}
        {isThis && <Button size="lg" variant="destructive" onClick={finish}><Square className="mr-2 h-4 w-4" /> 終了して記録</Button>}
        {isThis && <Button size="lg" variant="outline" onClick={clear}><RotateCcw className="mr-2 h-4 w-4" /> 破棄</Button>}
      </div>
    </Card>
  );
}

function CountdownTimer() {
  const subjects = useSubjects();
  const { state, remainingMs, start, finish, clear } = useTimer();
  const isThis = state?.kind === "countdown";
  const [subject, setSubject] = useState(isThis ? state?.subjectId ?? "" : "");
  const [content, setContent] = useState(isThis ? state?.content ?? "" : "");
  const [record, setRecord] = useState(isThis ? state?.record ?? true : true);
  const [minutes, setMinutes] = useState(25);

  return (
    <Card className="p-8 mt-4 space-y-6 text-center">
      <div className="flex items-center justify-center gap-3">
        <Switch checked={record} onCheckedChange={setRecord} id="rec-ct" disabled={isThis} />
        <Label htmlFor="rec-ct">終了時に記録する</Label>
      </div>
      {record && (
        <div className="space-y-2 text-left max-w-md mx-auto">
          <Select value={subject} onValueChange={setSubject} disabled={isThis}>
            <SelectTrigger><SelectValue placeholder="教科 (任意)" /></SelectTrigger>
            <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="やったこと・メモ" rows={2} disabled={isThis} />
        </div>
      )}
      {!isThis && (
        <div className="flex items-center justify-center gap-2">
          <Input type="number" value={minutes} onChange={(e) => setMinutes(+e.target.value)} className="w-24 text-center" />
          <span>分</span>
        </div>
      )}
      <div className="text-7xl font-mono font-bold tabular-nums">{fmtMs(isThis ? remainingMs : minutes * 60000)}</div>
      <div className="flex justify-center gap-3">
        {!isThis ? (
          <Button size="lg" onClick={() => start({ kind: "countdown", targetMs: minutes * 60000, subjectId: subject, content, record })}>
            <Play className="mr-2 h-4 w-4" /> 開始
          </Button>
        ) : (
          <>
            <Button size="lg" variant="destructive" onClick={finish}><Square className="mr-2 h-4 w-4" /> 終了して記録</Button>
            <Button size="lg" variant="outline" onClick={clear}>破棄</Button>
          </>
        )}
      </div>
    </Card>
  );
}

function Pomodoro() {
  const subjects = useSubjects();
  const { state, remainingMs, start, pause, resume, clear } = useTimer();
  const isThis = state?.kind === "pomodoro";
  const [subject, setSubject] = useState(isThis ? state?.subjectId ?? "" : "");
  const [content, setContent] = useState(isThis ? state?.content ?? "" : "");
  const [focusMin, setFocusMin] = useState(isThis ? state?.focusMin ?? 25 : 25);
  const [breakMin, setBreakMin] = useState(isThis ? state?.breakMin ?? 5 : 5);
  const mode = isThis ? state?.pomoMode ?? "focus" : "focus";
  const cycles = isThis ? state?.cycles ?? 0 : 0;
  const running = isThis && state?.running;

  return (
    <Card className="p-8 mt-4 space-y-6 text-center">
      <div className="text-sm text-muted-foreground">
        現在: <span className={cn("font-bold", mode === "focus" ? "text-primary" : "text-warning")}>{mode === "focus" ? "🎯 集中" : "☕ 休憩"}</span> ／ 完了サイクル: {cycles}
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-left">
        <div><Label>集中(分)</Label><Input type="number" value={focusMin} onChange={(e) => setFocusMin(+e.target.value)} disabled={isThis} /></div>
        <div><Label>休憩(分)</Label><Input type="number" value={breakMin} onChange={(e) => setBreakMin(+e.target.value)} disabled={isThis} /></div>
      </div>
      <div className="space-y-2 text-left max-w-md mx-auto">
        <Select value={subject} onValueChange={setSubject} disabled={isThis}>
          <SelectTrigger><SelectValue placeholder="教科 (任意)" /></SelectTrigger>
          <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="やったこと・メモ" rows={2} disabled={isThis} />
      </div>
      <div className="text-7xl font-mono font-bold tabular-nums">{fmtMs(isThis ? remainingMs : focusMin * 60000)}</div>
      <div className="flex justify-center gap-3">
        {!isThis ? (
          <Button size="lg" onClick={() => start({ kind: "pomodoro", targetMs: focusMin * 60000, pomoMode: "focus", focusMin, breakMin, cycles: 0, subjectId: subject, content, record: true })}>
            <Play className="mr-2 h-4 w-4" /> 開始
          </Button>
        ) : running ? (
          <Button size="lg" variant="secondary" onClick={pause}><Pause className="mr-2 h-4 w-4" /> 一時停止</Button>
        ) : (
          <Button size="lg" onClick={resume}><Play className="mr-2 h-4 w-4" /> 再開</Button>
        )}
        {isThis && (
          <Button size="lg" variant="outline" onClick={clear}>
            <RotateCcw className="mr-2 h-4 w-4" /> リセット
          </Button>
        )}
      </div>
    </Card>
  );
}

function Breathing() {
  const [phase, setPhase] = useState<"吸う" | "止める" | "吐く">("吐く");
  const [running, setRunning] = useState(false);
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
      setPhase(seq[i].p);
      timeoutId = setTimeout(tick, seq[i].d);
    };
    timeoutId = setTimeout(tick, seq[0].d);
    return () => clearTimeout(timeoutId);
  }, [running]);

  // Start small (exhaled), grow on 吸う, hold on 止める, shrink on 吐く
  const size = phase === "吸う" ? "w-64 h-64" : phase === "止める" ? "w-64 h-64" : "w-32 h-32";
  const duration = phase === "吐く" ? "duration-[6000ms]" : "duration-[4000ms]";

  return (
    <Card className="p-8 mt-4 space-y-6 text-center">
      <p className="text-muted-foreground flex items-center justify-center gap-2"><Wind className="h-4 w-4" /> 4-4-6呼吸法でリラックス</p>
      <div className="h-72 flex items-center justify-center">
        <div className={cn(
          "rounded-full bg-primary/20 transition-all ease-in-out flex items-center justify-center text-2xl font-bold",
          size, duration,
        )}>{running ? phase : "準備"}</div>
      </div>
      <Button size="lg" onClick={() => setRunning((v) => !v)}>{running ? "停止" : "開始"}</Button>
    </Card>
  );
}

// === Ambient noise (Web Audio) ===
type NoiseKind = "off" | "white" | "brown" | "pink" | "birds";

function NoiseControl() {
  const [kind, setKind] = useState<NoiseKind>("off");
  const [vol, setVol] = useState(0.3);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const stop = () => {
    nodeRef.current?.stop(); nodeRef.current?.disconnect(); nodeRef.current = null;
  };

  const play = (k: NoiseKind) => {
    stop();
    if (k === "off") return;
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const ctx = ctxRef.current;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    if (k === "white") {
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } else if (k === "brown") {
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    } else {
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random()*2-1;
        b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
        b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
        b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
        d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(g).connect(ctx.destination);
    src.start();
    nodeRef.current = src; gainRef.current = g;
  };

  useEffect(() => { if (gainRef.current) gainRef.current.gain.value = vol; }, [vol]);
  useEffect(() => () => stop(), []);

  return (
    <div className="flex items-center gap-2">
      <Select value={kind} onValueChange={(v) => { const k = v as NoiseKind; setKind(k); play(k); }}>
        <SelectTrigger className="w-36 h-9">
          {kind === "off" ? <VolumeX className="h-4 w-4 mr-1" /> : <Volume2 className="h-4 w-4 mr-1" />}
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="off">環境音オフ</SelectItem>
          <SelectItem value="white">ホワイトノイズ</SelectItem>
          <SelectItem value="pink">ピンクノイズ</SelectItem>
          <SelectItem value="brown">ブラウンノイズ(雨)</SelectItem>
        </SelectContent>
      </Select>
      {kind !== "off" && (
        <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => setVol(+e.target.value)} className="w-20" />
      )}
    </div>
  );
}
