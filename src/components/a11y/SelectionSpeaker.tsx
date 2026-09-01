import { useEffect, useState } from "react";
import { useLocalPrefs } from "@/lib/user-prefs";
import { Volume2 } from "lucide-react";

/** 選択したテキストを読み上げるフローティングボタン（設定でオンのときのみ） */
export function SelectionSpeaker() {
  const { prefs } = useLocalPrefs();
  const [text, setText] = useState("");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!prefs.tts_enabled) { setPos(null); return; }
    const onUp = () => {
      const sel = window.getSelection();
      const t = sel?.toString().trim() ?? "";
      if (!t || !sel || sel.rangeCount === 0) { setPos(null); return; }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      setText(t);
      setPos({ x: r.left + r.width / 2, y: r.top - 8 });
    };
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
    };
  }, [prefs.tts_enabled]);

  if (!prefs.tts_enabled || !pos) return null;

  const speak = () => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      window.speechSynthesis.speak(u);
    } catch { /* 非対応ブラウザ */ }
    setPos(null);
  };

  return (
    <button
      type="button"
      onClick={speak}
      style={{ position: "fixed", left: pos.x, top: pos.y, transform: "translate(-50%, -100%)", zIndex: 90 }}
      className="rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-lg flex items-center gap-1"
    >
      <Volume2 className="h-3.5 w-3.5" />読み上げ
    </button>
  );
}
