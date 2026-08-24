import { useEffect, useRef, useState } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { LANGS } from "@/lib/i18n";

/**
 * 独自UIの言語切替。
 * 翻訳エンジンとして Google 翻訳を使うが、Google のUI（プルダウン/バナー）は一切表示しない。
 * 日本語がデフォルト。日本語以外を選んだ時だけ翻訳スクリプトを読み込む。
 * AI Gateway は使用しない。
 */

const SCRIPT_ID = "google-translate-script";
const CONTAINER_ID = "google_translate_element";
const COOKIE = "googtrans";

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement: new (
          options: { pageLanguage: string; autoDisplay?: boolean },
          containerId: string,
        ) => unknown;
      };
    };
    googleTranslateElementInit?: () => void;
  }
}

function readCookie(): string {
  if (typeof document === "undefined") return "ja";
  const m = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
  if (!m) return "ja";
  const parts = decodeURIComponent(m[1]).split("/");
  return parts[2] || "ja";
}

function writeCookie(lang: string) {
  const host = window.location.hostname;
  const domains = ["", `; domain=${host}`, `; domain=.${host}`];
  for (const d of domains) {
    // clear first
    document.cookie = `${COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;
  }
  if (lang !== "ja") {
    document.cookie = `${COOKIE}=/ja/${lang}; path=/`;
  }
}

function loadTranslateScript() {
  if (document.getElementById(SCRIPT_ID)) return;
  window.googleTranslateElementInit = () => {
    if (!window.google?.translate?.TranslateElement) return;
    try {
      new window.google.translate.TranslateElement(
        { pageLanguage: "ja", autoDisplay: false },
        CONTAINER_ID,
      );
    } catch (e) {
      console.error("Google Translate init failed", e);
    }
  };
  const s = document.createElement("script");
  s.id = SCRIPT_ID;
  s.async = true;
  s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  document.body.appendChild(s);
}

export function GoogleTranslateWidget({ className = "" }: { className?: string }) {
  const [lang, setLang] = useState("ja");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cur = readCookie();
    setLang(cur);
    if (cur !== "ja") loadTranslateScript();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (code: string) => {
    if (code === lang) { setOpen(false); return; }
    writeCookie(code);
    window.location.reload();
  };

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <div ref={boxRef} className={`relative ${className}`} data-no-translate translate="no">
      {/* Google 翻訳の描画先（非表示） */}
      <div id={CONTAINER_ID} className="hidden" aria-hidden="true" />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="言語を選択"
        aria-expanded={open}
        className="notranslate inline-flex h-8 items-center gap-1.5 rounded-full border border-border/50 bg-background/60 px-3 text-xs font-medium text-foreground backdrop-blur transition-colors hover:bg-accent/40"
      >
        <Globe className="h-3.5 w-3.5 opacity-70" />
        <span>{current.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="notranslate absolute right-0 z-50 mt-2 max-h-72 w-44 overflow-y-auto rounded-xl border border-border/60 bg-popover/95 p-1 shadow-xl backdrop-blur-xl">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => pick(l.code)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs text-popover-foreground hover:bg-accent/60"
            >
              <span>{l.label}</span>
              {l.code === lang && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
