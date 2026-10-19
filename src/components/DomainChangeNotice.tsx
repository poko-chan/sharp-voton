import { useEffect, useState } from "react";
import { Globe, ArrowRight, Copy, Check, Bookmark, ShieldCheck, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const OLD_HOST = "sharp-voton.lovable.app";
const NEW_ORIGIN = "https://sharp.voton.app";
const NEW_HOST = "sharp.voton.app";

/** Old host fallback: if the platform redirect ever stops, move users to the new domain. */
export function DomainChangeNotice() {
  useEffect(() => {
    if (window.location.hostname !== OLD_HOST) return;
    const { pathname, search, hash } = window.location;
    window.location.replace(NEW_ORIGIN + pathname + search + hash);
  }, []);
  return null;
}

/** Thin bar under the top bar; opens the full-screen domain change announcement. */
export function DomainChangeBar() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(NEW_ORIGIN);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 border-b border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-primary/15"
      >
        <Globe className="h-3.5 w-3.5 text-primary" />
        <span>ドメイン変更</span>
        <span className="hidden sm:inline text-muted-foreground">— 公式URLが {NEW_HOST} になりました</span>
        <ArrowRight className="h-3.5 w-3.5 text-primary" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl overflow-hidden border-primary/30 p-0">
          <div className="relative bg-gradient-to-br from-primary/25 via-background to-background px-6 py-10 sm:px-10">
            <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-bold tracking-widest text-primary">
                <Globe className="h-3 w-3" /> OFFICIAL DOMAIN MIGRATION
              </span>
              <DialogTitle className="mt-5 text-3xl font-black leading-tight sm:text-4xl">
                Study# の公式URLが
                <br />
                新しくなりました
              </DialogTitle>
              <DialogDescription className="mt-3 text-sm text-muted-foreground">
                これからは下の新しいURLからご利用ください。旧URLからも自動で移動します。
              </DialogDescription>

              <div className="mt-6 flex items-center gap-2 rounded-2xl border border-primary/40 bg-card/80 p-2 pl-4 backdrop-blur">
                <code className="flex-1 truncate text-lg font-bold text-primary sm:text-xl">{NEW_HOST}</code>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "コピーしました" : "コピー"}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">旧URL: {OLD_HOST}（今後は使用しません）</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Bookmark, t: "ブックマーク", d: "お気に入りを新しいURLに登録し直してください。" },
                  { icon: ShieldCheck, t: "データはそのまま", d: "アカウントや学習記録はすべて引き継がれています。" },
                  { icon: KeyRound, t: "パスキー", d: "旧URLで登録したパスキーは設定から再登録が必要です。" },
                ].map((x) => (
                  <div key={x.t} className="rounded-xl border border-border bg-card/70 p-3">
                    <x.icon className="h-4 w-4 text-primary" />
                    <div className="mt-1.5 text-sm font-bold">{x.t}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{x.d}</div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-7 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
              >
                了解しました
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
