import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { appsForAccount } from "@/lib/app-directory";
import { useAuth } from "@/lib/auth-context";

export function SearchBar() {
  const { accountKind } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const apps = appsForAccount(accountKind);
  const results = q.trim()
    ? apps
        .filter((app) => `${app.label} ${app.keywords}`.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 8)
    : [];
  return (
    <div className="relative">
      <div className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="検索..."
          className="bg-transparent outline-none text-sm w-32 sm:w-48"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-popover border rounded-md shadow-lg z-50 py-1">
          {results.map((app) => (
            <button
              key={app.to}
              onMouseDown={(e) => {
                e.preventDefault();
                nav({ to: app.to });
                setQ("");
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
            >
              {app.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
