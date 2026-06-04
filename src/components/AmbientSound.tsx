import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Music2, Volume2, VolumeX, X } from "lucide-react";

type Preset = "off" | "birds" | "rain" | "wave" | "fire";

/**
 * Procedural ambient sounds using Web Audio API — no external assets.
 * Birds: high-pass filtered random chirps. Rain: pink-ish noise. Wave: slow LFO on noise.
 * Fire: noise with crackle bursts.
 */
export function AmbientSound() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hidden =
    path === "/login" || path === "/admin-login" || path === "/help" ||
    path === "/" || path === "/privacy" || path === "/terms";
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<Preset>("off");
  const [vol, setVol] = useState(0.4);
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
  }, [vol]);

  const stop = () => {
    cleanupRef.current();
    cleanupRef.current = () => {};
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
    }
  };

  if (hidden) return null;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-20 right-4 z-40 h-11 w-11 rounded-full bg-card border shadow-lg flex items-center justify-center hover:bg-accent transition"
        title="環境音"
        aria-label="環境音"
      >
        {preset === "off" ? <Music2 className="h-5 w-5" /> : <Volume2 className="h-5 w-5 text-primary" />}
      </button>
      {open && (
        <div className="fixed bottom-32 right-4 z-40 w-64 rounded-xl border bg-popover p-3 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">環境音</div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              ["off", "オフ", "🔇"],
              ["birds", "鳥のさえずり", "🐦"],
              ["rain", "雨音", "🌧️"],
              ["wave", "波の音", "🌊"],
              ["fire", "焚き火", "🔥"],
            ] as [Preset, string, string][]).map(([k, label, emoji]) => (
              <button
                key={k}
                onClick={() => start(k)}
                className={`text-xs px-2 py-2 rounded-md border text-left flex items-center gap-1.5 ${
                  preset === k ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
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
              className="flex-1"
            />
          </div>
        </div>
      )}
    </>
  );
}