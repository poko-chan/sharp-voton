import { useEffect, useState } from "react";

const OLD_HOST = "sharp-voton.lovable.app";
const NEW_ORIGIN = "https://sharp.voton.app";
const NEW_HOST = "sharp.voton.app";
const BANNER_KEY = "vtn-domain-banner-dismissed";

/**
 * Domain move notice.
 * - Old lovable.app host: the app is not usable there; always move to the new domain.
 * - New host: show a dismissible banner once telling users the official URL changed.
 */
export function DomainChangeNotice() {
  const [mode, setMode] = useState<"none" | "old" | "banner">("none");

  useEffect(() => {
    const host = window.location.hostname;
    if (host === OLD_HOST) {
      setMode("old");
      const { pathname, search, hash } = window.location;
      window.location.replace(NEW_ORIGIN + pathname + search + hash);
      return;
    }
    if (host !== NEW_HOST) return;
    try {
      if (localStorage.getItem(BANNER_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setMode("banner");
  }, []);

  if (mode === "old") {
    return (
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-background p-4"
        role="dialog"
        aria-modal="true"
        aria-label="ドメイン移転のお知らせ"
      >
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
          <h1 className="text-2xl font-bold text-foreground">ドメインが新しくなりました</h1>
          <p className="mt-4 text-sm text-muted-foreground">新しいURLへ移動しています…</p>
          <a href={NEW_ORIGIN} className="mt-3 block text-lg font-bold text-primary">
            {NEW_HOST}
          </a>
        </div>
      </div>
    );
  }

  if (mode === "banner") {
    const close = () => {
      try {
        localStorage.setItem(BANNER_KEY, "1");
      } catch {
        /* ignore */
      }
      setMode("none");
    };
    return (
      <div className="fixed inset-x-0 top-0 z-[110] flex items-center justify-center gap-3 border-b border-border bg-card px-4 py-2 text-sm text-foreground shadow">
        <span>
          【お知らせ】Study#の公式URLが <strong className="text-primary">{NEW_HOST}</strong> に変わりました。ブックマークの再登録をお願いします。
        </span>
        <button onClick={close} aria-label="閉じる" className="rounded px-2 text-muted-foreground hover:text-foreground">
          ×
        </button>
      </div>
    );
  }

  return null;
}
