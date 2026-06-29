import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Music2, Volume2, VolumeX, X, Link as LinkIcon, Plus, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type Preset = "off" | "birds" | "rain" | "wave" | "fire" | "white" | "pink" | "brown";

/**
 * Procedural ambient sounds using Web Audio API — no external assets.
 * Birds: high-pass filtered random chirps. Rain: pink-ish noise. Wave: slow LFO on noise.
 * Fire: noise with crackle bursts.
 */
export function AmbientSound() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const visible = path === "/timer" || path.startsWith("/timer/");
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<Preset>("off");
  const [vol, setVol] = useState(0.4);
  const { user } = useAuth();
  const [customs, setCustoms] = useState<{ id: string; label: string; url?: string; path?: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem("lovable.ambient.customs.v1") || "[]"); } catch { return []; }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [playingCustomId, setPlayingCustomId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const cleanupRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => {
      cleanupRef.current();
      try { ctxRef.current?.close(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (gainRef.current && ctxRef.current) {
      gainRef.current.gain.setTargetAtTime(vol, ctxRef.current.currentTime, 0.1);
    }
    if (audioRef.current) audioRef.current.volume = vol;
  }, [vol]);

  const stop = () => {
    cleanupRef.current();
    cleanupRef.current = () => {};
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; audioRef.current = null; }
    setPlayingCustomId(null);
  };

  const persistCustoms = (next: typeof customs) => {
    setCustoms(next);
    try { localStorage.setItem("lovable.ambient.customs.v1", JSON.stringify(next)); } catch {}
  };

  const playCustom = async (c: { id: string; url?: string; path?: string }) => {
    stop();
    setPreset("off");
    let url = c.url;
    if (c.path) {
      const { data, error } = await supabase.storage.from("ambient-audio").createSignedUrl(c.path, 60 * 60 * 6);
      if (error || !data) return;
      url = data.signedUrl;
    }
    if (!url) return;
    const a = new Audio(url);
    a.loop = true; a.volume = vol; a.crossOrigin = "anonymous";
    a.play().catch(() => {});
    audioRef.current = a;
    setPlayingCustomId(c.id);
  };

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp3";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("ambient-audio").upload(path, file, { contentType: file.type || undefined });
      if (error) { alert("アップロード失敗: " + error.message); return; }
      const label = newLabel.trim() || file.name.replace(/\.[^.]+$/, "");
      persistCustoms([...customs, { id: crypto.randomUUID(), label, path }]);
      setNewLabel(""); setShowAdd(false);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeCustom = async (c: typeof customs[number]) => {
    if (c.path) {
      try { await supabase.storage.from("ambient-audio").remove([c.path]); } catch {}
    }
    persistCustoms(customs.filter((x) => x.id !== c.id));
  };

  const ensureCtx = () => {
    if (!ctxRef.current) {
      const C = window.AudioContext || (window as any).webkitAudioContext;
      ctxRef.current = new C();
      const g = ctxRef.current.createGain();
      g.gain.value = vol;
      g.connect(ctxRef.current.destination);
      gainRef.current = g;
    }
    return { ctx: ctxRef.current!, out: gainRef.current! };
  };

  const makeNoise = (ctx: AudioContext) => {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  };

  const makeColoredNoise = (ctx: AudioContext, kind: "white" | "pink" | "brown") => {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    if (kind === "white") {
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } else if (kind === "brown") {
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
    return src;
  };

  const start = (p: Preset) => {
    stop();
    setPreset(p);
    if (p === "off") return;
    const { ctx, out } = ensureCtx();
    if (ctx.state === "suspended") ctx.resume();

    if (p === "rain") {
      const src = makeNoise(ctx);
      const hp = ctx.createBiquadFilter();
      hp.type = "lowpass"; hp.frequency.value = 1800;
      const g = ctx.createGain(); g.gain.value = 0.7;
      src.connect(hp).connect(g).connect(out);
      src.start();
      cleanupRef.current = () => { src.stop(); src.disconnect(); hp.disconnect(); g.disconnect(); };
    } else if (p === "wave") {
      const src = makeNoise(ctx);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 600;
      const g = ctx.createGain(); g.gain.value = 0.001;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.15;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.6;
      lfo.connect(lfoGain).connect(g.gain);
      src.connect(lp).connect(g).connect(out);
      src.start(); lfo.start();
      cleanupRef.current = () => { src.stop(); lfo.stop(); src.disconnect(); lp.disconnect(); g.disconnect(); lfo.disconnect(); lfoGain.disconnect(); };
    } else if (p === "fire") {
      const src = makeNoise(ctx);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 800;
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(lp).connect(g).connect(out);
      src.start();
      const crackleInt = setInterval(() => {
        const osc = ctx.createOscillator();
        const og = ctx.createGain();
        osc.frequency.value = 2000 + Math.random() * 4000;
        og.gain.setValueAtTime(0.2, ctx.currentTime);
        og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(og).connect(out);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
      }, 250);
      cleanupRef.current = () => { clearInterval(crackleInt); src.stop(); src.disconnect(); lp.disconnect(); g.disconnect(); };
    } else if (p === "birds") {
      const src = makeNoise(ctx);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1200;
      const ng = ctx.createGain(); ng.gain.value = 0.08;
      src.connect(lp).connect(ng).connect(out);
      src.start();
      const chirpInt = setInterval(() => {
        const o = ctx.createOscillator();
        const og = ctx.createGain();
        const base = 1800 + Math.random() * 2000;
        o.frequency.setValueAtTime(base, ctx.currentTime);
        o.frequency.linearRampToValueAtTime(base + 600, ctx.currentTime + 0.15);
        og.gain.setValueAtTime(0.0, ctx.currentTime);
        og.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
        og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        o.type = "sine";
        o.connect(og).connect(out);
        o.start();
        o.stop(ctx.currentTime + 0.3);
      }, 600 + Math.random() * 400);
      cleanupRef.current = () => { clearInterval(chirpInt); src.stop(); src.disconnect(); lp.disconnect(); ng.disconnect(); };
    } else if (p === "white" || p === "pink" || p === "brown") {
      const src = makeColoredNoise(ctx, p);
      const g = ctx.createGain(); g.gain.value = 0.6;
      src.connect(g).connect(out);
      src.start();
      cleanupRef.current = () => { src.stop(); src.disconnect(); g.disconnect(); };
    }
  };

  if (!visible) return null;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-20 right-4 z-[60] h-12 w-12 rounded-full bg-gradient-to-br from-primary/90 via-primary to-primary/60 text-primary-foreground border border-white/30 ring-1 ring-white/10 shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.7)] backdrop-blur-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300"
        title="音楽 / 環境音"
        aria-label="音楽 / 環境音"
      >
        {preset === "off" ? <Music2 className="h-5 w-5 drop-shadow" /> : <Volume2 className="h-5 w-5 drop-shadow animate-pulse" />}
      </button>
      {open && (
        <div className="fixed bottom-36 right-4 z-[60] w-72 rounded-2xl border border-white/20 bg-popover/95 backdrop-blur-2xl p-4 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] space-y-3 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">🎵 音楽 / 環境音</div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              ["off", "オフ", "🔇"],
              ["birds", "鳥のさえずり", "🐦"],
              ["rain", "雨音", "🌧️"],
              ["wave", "波の音", "🌊"],
              ["fire", "焚き火", "🔥"],
              ["white", "ホワイトノイズ", "⚪"],
              ["pink", "ピンクノイズ", "🌸"],
              ["brown", "ブラウンノイズ", "🟤"],
            ] as [Preset, string, string][]).map(([k, label, emoji]) => (
              <button
                key={k}
                onClick={() => start(k)}
                className={`text-xs px-2 py-2 rounded-lg border text-left flex items-center gap-1.5 transition-all ${
                  preset === k
                    ? "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground border-primary shadow-md scale-[1.02]"
                    : "hover:bg-accent hover:scale-[1.02] border-border/60"
                }`}
              >
                <span>{emoji}</span>
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            {vol === 0 ? <VolumeX className="h-4 w-4 text-muted-foreground" /> : <Volume2 className="h-4 w-4 text-muted-foreground" />}
            <input
              type="range" min={0} max={1} step={0.05} value={vol}
              onChange={(e) => setVol(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
          </div>

          <div className="pt-2 border-t border-border/60 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold flex items-center gap-1"><Music2 className="h-3 w-3" />お気に入りの音楽</div>
              <button className="text-[10px] text-primary hover:underline" onClick={() => setShowAdd((v) => !v)}>
                <Plus className="inline h-3 w-3" />追加
              </button>
            </div>
            {showAdd && (
              <div className="space-y-1.5">
                <input className="w-full text-xs p-1.5 rounded border bg-background" placeholder="名前 (任意・ファイル名を使用)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
                <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                <button
                  className="w-full text-xs py-1.5 rounded bg-primary text-primary-foreground flex items-center justify-center gap-1 disabled:opacity-50"
                  disabled={uploading || !user}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3 w-3" />{uploading ? "アップロード中..." : "音声ファイルをアップロード"}
                </button>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1 border-t border-border/40 mt-1">
                  <LinkIcon className="h-3 w-3" />URL から追加（直リンクのみ）
                </div>
                <input className="w-full text-xs p-1.5 rounded border bg-background" placeholder="https://.../music.mp3" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
                <button
                  className="w-full text-xs py-1 rounded border bg-background hover:bg-accent"
                  onClick={() => {
                    if (!newLabel.trim() || !newUrl.trim()) return;
                    persistCustoms([...customs, { id: crypto.randomUUID(), label: newLabel.trim(), url: newUrl.trim() }]);
                    setNewLabel(""); setNewUrl(""); setShowAdd(false);
                  }}
                >URLを保存</button>
              </div>
            )}
            <div className="max-h-32 overflow-auto space-y-1">
              {customs.length === 0 && <div className="text-[10px] text-muted-foreground">まだ登録されていません</div>}
              {customs.map((c) => (
                <div key={c.id} className={`flex items-center gap-1.5 text-xs rounded border px-2 py-1 ${playingCustomId === c.id ? "bg-primary/15 border-primary" : ""}`}>
                  <button className="flex-1 text-left truncate" onClick={() => playingCustomId === c.id ? stop() : playCustom(c)}>
                    {playingCustomId === c.id ? "⏸" : "▶"} {c.label} {c.path && <span className="text-[9px] text-muted-foreground">📁</span>}
                  </button>
                  <button className="text-muted-foreground hover:text-destructive" onClick={() => removeCustom(c)}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}