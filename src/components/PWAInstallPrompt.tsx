import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Share } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip if already installed
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;
    // Skip on Lovable preview / iframe
    const isIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const isPreview =
      window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovableproject.com");
    if (isIframe || isPreview) return;
    // Respect cooldown
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissed && Date.now() - dismissed < COOLDOWN_MS) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS Safari has no beforeinstallprompt — show manual hint
    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIOS) {
      setIosHint(true);
      setShow(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    } else {
      dismiss();
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(420px,calc(100vw-2rem))] rounded-2xl border bg-card shadow-xl p-4">
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 p-1 rounded hover:bg-muted text-muted-foreground"
        aria-label="閉じる"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <div className="font-semibold">StudyΩ をホーム画面に追加</div>
          {iosHint ? (
            <p className="text-xs text-muted-foreground mt-1">
              下の <Share className="inline h-3 w-3 align-text-bottom" /> 共有メニューから
              「ホーム画面に追加」を選んでください。
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              アプリのようにすばやく起動できます。
            </p>
          )}
        </div>
      </div>
      {!iosHint && (
        <div className="flex gap-2 mt-3 justify-end">
          <Button size="sm" variant="ghost" onClick={dismiss}>あとで</Button>
          <Button size="sm" onClick={install}>インストール</Button>
        </div>
      )}
    </div>
  );
}
