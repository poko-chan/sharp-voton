import { useEffect, useState } from "react";

export type PwaDisplayMode = "compact" | "immersive" | "standard";
const KEY = "pwa.display.v1";
const EVT = "pwa-display-change";

/** 学習に集中する画面：PWAでは常に上部バーを隠す */
const FOCUS_PREFIXES = ["/timer", "/makron", "/flashcards", "/notebooks", "/notes", "/meetings/"];

export function isFocusPath(path: string) {
  return FOCUS_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : p + "/"));
}

export function setPwaDisplayMode(m: PwaDisplayMode) {
  try {
    localStorage.setItem(KEY, m);
  } catch {}
  window.dispatchEvent(new Event(EVT));
}

export function usePwaDisplay() {
  const [standalone, setStandalone] = useState(false);
  const [mode, setMode] = useState<PwaDisplayMode>("compact");
  useEffect(() => {
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const read = () => {
      setStandalone(
        !!mq?.matches || (window.navigator as { standalone?: boolean }).standalone === true,
      );
      const v = localStorage.getItem(KEY) as PwaDisplayMode | null;
      setMode(v === "immersive" || v === "standard" ? v : "compact");
    };
    read();
    mq?.addEventListener?.("change", read);
    window.addEventListener(EVT, read);
    return () => {
      mq?.removeEventListener?.("change", read);
      window.removeEventListener(EVT, read);
    };
  }, []);
  return { standalone, mode };
}
