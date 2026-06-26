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
  const [bob, setBob] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let lastTs = performance.now();
    let t = 0;
    const step = (ts: number) => {
      const dt = Math.min(40, ts - lastTs); lastTs = ts;
      t += dt;
      setX((prev) => {
        const w = window.innerWidth - 60;
        let next = prev + dir * (dt * 0.04);
        let d = dir;
        if (next > w) { next = w; d = -1; }
        if (next < 8) { next = 8; d = 1; }
        if (d !== dir) setDir(d);
        return next;
      });
      setBob(Math.abs(Math.sin(t / 180)) * 3);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [enabled, dir]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden
      style={{ left: x, bottom: 4 + bob, transform: `scaleX(${dir})` }}
      className="fixed z-[55] pointer-events-none transition-transform duration-200 will-change-transform"
    >
      <MikuSprite />
    </div>
  );
}

function MikuSprite() {
  // Pixel-art-ish SVG: teal twintails, white shirt, teal skirt, boots.
  return (
    <svg width="48" height="64" viewBox="0 0 24 32" shapeRendering="crispEdges" style={{ imageRendering: "pixelated" as any }}>
      {/* twintails (background) */}
      <rect x="2" y="6" width="2" height="14" fill="#39c5bb" />
      <rect x="20" y="6" width="2" height="14" fill="#39c5bb" />
      <rect x="3" y="20" width="2" height="3" fill="#39c5bb" />
      <rect x="19" y="20" width="2" height="3" fill="#39c5bb" />
      {/* hair top */}
      <rect x="6" y="4" width="12" height="2" fill="#2aa39a" />
      <rect x="5" y="6" width="14" height="6" fill="#39c5bb" />
      {/* face */}
      <rect x="7" y="8" width="10" height="6" fill="#ffe5d4" />
      {/* eyes */}
      <rect x="9" y="10" width="2" height="2" fill="#0a6f6b" />
      <rect x="13" y="10" width="2" height="2" fill="#0a6f6b" />
      {/* mouth */}
      <rect x="11" y="13" width="2" height="1" fill="#c46161" />
      {/* neck */}
      <rect x="10" y="14" width="4" height="1" fill="#ffe5d4" />
      {/* tie */}
      <rect x="11" y="15" width="2" height="2" fill="#e94c6f" />
      {/* shirt */}
      <rect x="7" y="15" width="10" height="6" fill="#ffffff" stroke="#39c5bb" strokeWidth="0.3" />
      <rect x="6" y="16" width="1" height="5" fill="#39c5bb" />
      <rect x="17" y="16" width="1" height="5" fill="#39c5bb" />
      {/* skirt */}
      <rect x="6" y="21" width="12" height="4" fill="#2aa39a" />
      {/* legs */}
      <rect x="9" y="25" width="2" height="4" fill="#222" />
      <rect x="13" y="25" width="2" height="4" fill="#222" />
      {/* boots */}
      <rect x="8" y="29" width="4" height="2" fill="#111" />
      <rect x="12" y="29" width="4" height="2" fill="#111" />
    </svg>
  );
}