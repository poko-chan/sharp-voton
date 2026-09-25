import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { appsForAccount } from "@/lib/app-directory";
import { useAuth } from "@/lib/auth-context";

export function SearchBar() {
  const { accountKind } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const apps = appsForAccount(accountKind);
  const results = q.trim()
    ? apps
        .filter((app) => `${app.label} ${app.keywords}`.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 8)
    : [];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const go = (to: string) => {
    nav({ to });
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
  };
  return (
    <div className="relative">
      <div className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1.5">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={q}
          aria-label="アプリを検索（/ キー）"
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter" && results[sel]) {
              go(results[sel].to);
            } else if (e.key === "Escape") {
              setQ("");
              inputRef.current?.blur();
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="検索… ( / )"
          className="bg-transparent outline-none text-base sm:text-sm w-28 sm:w-48"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-popover border rounded-md shadow-lg z-50 py-1">
          {results.map((app, i) => (
            <button
              key={app.to}
              onMouseDown={(e) => {
                e.preventDefault();
                go(app.to);
              }}
              className={`w-full text-left px-3 py-2.5 sm:py-1.5 text-sm hover:bg-muted ${i === sel ? "bg-muted" : ""}`}
            >
              {app.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
