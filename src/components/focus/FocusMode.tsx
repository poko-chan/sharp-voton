import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Crosshair,
  Settings2,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  StickyNote,
  LogOut,
  Pause,
  Play,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { localDateStr } from "@/lib/date";
import { cn } from "@/lib/utils";

/* ---------- 設定・状態 ---------- */

export const FOCUS_APPS = [
  { to: "/timer", label: "タイマー" },
  { to: "/makron", label: "Makron" },
  { to: "/flashcards", label: "暗記カード" },
  { to: "/notebooks", label: "Cnote" },
  { to: "/notes", label: "メモ" },
  { to: "/materials", label: "教材DB" },
  { to: "/exams", label: "試験" },
  { to: "/study", label: "勉強記録" },
] as const;

type Visual = "normal" | "mono" | "dim";
type AmbientSound = "off" | "rain" | "brown";
type Settings = {
  fullscreen: boolean;
  wakeLock: boolean;
  leaveLog: boolean;
  blockLeave: boolean;
  titleTimer: boolean;
  completionNotice: boolean;
  ambientSound: AmbientSound;
  ambientVolume: number;
  edgeGauge: boolean;
  memo: boolean;
  visual: Visual;
  exitHold: 0 | 3 | 5;
  allowed: string[];
};
type Session = {
  startedAt: number;
  durationMin: number; // 0 = 無制限
  pausedMs: number;
  pausedAt: number | null;
  leaves: { at: number; ms: number }[];
  memos: string[];
  settings: Settings;
};

const DEFAULTS: Settings = {
  fullscreen: true,
  wakeLock: true,
  leaveLog: true,
  blockLeave: true,
  titleTimer: true,
  completionNotice: false,
  ambientSound: "off",
  ambientVolume: 18,
  edgeGauge: true,
  memo: true,
  visual: "normal",
  exitHold: 3,
  allowed: FOCUS_APPS.map((a) => a.to),
};
const KEY = "studysharp.focus.session.v1";
const PREF = "studysharp.focus.prefs.v1";

const load = <T,>(k: string): T | null => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};

let openStartDialog: (() => void) | null = null;
export const openFocusMode = () => openStartDialog?.();

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${m}:${ss}` : `${m}:${ss}`;
};
const elapsedOf = (s: Session, now: number) =>
  now - s.startedAt - s.pausedMs - (s.pausedAt ? now - s.pausedAt : 0);

/* ---------- 本体 ---------- */

export function FocusMode() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [session, setSession] = useState<Session | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [summary, setSummary] = useState<(Session & { endedAt: number }) | null>(null);
  const [now, setNow] = useState(Date.now());
  const [isFs, setIsFs] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const hiddenAt = useRef<number | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const pip = useRef<Window | null>(null);
  const ambientGain = useRef<GainNode | null>(null);
  const baseTitle = useRef<string>("");

  useEffect(() => {
    setSession(() => {
      const restored = load<Session>(KEY);
      return restored ? { ...restored, settings: { ...DEFAULTS, ...restored.settings } } : null;
    });
    openStartDialog = () => setStartOpen(true);
    return () => {
      openStartDialog = null;
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => setIsVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const save = useCallback((s: Session | null) => {
    setSession(s);
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  }, []);

  const st = session?.settings;
  const active = !!session;

  // tick
  useEffect(() => {
    if (!active) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [active]);

  const elapsed = session ? elapsedOf(session, now) : 0;
  const remaining = session && session.durationMin ? session.durationMin * 60000 - elapsed : null;
  const progress = session?.durationMin ? Math.min(1, elapsed / (session.durationMin * 60000)) : 0;

  const finish = useCallback(() => {
    if (!session) return;
    setSummary({ ...session, endedAt: Date.now() });
    save(null);
    if (document.fullscreenElement)
      document.exitFullscreen().catch(() => toast.error("全画面表示を終了できませんでした"));
    pip.current?.close();
  }, [session, save]);

  // 時間終了
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !session?.pausedAt) {
      toast.success("集中時間が終了しました");
      if (st?.completionNotice && "Notification" in window && Notification.permission === "granted") {
        try {
          const notification = new Notification("集中時間が終了しました", {
            body: "おつかれさまでした。集中セッションが完了しました。",
            tag: "studysharp-focus-complete",
          });
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } catch {
          toast.error("ブラウザー通知を表示できませんでした");
        }
      }
      finish();
    }
  }, [remaining, finish, session?.pausedAt, st?.completionNotice]);

  // 全画面監視
  useEffect(() => {
    const on = () => setIsFs(!!document.fullscreenElement);
    on();
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  // スリープ防止
  useEffect(() => {
    if (!active || !st?.wakeLock || session?.pausedAt) return;
    const nav = (navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    }).wakeLock;
    if (!nav) {
      toast.warning("このブラウザーはスリープ防止に対応していません");
      return;
    }
    const req = async () => {
      try {
        if (document.visibilityState === "visible") wake.current = await nav.request("screen");
      } catch {
        toast.error("スリープ防止を有効にできませんでした");
      }
    };
    req();
    document.addEventListener("visibilitychange", req);
    return () => {
      document.removeEventListener("visibilitychange", req);
      wake.current?.release().catch(() => toast.error("スリープ防止を解除できませんでした"));
      wake.current = null;
    };
  }, [active, st?.wakeLock, session?.pausedAt]);

  // 集中中だけブラウザー内で環境音を生成する
  useEffect(() => {
    if (!active || session?.pausedAt || !isVisible || !st?.ambientSound || st.ambientSound === "off")
      return;
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) {
      toast.error("このブラウザーは環境音の再生に対応していません");
      return;
    }

    let context: AudioContext;
    try {
      context = new AudioContextClass();
    } catch {
      toast.error("環境音を開始できませんでした");
      return;
    }

    try {
      const seconds = 3;
      const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
      const samples = buffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < samples.length; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + 0.02 * white) / 1.02;
        samples[i] = st.ambientSound === "brown" ? brown * 3.5 : white;
      }

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = st.ambientSound === "rain" ? "bandpass" : "lowpass";
      filter.frequency.value = st.ambientSound === "rain" ? 1800 : 650;
      filter.Q.value = st.ambientSound === "rain" ? 0.35 : 0.7;
      const gain = context.createGain();
      ambientGain.current = gain;
      gain.gain.setValueAtTime(0, context.currentTime);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      source.start();
      void context.resume().catch(() => toast.error("環境音の再生を開始できませんでした"));

      return () => {
        if (ambientGain.current === gain) ambientGain.current = null;
        const endAt = context.currentTime + 0.35;
        gain.gain.cancelScheduledValues(context.currentTime);
        gain.gain.setTargetAtTime(0, context.currentTime, 0.08);
        try {
          source.stop(endAt);
        } catch {
          toast.error("環境音を停止できませんでした");
        }
        window.setTimeout(() => {
          void context.close().catch(() => toast.error("環境音の音声リソースを解放できませんでした"));
        }, 500);
      };
    } catch {
      void context.close().catch(() => toast.error("環境音の音声リソースを解放できませんでした"));
      toast.error("環境音を開始できませんでした");
    }
  }, [active, isVisible, session?.pausedAt, st?.ambientSound]);

  useEffect(() => {
    const gain = ambientGain.current;
    if (!gain) return;
    const volume = (Math.max(0, Math.min(100, st?.ambientVolume ?? 0)) / 100) * 0.16;
    gain.gain.setTargetAtTime(volume, gain.context.currentTime, 0.12);
  }, [active, isVisible, session?.pausedAt, st?.ambientVolume, st?.ambientSound]);

  // 離脱検知（無音）
  useEffect(() => {
    if (!active || !st?.leaveLog) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else if (hiddenAt.current) {
        const ms = Date.now() - hiddenAt.current;
        hiddenAt.current = null;
        if (ms < 1500) return;
        setSession((prev) => {
          if (!prev) return prev;
          const next = { ...prev, leaves: [...prev.leaves, { at: Date.now(), ms }] };
          localStorage.setItem(KEY, JSON.stringify(next));
          return next;
        });
        toast.warning(`集中が途切れていました（${fmt(ms)}）`);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [active, st?.leaveLog]);

  // タブ閉じ・外部サイト移動の引き止め
  useEffect(() => {
    if (!active || !st?.blockLeave) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [active, st?.blockLeave]);

  // タブタイトル
  useEffect(() => {
    if (active && st?.titleTimer) {
      if (!baseTitle.current) baseTitle.current = document.title.replace(/^\[.*?\]\s*/, "");
      document.title = `[${remaining !== null ? fmt(remaining) : fmt(elapsed)} 集中中] ${baseTitle.current}`;
    } else if (baseTitle.current) {
      document.title = baseTitle.current;
      baseTitle.current = "";
    }
  }, [active, st?.titleTimer, remaining, elapsed]);

  // 視覚モード
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("focus-mono", active && st?.visual === "mono");
    el.classList.toggle("focus-dim", active && st?.visual === "dim");
    return () => el.classList.remove("focus-mono", "focus-dim");
  }, [active, st?.visual]);

  // PiP ミニ表示
  useEffect(() => {
    const w = pip.current;
    if (!w || w.closed) return;
    const el = w.document.getElementById("t");
    if (el) el.textContent = remaining !== null ? fmt(remaining) : fmt(elapsed);
    const bar = w.document.getElementById("progress");
    if (bar) bar.style.width = `${progress * 100}%`;
    const pause = w.document.getElementById("pause");
    if (pause) pause.textContent = session?.pausedAt ? "再開" : "一時停止";
    const status = w.document.getElementById("status");
    if (status) status.textContent = session?.pausedAt ? "一時停止中" : "集中中";
  }, [elapsed, progress, remaining, session?.pausedAt]);

  const openPip = async () => {
    if (pip.current && !pip.current.closed) {
      pip.current.focus();
      return;
    }
    const dp = (window as Window & {
      documentPictureInPicture?: { requestWindow: (options: { width: number; height: number }) => Promise<Window> };
    }).documentPictureInPicture;
    if (!dp) return toast.error("このブラウザーはミニ表示に対応していません");
    try {
      const w = await dp.requestWindow({ width: 260, height: 150 });
      const doc = w.document;
      doc.title = "集中モード";
      doc.body.replaceChildren();
      doc.body.style.cssText =
        "margin:0;padding:14px;box-sizing:border-box;font-family:system-ui;background:#0b2b2a;color:#d9fffb";
      const panel = doc.createElement("main");
      panel.style.cssText =
        "height:100%;display:flex;flex-direction:column;justify-content:center;gap:8px;text-align:center";
      const status = doc.createElement("div");
      status.id = "status";
      status.style.cssText = "font-size:12px;opacity:.75";
      status.textContent = "集中中";
      const timer = doc.createElement("div");
      timer.id = "t";
      timer.style.cssText = "font-size:36px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1";
      timer.textContent = remaining !== null ? fmt(remaining) : fmt(elapsed);
      const track = doc.createElement("div");
      track.style.cssText = "height:4px;border-radius:9px;background:#ffffff30;overflow:hidden";
      const bar = doc.createElement("div");
      bar.id = "progress";
      bar.style.cssText = `height:100%;width:${progress * 100}%;background:#72e6c1;transition:width .4s`;
      track.append(bar);
      const actions = doc.createElement("div");
      actions.style.cssText = "display:flex;justify-content:center;gap:8px";
      const pause = doc.createElement("button");
      pause.id = "pause";
      pause.textContent = session?.pausedAt ? "再開" : "一時停止";
      pause.style.cssText =
        "border:0;border-radius:99px;padding:6px 12px;background:#ffffff20;color:inherit;cursor:pointer";
      pause.onclick = () => window.dispatchEvent(new Event("studysharp-focus-pause"));
      const end = doc.createElement("button");
      end.textContent = "終了";
      end.style.cssText =
        "border:0;border-radius:99px;padding:6px 12px;background:#72e6c1;color:#0b2b2a;cursor:pointer";
      end.onclick = () => window.dispatchEvent(new Event("studysharp-focus-finish"));
      actions.append(pause, end);
      panel.append(status, timer, track, actions);
      doc.body.append(panel);
      pip.current = w;
      w.addEventListener(
        "pagehide",
        () => {
          if (pip.current === w) pip.current = null;
        },
        { once: true },
      );
    } catch {
      toast.error("ミニ表示を開けませんでした。ブラウザーの設定をご確認ください");
    }
  };

  const requestCompletionNotice = () => {
    if (!("Notification" in window)) {
      toast.warning("このブラウザーは通知に対応していません");
    } else if (Notification.permission === "default") {
      void Notification.requestPermission()
        .then((permission) => {
          if (permission !== "granted")
            toast.warning("ブラウザー通知が許可されていないため、終了通知は表示されません");
        })
        .catch(() => toast.error("ブラウザー通知の許可を確認できませんでした"));
    } else if (Notification.permission === "denied") {
      toast.warning("ブラウザー通知が許可されていないため、終了通知は表示されません");
    }
  };

  const update = (patch: Partial<Settings>) => {
    if (!session) return;
    if (patch.completionNotice) requestCompletionNotice();
    const settings = { ...session.settings, ...patch };
    localStorage.setItem(PREF, JSON.stringify(settings));
    save({ ...session, settings });
    if (patch.fullscreen && !document.fullscreenElement)
      document.documentElement.requestFullscreen?.().catch(() => toast.error("全画面表示にできませんでした"));
    if (patch.fullscreen === false && document.fullscreenElement)
      document.exitFullscreen().catch(() => toast.error("全画面表示を終了できませんでした"));
  };

  const start = (durationMin: number, settings: Settings) => {
    localStorage.setItem(PREF, JSON.stringify(settings));
    if (settings.completionNotice) requestCompletionNotice();
    save({
      startedAt: Date.now(),
      durationMin,
      pausedMs: 0,
      pausedAt: null,
      leaves: [],
      memos: [],
      settings,
    });
    setStartOpen(false);
    if (settings.fullscreen)
      document.documentElement.requestFullscreen?.().catch(() => toast.error("全画面表示にできませんでした"));
  };

  const togglePause = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = prev.pausedAt
        ? { ...prev, pausedMs: prev.pausedMs + Date.now() - prev.pausedAt, pausedAt: null }
        : { ...prev, pausedAt: Date.now() };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    const onPause = () => togglePause();
    const onFinish = () => finish();
    window.addEventListener("studysharp-focus-pause", onPause);
    window.addEventListener("studysharp-focus-finish", onFinish);
    return () => {
      window.removeEventListener("studysharp-focus-pause", onPause);
      window.removeEventListener("studysharp-focus-finish", onFinish);
    };
  }, [active, finish, togglePause]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) return;
      if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === "p") {
        event.preventDefault();
        togglePause();
      } else if (key === "f") {
        event.preventDefault();
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => toast.error("全画面表示を終了できませんでした"));
        } else {
          void document.documentElement.requestFullscreen().catch(() => toast.error("全画面表示にできませんでした"));
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, togglePause]);

  const allowed =
    !session ||
    pathname === "/" ||
    session.settings.allowed.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-8 gap-1.5", active && "text-primary")}
        onClick={() => (active ? null : setStartOpen(true))}
        title="集中モード"
      >
        <Crosshair className="h-4 w-4" />
        <span className="hidden lg:inline">{active ? "集中中" : "集中モード"}</span>
      </Button>

      <StartDialog open={startOpen} onOpenChange={setStartOpen} onStart={start} />

      {session && st && (
        <>
          {st.edgeGauge && (
            <div
              aria-hidden
              className="pointer-events-none fixed inset-0 z-[190] transition-[box-shadow] duration-1000"
              style={{
                boxShadow: `inset 0 0 0 ${3 + progress * 3}px color-mix(in oklab, var(--primary) ${
                  30 + progress * 60
                }%, transparent)`,
              }}
            />
          )}

          <div className="fixed left-1/2 top-2 z-[200] -translate-x-1/2 flex items-center gap-1 rounded-full border bg-card/95 px-2 py-1 shadow-lg backdrop-blur">
            <Crosshair className="ml-1 h-4 w-4 text-primary" />
            <span className="px-1 font-mono text-sm font-semibold tabular-nums">
              {remaining !== null ? fmt(remaining) : fmt(elapsed)}
            </span>
            {session.pausedAt && <span className="text-xs text-muted-foreground">一時停止</span>}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={togglePause}
              title="一時停止/再開 (Alt+Shift+P)"
              aria-label="一時停止または再開"
            >
              {session.pausedAt ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                if (document.fullscreenElement)
                  void document.exitFullscreen().catch(() => toast.error("全画面表示を終了できませんでした"));
                else
                  void document.documentElement.requestFullscreen().catch(() => toast.error("全画面表示にできませんでした"));
              }}
              title={isFs ? "全画面表示を終了 (Alt+Shift+F)" : "全画面表示 (Alt+Shift+F)"}
              aria-label={isFs ? "全画面表示を終了" : "全画面表示"}
            >
              {isFs ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            {st.memo && <MemoButton session={session} save={save} />}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={openPip}
              title="最前面ミニ表示"
              aria-label="最前面ミニ表示を開く"
            >
              <PictureInPicture2 className="h-3.5 w-3.5" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" title="集中モード設定">
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="z-[210] w-80 max-h-[70vh] overflow-auto">
                <SettingsForm value={st} onChange={update} live />
              </PopoverContent>
            </Popover>
            <HoldButton seconds={st.exitHold} onDone={finish} />
          </div>

          {st.fullscreen && !isFs && (
            <button
              onClick={() =>
                document.documentElement.requestFullscreen?.().catch(() => toast.error("全画面表示にできませんでした"))
              }
              className="fixed left-1/2 top-14 z-[200] -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground shadow"
            >
              <Maximize2 className="h-3.5 w-3.5" /> 全画面に戻る
            </button>
          )}
          <span className="sr-only">ショートカット: Alt+Shift+P で一時停止または再開、Alt+Shift+F で全画面表示を切り替え</span>

          {!allowed && (
            <div className="fixed inset-0 z-[185] grid place-items-center bg-background/95 p-6 backdrop-blur">
              <div className="max-w-md space-y-4 text-center">
                <ShieldAlert className="mx-auto h-10 w-10 text-primary" />
                <h2 className="text-2xl font-bold">集中モード中です</h2>
                <p className="text-sm text-muted-foreground">
                  このページは集中モードでは使えません。勉強アプリに戻りましょう。
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {FOCUS_APPS.filter((a) => st.allowed.includes(a.to)).map((a) => (
                    <Button key={a.to} asChild variant="outline" size="sm">
                      <Link to={a.to}>{a.label}</Link>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <SummaryDialog data={summary} onClose={() => setSummary(null)} userId={user?.id} />
    </>
  );
}

/* ---------- 部品 ---------- */

function SettingsForm({
  value,
  onChange,
  live,
}: {
  value: Settings;
  onChange: (p: Partial<Settings>) => void;
  live?: boolean;
}) {
  const toggles: [keyof Settings, string, string][] = [
    ["fullscreen", "全画面表示", "タブやタスクバーを隠す"],
    ["wakeLock", "スリープ防止", "画面が暗くならない"],
    ["leaveLog", "離脱の記録", "別タブ・別アプリへの移動を記録（無音）"],
    ["blockLeave", "タブ閉じの確認", "閉じる・外部サイト移動の前に確認"],
    ["titleTimer", "タブに残り時間", "タブのタイトルに時間を表示"],
    ["completionNotice", "セッション完了通知", "時間終了時に別タブでも通知"],
    ["edgeGauge", "画面枠ゲージ", "画面のふちが時間とともに濃くなる"],
    ["memo", "あとで調べるメモ", "浮かんだ雑念を書いて封印"],
  ];
  return (
    <div className="space-y-3 text-sm">
      {live && <p className="font-semibold">集中モード設定（すぐ反映）</p>}
      {toggles.map(([k, l, d]) => (
        <div key={k} className="flex items-start justify-between gap-3">
          <div>
            <Label className="text-sm">{l}</Label>
            <p className="text-xs text-muted-foreground">{d}</p>
          </div>
          <Switch checked={!!value[k]} onCheckedChange={(v) => onChange({ [k]: v } as any)} />
        </div>
      ))}
      <div className="space-y-2 rounded-lg border p-3">
        <div>
          <Label className="text-sm">ブラウザー環境音</Label>
          <p className="text-xs text-muted-foreground">音声はこの端末内で生成し、外部へ送信しません</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["off", "オフ"],
              ["rain", "雨音風"],
              ["brown", "低音ノイズ"],
            ] as [AmbientSound, string][]
          ).map(([sound, label]) => (
            <Button
              key={sound}
              size="sm"
              variant={value.ambientSound === sound ? "default" : "outline"}
              onClick={() => onChange({ ambientSound: sound })}
            >
              {label}
            </Button>
          ))}
        </div>
        {value.ambientSound !== "off" && (
          <label className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>音量</span>
            <input
              aria-label="環境音の音量"
              className="min-w-0 flex-1 accent-primary"
              type="range"
              min={0}
              max={60}
              value={Math.min(60, Math.max(0, value.ambientVolume))}
              onChange={(event) => onChange({ ambientVolume: Number(event.target.value) })}
            />
            <span className="w-8 text-right tabular-nums">
              {Math.min(60, Math.max(0, value.ambientVolume))}%
            </span>
          </label>
        )}
      </div>
      <div>
        <Label className="text-sm">見た目</Label>
        <div className="mt-1 flex gap-1">
          {(
            [
              ["normal", "通常"],
              ["mono", "モノトーン"],
              ["dim", "ひかえめ"],
            ] as [Visual, string][]
          ).map(([v, l]) => (
            <Button
              key={v}
              size="sm"
              variant={value.visual === v ? "default" : "outline"}
              onClick={() => onChange({ visual: v })}
            >
              {l}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-sm">使えるアプリ</Label>
        <div className="mt-1 flex flex-wrap gap-1">
          {FOCUS_APPS.map((a) => {
            const on = value.allowed.includes(a.to);
            return (
              <Button
                key={a.to}
                size="sm"
                variant={on ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() =>
                  onChange({
                    allowed: on ? value.allowed.filter((x) => x !== a.to) : [...value.allowed, a.to],
                  })
                }
              >
                {a.label}
              </Button>
            );
          })}
        </div>
      </div>
      {!live && (
        <div>
          <Label className="text-sm">終了のしかた</Label>
          <div className="mt-1 flex gap-1">
            {([0, 3, 5] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={value.exitHold === s ? "default" : "outline"}
                onClick={() => onChange({ exitHold: s })}
              >
                {s ? `${s}秒長押し` : "すぐ終了"}
              </Button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            キーボード入力はいつも通り使えます。終了方法は開始後は変更できません。
          </p>
        </div>
      )}
    </div>
  );
}

function StartDialog({
  open,
  onOpenChange,
  onStart,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStart: (min: number, s: Settings) => void;
}) {
  const [min, setMin] = useState(25);
  const [s, setS] = useState<Settings>(DEFAULTS);
  useEffect(() => {
    if (open) setS({ ...DEFAULTS, ...(load<Settings>(PREF) ?? {}) });
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>集中モードを始める</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm">時間</Label>
            <div className="mt-1 flex flex-wrap gap-1">
              {[25, 50, 90, 0].map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={min === m ? "default" : "outline"}
                  onClick={() => setMin(m)}
                >
                  {m ? `${m}分` : "時間なし"}
                </Button>
              ))}
              <Input
                type="number"
                min={1}
                max={480}
                className="h-8 w-20"
                value={min || ""}
                placeholder="分"
                onChange={(e) => setMin(Math.max(0, Math.min(480, Number(e.target.value) || 0)))}
              />
            </div>
          </div>
          <SettingsForm value={s} onChange={(p) => setS((x) => ({ ...x, ...p }))} />
          <Button className="w-full" disabled={!s.allowed.length} onClick={() => onStart(min, s)}>
            <Crosshair className="mr-1.5 h-4 w-4" /> 開始
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HoldButton({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [p, setP] = useState(0);
  const t = useRef<number | null>(null);
  const stop = () => {
    if (t.current) cancelAnimationFrame(t.current);
    t.current = null;
    setP(0);
  };
  const begin = () => {
    if (!seconds) return onDone();
    const s0 = performance.now();
    const step = () => {
      const r = (performance.now() - s0) / (seconds * 1000);
      if (r >= 1) {
        stop();
        onDone();
        return;
      }
      setP(r);
      t.current = requestAnimationFrame(step);
    };
    t.current = requestAnimationFrame(step);
  };
  return (
    <button
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      title={seconds ? `${seconds}秒長押しで終了` : "終了"}
      className="relative inline-flex h-7 items-center gap-1 overflow-hidden rounded-full bg-muted px-2.5 text-xs select-none"
    >
      <span className="absolute inset-y-0 left-0 bg-primary/30" style={{ width: `${p * 100}%` }} />
      <LogOut className="relative h-3.5 w-3.5" />
      <span className="relative">{seconds ? "長押しで終了" : "終了"}</span>
    </button>
  );
}

function MemoButton({ session, save }: { session: Session; save: (s: Session) => void }) {
  const [v, setV] = useState("");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="relative h-7 w-7" title="あとで調べるメモ">
          <StickyNote className="h-3.5 w-3.5" />
          {session.memos.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1 text-[9px] text-primary-foreground">
              {session.memos.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[210] w-72 space-y-2">
        <p className="text-xs text-muted-foreground">
          気になったことを書いて封印。集中が終わるまで見られません。
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!v.trim()) return;
            save({ ...session, memos: [...session.memos, v.trim()] });
            setV("");
            toast.success("封印しました");
          }}
        >
          <Input autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="例：あの動画見たい" />
        </form>
      </PopoverContent>
    </Popover>
  );
}

function SummaryDialog({
  data,
  onClose,
  userId,
}: {
  data: (Session & { endedAt: number }) | null;
  onClose: () => void;
  userId?: string;
}) {
  const [saving, setSaving] = useState(false);
  if (!data) return null;
  const total = elapsedOf({ ...data, pausedAt: data.pausedAt }, data.endedAt);
  const leaveMs = data.leaves.reduce((s, l) => s + l.ms, 0);
  const rate = total > 0 ? Math.max(0, Math.round((1 - leaveMs / total) * 100)) : 100;
  const minutes = Math.round((total - leaveMs) / 60000);

  const record = async () => {
    if (!userId || minutes <= 0) return;
    setSaving(true);
    const start = new Date(data.startedAt);
    const { error } = await supabase.from("study_logs").insert({
      user_id: userId,
      date: localDateStr(),
      duration_minutes: minutes,
      content: `集中モード（集中維持率${rate}%）`,
      start_time: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
    } as any);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`${minutes}分を記録しました`);
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>集中おつかれさま</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="集中時間" value={fmt(total - leaveMs)} />
          <Stat label="集中維持率" value={`${rate}%`} />
          <Stat label="離脱" value={`${data.leaves.length}回`} />
        </div>
        {data.memos.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-semibold">封印していたメモ</p>
            <ul className="max-h-40 list-disc overflow-auto pl-5 text-sm">
              {data.memos.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-2">
          <Button className="flex-1" disabled={saving || minutes <= 0} onClick={record}>
            勉強記録に{minutes}分を追加
          </Button>
          <Button variant="outline" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
