import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Crosshair,
  Settings2,
  Maximize2,
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
type Settings = {
  fullscreen: boolean;
  wakeLock: boolean;
  leaveLog: boolean;
  blockLeave: boolean;
  titleTimer: boolean;
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
  const hiddenAt = useRef<number | null>(null);
  const wake = useRef<any>(null);
  const pip = useRef<Window | null>(null);
  const baseTitle = useRef<string>("");

  useEffect(() => {
    setSession(load<Session>(KEY));
    openStartDialog = () => setStartOpen(true);
    return () => {
      openStartDialog = null;
    };
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
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    pip.current?.close();
  }, [session, save]);

  // 時間終了
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !session?.pausedAt) {
      toast.success("集中時間が終了しました");
      finish();
    }
  }, [remaining, finish, session?.pausedAt]);

  // 全画面監視
  useEffect(() => {
    const on = () => setIsFs(!!document.fullscreenElement);
    on();
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  // スリープ防止
  useEffect(() => {
    if (!active || !st?.wakeLock) return;
    const nav: any = navigator;
    const req = async () => {
      try {
        if (document.visibilityState === "visible" && nav.wakeLock)
          wake.current = await nav.wakeLock.request("screen");
      } catch {
        /* 非対応 */
      }
    };
    req();
    document.addEventListener("visibilitychange", req);
    return () => {
      document.removeEventListener("visibilitychange", req);
      wake.current?.release?.().catch?.(() => {});
      wake.current = null;
    };
  }, [active, st?.wakeLock]);

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
    if (!active || !st?.titleTimer) return;
    if (!baseTitle.current) baseTitle.current = document.title.replace(/^\[.*?\]\s*/, "");
    document.title = `[${remaining !== null ? fmt(remaining) : fmt(elapsed)} 集中中] ${baseTitle.current}`;
  });
  useEffect(() => {
    if (!active && baseTitle.current) {
      document.title = baseTitle.current;
      baseTitle.current = "";
    }
  }, [active]);

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
  });

  const openPip = async () => {
    const dp = (window as any).documentPictureInPicture;
    if (!dp) return toast.error("このブラウザはミニ表示に対応していません");
    const w: Window = await dp.requestWindow({ width: 220, height: 110 });
    w.document.body.style.cssText =
      "margin:0;display:grid;place-items:center;font-family:system-ui;background:#0b2b2a;color:#d9fffb";
    w.document.body.innerHTML =
      '<div style="text-align:center"><div style="font-size:12px;opacity:.7">Study# 集中中</div><div id="t" style="font-size:36px;font-weight:700;font-variant-numeric:tabular-nums">--:--</div></div>';
    pip.current = w;
  };

  const update = (patch: Partial<Settings>) => {
    if (!session) return;
    const settings = { ...session.settings, ...patch };
    localStorage.setItem(PREF, JSON.stringify(settings));
    save({ ...session, settings });
    if (patch.fullscreen && !document.fullscreenElement)
      document.documentElement.requestFullscreen?.().catch(() => {});
    if (patch.fullscreen === false && document.fullscreenElement)
      document.exitFullscreen().catch(() => {});
  };

  const start = (durationMin: number, settings: Settings) => {
    localStorage.setItem(PREF, JSON.stringify(settings));
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
    if (settings.fullscreen) document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const togglePause = () => {
    if (!session) return;
    if (session.pausedAt)
      save({ ...session, pausedMs: session.pausedMs + Date.now() - session.pausedAt, pausedAt: null });
    else save({ ...session, pausedAt: Date.now() });
  };

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
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={togglePause} title="一時停止/再開">
              {session.pausedAt ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </Button>
            {st.memo && <MemoButton session={session} save={save} />}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={openPip} title="最前面ミニ表示">
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
              onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
              className="fixed left-1/2 top-14 z-[200] -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground shadow"
            >
              <Maximize2 className="h-3.5 w-3.5" /> 全画面に戻る
            </button>
          )}

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
