import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, CornerDownLeft } from "lucide-react";
import { APPS } from "@/lib/app-directory";
import { getFrequent } from "@/lib/recent-activity";

/** Ctrl / ⌘ + K でどこからでも機能を検索して移動できるパレット */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQ("");
        setActive(0);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) {
      const freq = getFrequent(6).map((f) => f.to);
      const top = APPS.filter((a) => freq.includes(a.to));
      return top.length ? top : APPS.slice(0, 6);
    }
    return APPS.filter(
      (a) => a.label.toLowerCase().includes(term) || a.keywords.toLowerCase().includes(term),
    ).slice(0, 10);
  }, [q, open]);

  if (!open) return null;

  const go = (to: string) => { setOpen(false); navigate({ to }); };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-background/60 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[min(560px,100%)] overflow-hidden rounded-2xl border bg-popover shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter" && results[active]) go(results[active].to);
            }}
            placeholder="機能やページを検索（Ctrl + K）"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">見つかりませんでした</div>
          )}
          {results.map((r, i) => (
            <button
              key={r.to + r.label}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r.to)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${
                i === active ? "bg-accent" : ""
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <r.icon className="h-4 w-4" />
              </span>
              <span className="flex-1 truncate">{r.label}</span>
              <span className="text-[10px] text-muted-foreground">{r.group}</span>
              {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
