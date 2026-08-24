import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";

const ROUTES: Array<{ q: string; to: string; label: string }> = [
  { q: "ダッシュボード dashboard", to: "/dashboard", label: "ダッシュボード" },
  { q: "勉強記録 study", to: "/study", label: "勉強記録" },
  { q: "タイマー timer", to: "/timer", label: "タイマー" },
  { q: "暗記カード flashcard srs", to: "/flashcards", label: "暗記カード" },
  { q: "友達 friends フォロー", to: "/friends", label: "フレンド" },
  { q: "通知", to: "/notifications", label: "通知" },
  { q: "設定 settings", to: "/settings", label: "設定" },
  { q: "ヘルプ help", to: "/help", label: "ヘルプ" },
  { q: "目標 goals", to: "/goals", label: "学習目標" },
  { q: "カレンダー", to: "/calendar", label: "カレンダー" },
  { q: "ヒートマップ", to: "/heatmap", label: "ヒートマップ" },
];

export function SearchBar() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const results = q.trim() ? ROUTES.filter((r) => r.q.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  return (
    <div className="relative">
      <div className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="検索..."
          className="bg-transparent outline-none text-sm w-32 sm:w-48"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-popover border rounded-md shadow-lg z-50 py-1">
          {results.map((r) => (
            <button
              key={r.to}
              onMouseDown={(e) => { e.preventDefault(); nav({ to: r.to }); setQ(""); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
            >{r.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}