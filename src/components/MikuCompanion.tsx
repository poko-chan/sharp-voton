import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "lovable.miku.enabled.v1";

function readEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
}

export function useMikuEnabled() {
  const [enabled, setEnabled] = useState<boolean>(readEnabled());
  useEffect(() => {
    const onStorage = () => setEnabled(readEnabled());
    window.addEventListener("storage", onStorage);
    window.addEventListener("miku-toggle", onStorage as any);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("miku-toggle", onStorage as any);
    };
  }, []);
  const toggle = (v: boolean) => {
    try { localStorage.setItem(STORAGE_KEY, v ? "1" : "0"); } catch {}
    setEnabled(v);
    try { window.dispatchEvent(new Event("miku-toggle")); } catch {}
  };
  return { enabled, toggle };
}

/**
 * かわいいピクセル風の初音ミクが画面下を歩き回る装飾コンポーネント。
 * Settings から ON/OFF。CSS SVG のみ・軽量。
 */
export function MikuCompanion() {
  const { enabled } = useMikuEnabled();
  const [x, setX] = useState(20);
  const [dir, setDir] = useState<1 | -1>(1);
  const [step, setStep] = useState(0);
  const [blink, setBlink] = useState(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let lastTs = performance.now();
    let t = 0;
    const tick = (ts: number) => {
      const dt = Math.min(40, ts - lastTs); lastTs = ts;
      t += dt;
      setX((prev) => {
        const w = window.innerWidth - 80;
        let next = prev + dir * (dt * 0.05);
        let d = dir;
        if (next > w) { next = w; d = -1; }
        if (next < 8) { next = 8; d = 1; }
        if (d !== dir) setDir(d);
        return next;
      });
      setStep(t / 140);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [enabled, dir]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3200 + Math.random() * 2000);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  const bob = Math.abs(Math.sin(step)) * 2.5;
  const legSwing = Math.sin(step) * 14;
  const armSwing = Math.sin(step) * 18;

  return (
    <div
      aria-hidden
      style={{ left: x, bottom: 4 + bob, transform: `scaleX(${dir})` }}
      className="fixed z-[55] pointer-events-none transition-transform duration-200 will-change-transform"
    >
      <MikuSprite legSwing={legSwing} armSwing={armSwing} blink={blink} />
    </div>
  );
}

function MikuSprite({ legSwing, armSwing, blink }: { legSwing: number; armSwing: number; blink: boolean }) {
  // Chibi desktop-mate Hatsune Miku. Smooth SVG with gradients.
  return (
    <svg width="80" height="110" viewBox="0 0 80 110" style={{ filter: "drop-shadow(0 6px 6px rgba(0,0,0,0.25))" }}>
      <defs>
        <linearGradient id="hairG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7be3da" />
          <stop offset="50%" stopColor="#39c5bb" />
          <stop offset="100%" stopColor="#1f8a82" />
        </linearGradient>
        <linearGradient id="skirtG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2aa39a" />
          <stop offset="100%" stopColor="#176962" />
        </linearGradient>
        <radialGradient id="cheek" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ff9fb1" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ff9fb1" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="eyeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1ec6c0" />
          <stop offset="100%" stopColor="#0a6f6b" />
        </linearGradient>
      </defs>

      {/* Back twintail (left) */}
      <path d={`M 14 34 Q 4 60 ${10 + armSwing * 0.2} 92 L 18 92 Q 22 62 22 38 Z`} fill="url(#hairG)" />
      {/* Back twintail (right) */}
      <path d={`M 66 34 Q 76 60 ${70 - armSwing * 0.2} 92 L 62 92 Q 58 62 58 38 Z`} fill="url(#hairG)" />
      {/* Twintail tie ribbons */}
      <rect x="14" y="34" width="10" height="4" rx="1" fill="#176962" />
      <rect x="56" y="34" width="10" height="4" rx="1" fill="#176962" />

      {/* Body / sailor top */}
      <path d="M 28 55 L 52 55 L 56 78 L 24 78 Z" fill="#ffffff" stroke="#cfeeeb" strokeWidth="0.8" />
      {/* Sailor collar */}
      <path d="M 30 55 L 50 55 L 46 64 L 34 64 Z" fill="#2aa39a" />
      {/* Tie */}
      <path d="M 38 60 L 42 60 L 41 70 L 39 70 Z" fill="#e94c6f" />
      {/* Sleeves */}
      <ellipse cx="26" cy="60" rx="5" ry="6" fill="#2aa39a" />
      <ellipse cx="54" cy="60" rx="5" ry="6" fill="#2aa39a" />
      {/* Arms */}
      <g style={{ transform: `rotate(${armSwing * 0.4}deg)`, transformOrigin: "26px 62px" }}>
        <rect x="23" y="62" width="6" height="14" rx="3" fill="#ffe5d4" />
      </g>
      <g style={{ transform: `rotate(${-armSwing * 0.4}deg)`, transformOrigin: "54px 62px" }}>
        <rect x="51" y="62" width="6" height="14" rx="3" fill="#ffe5d4" />
      </g>

      {/* Skirt */}
      <path d="M 24 76 L 56 76 L 60 92 L 20 92 Z" fill="url(#skirtG)" />
      <path d="M 24 76 L 56 76 L 56 80 L 24 80 Z" fill="#0e524d" opacity="0.4" />

      {/* Legs (swing) */}
      <g style={{ transform: `translateY(${Math.max(0, legSwing) * 0.2}px) rotate(${legSwing}deg)`, transformOrigin: "34px 92px" }}>
        <rect x="31" y="92" width="6" height="12" rx="2" fill="#ffe5d4" />
        <rect x="29" y="102" width="10" height="6" rx="2" fill="#1a1a1a" />
      </g>
      <g style={{ transform: `translateY(${Math.max(0, -legSwing) * 0.2}px) rotate(${-legSwing}deg)`, transformOrigin: "46px 92px" }}>
        <rect x="43" y="92" width="6" height="12" rx="2" fill="#ffe5d4" />
        <rect x="41" y="102" width="10" height="6" rx="2" fill="#1a1a1a" />
      </g>

      {/* Head */}
      <ellipse cx="40" cy="36" rx="16" ry="17" fill="#ffe9d8" />
      {/* Hair front */}
      <path d="M 24 32 Q 26 16 40 14 Q 54 16 56 32 L 54 30 Q 50 22 40 22 Q 30 22 26 30 Z" fill="url(#hairG)" />
      {/* Hair side bangs */}
      <path d="M 24 32 Q 22 40 24 48 L 28 46 Q 27 38 28 32 Z" fill="url(#hairG)" />
      <path d="M 56 32 Q 58 40 56 48 L 52 46 Q 53 38 52 32 Z" fill="url(#hairG)" />
      {/* Side bangs over face */}
      <path d="M 27 28 Q 32 32 30 42 L 28 40 Q 26 34 27 28 Z" fill="url(#hairG)" />
      <path d="M 53 28 Q 48 32 50 42 L 52 40 Q 54 34 53 28 Z" fill="url(#hairG)" />

      {/* Cheeks */}
      <ellipse cx="31" cy="40" rx="3" ry="2" fill="url(#cheek)" />
      <ellipse cx="49" cy="40" rx="3" ry="2" fill="url(#cheek)" />

      {/* Eyes */}
      {blink ? (
        <>
          <path d="M 32 36 Q 35 38 38 36" stroke="#0a3f3c" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <path d="M 42 36 Q 45 38 48 36" stroke="#0a3f3c" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="35" cy="37" rx="2.6" ry="3.2" fill="url(#eyeG)" />
          <ellipse cx="45" cy="37" rx="2.6" ry="3.2" fill="url(#eyeG)" />
          <circle cx="35.6" cy="36.2" r="0.9" fill="#fff" />
          <circle cx="45.6" cy="36.2" r="0.9" fill="#fff" />
          <circle cx="34.6" cy="38" r="0.5" fill="#fff" opacity="0.7" />
          <circle cx="44.6" cy="38" r="0.5" fill="#fff" opacity="0.7" />
        </>
      )}

      {/* Mouth */}
      <path d="M 38.5 43 Q 40 44.5 41.5 43" stroke="#c46161" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
  );
}