import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { localDateStr } from "@/lib/date";
import { emitProfileChange } from "@/lib/profile-events";

export type TimerKind = "stopwatch" | "countdown" | "pomodoro";

export type TimerState = {
  kind: TimerKind;
  running: boolean;
  // For stopwatch: startedAt (ms epoch) + pausedAt accumulator
  startedAt: number; // when current running interval started
  accumulated: number; // ms accumulated while paused
  // For countdown / pomodoro: total target ms for current phase
  targetMs: number;
  // Pomodoro
  pomoMode?: "focus" | "break";
  focusMin?: number;
  breakMin?: number;
  cycles?: number;
  // Metadata
  subjectId?: string;
  content?: string;
  record?: boolean;
  materialIds?: string[];
};

const LS_KEY = "studyplus.timer.v1";

type Ctx = {
  state: TimerState | null;
  nowMs: number;
  elapsedMs: number; // for stopwatch: total elapsed; for countdown: elapsed within target
  remainingMs: number; // for countdown / pomodoro
  start: (init: Omit<TimerState, "running" | "startedAt" | "accumulated"> & { accumulated?: number }) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  finish: () => Promise<void>; // saves session if record=true
  clear: () => void;
};

const TimerCtx = createContext<Ctx | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<TimerState | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw) as TimerState;
    } catch {}
    return null;
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const completedRef = useRef(false);

  // Persist
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (state) localStorage.setItem(LS_KEY, JSON.stringify(state));
    else localStorage.removeItem(LS_KEY);
  }, [state]);

  // Tick
  useEffect(() => {
    if (!state?.running) return;
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, [state?.running]);

  const elapsedMs = (() => {
    if (!state) return 0;
    if (state.running) return state.accumulated + Math.max(0, nowMs - state.startedAt);
    return state.accumulated;
  })();
  const remainingMs = state && state.kind !== "stopwatch" ? Math.max(0, state.targetMs - elapsedMs) : 0;

  const saveSession = useCallback(async (minutes: number, kindLabel: string) => {
    if (!user || !state) return;
    if (!state.record || minutes <= 0) return;
    const now = new Date();
    const endH = String(now.getHours()).padStart(2, "0");
    const endM = String(now.getMinutes()).padStart(2, "0");
    const endTime = `${endH}:${endM}`;
    // derive start time by subtracting minutes
    const startD = new Date(now.getTime() - minutes * 60000);
    const startTime = `${String(startD.getHours()).padStart(2, "0")}:${String(startD.getMinutes()).padStart(2, "0")}`;
    const { error } = await supabase.from("study_logs").insert({
      user_id: user.id,
      subject_id: state.subjectId || null,
      date: localDateStr(),
      duration_minutes: minutes,
      content: state.content || kindLabel,
      start_time: startTime,
      material_id: state.materialIds?.[0] || null,
      material_ids: state.materialIds ?? [],
    } as any);
    if (error) toast.error(error.message);
    else {
      // Also snap into Today timeline as a study block (#5/#6 timer→Today auto sync)
      try {
        await (supabase as any).from("today_entries").insert({
          user_id: user.id,
          date: localDateStr(),
          category: "study",
          label: state.content || kindLabel,
          color: "#22c55e",
          start_time: startTime,
          end_time: endTime,
          material_ids: state.materialIds ?? [],
        });
      } catch {}
      toast.success(`${minutes}分を記録しました🎉`);
      emitProfileChange();
    }
  }, [user, state]);

  const finish = useCallback(async () => {
    if (!state) return;
    const min = Math.round(elapsedMs / 60000);
    const label = state.kind === "pomodoro" ? "ポモドーロ" : state.kind === "countdown" ? "タイマー" : "タイマー記録";
    if (state.record) await saveSession(min, label);
    setState(null);
  }, [state, elapsedMs, saveSession]);

  // Countdown / pomodoro auto-complete
  useEffect(() => {
    if (!state || !state.running || state.kind === "stopwatch") return;
    if (remainingMs <= 0 && !completedRef.current) {
      completedRef.current = true;
      beep();
      if (state.kind === "countdown") {
        finish();
      } else if (state.kind === "pomodoro") {
        // auto switch
        const mode = state.pomoMode;
        if (mode === "focus") {
          // save focus session, switch to break
          const min = state.focusMin ?? 25;
          if (state.record) saveSession(min, "ポモドーロ");
          setState({
            ...state,
            pomoMode: "break",
            cycles: (state.cycles ?? 0) + 1,
            targetMs: (state.breakMin ?? 5) * 60000,
            accumulated: 0,
            startedAt: Date.now(),
            running: true,
          });
          completedRef.current = false;
        } else {
          toast.success("休憩終了！次の集中タイムへ");
          setState({
            ...state,
            pomoMode: "focus",
            targetMs: (state.focusMin ?? 25) * 60000,
            accumulated: 0,
            startedAt: Date.now(),
            running: true,
          });
          completedRef.current = false;
        }
      }
    }
    if (remainingMs > 0) completedRef.current = false;
  }, [state, remainingMs, finish, saveSession]);

  const ctx: Ctx = {
    state,
    nowMs,
    elapsedMs,
    remainingMs,
    start: (init) => {
      completedRef.current = false;
      setState({
        ...init,
        accumulated: init.accumulated ?? 0,
        startedAt: Date.now(),
        running: true,
      });
    },
    pause: () => setState((s) => (s && s.running ? { ...s, accumulated: s.accumulated + (Date.now() - s.startedAt), running: false } : s)),
    resume: () => setState((s) => (s && !s.running ? { ...s, startedAt: Date.now(), running: true } : s)),
    reset: () => setState((s) => (s ? { ...s, accumulated: 0, startedAt: Date.now(), running: false, cycles: 0 } : s)),
    finish,
    clear: () => { completedRef.current = false; setState(null); },
  };

  return <TimerCtx.Provider value={ctx}>{children}</TimerCtx.Provider>;
}

export function useTimer() {
  const c = useContext(TimerCtx);
  if (!c) throw new Error("useTimer must be used within TimerProvider");
  return c;
}

export function fmtMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.start(); o.stop(ctx.currentTime + 0.5);
  } catch {}
}
