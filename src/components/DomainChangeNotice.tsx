import { useEffect, useState } from "react";

const OLD_HOST = "sharp-voton.lovable.app";
const NEW_URL = "https://sharp.voton.app";
const NEW_HOST = "sharp.voton.app";
const COUNTDOWN_SECONDS = 8;
const DISMISS_KEY = "vtn-domain-change-dismissed";

/**
 * Old-domain welcome screen: when someone opens the app on the former
 * lovable.app URL, tell them the domain has changed and move them to the
 * new domain. Only rendered if the server did not already redirect.
 */
export function DomainChangeNotice() {
  const [visible, setVisible] = useState(false);
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (window.location.hostname !== OLD_HOST) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* storage blocked: still show once */
    }
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (remaining <= 0) {
      window.location.replace(NEW_URL);
      return;
    }
    const timer = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [visible, remaining]);

  if (!visible) return null;

  const goToNewDomain = () => window.location.replace(NEW_URL);
  const stayHere = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="ドメイン移転のお知らせ"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
        <h1 className="text-2xl font-bold text-foreground">ドメインが新しくなりました</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Study# は新しいURLに引っ越しました。
          <br />
          {remaining} 秒後に自動的に移動します。
        </p>
        <p className="mt-3 text-lg font-bold text-primary">{NEW_HOST}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={goToNewDomain}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            今すぐ移動
          </button>
          <button
            onClick={stayHere}
            className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:opacity-80"
          >
            このまま使う
          </button>
        </div>
      </div>
    </div>
  );
}
