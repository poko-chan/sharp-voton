import type { SettingsCategory, SettingsCategoryId } from "./types";
import { cn } from "@/lib/utils";

export function SettingsNav({
  categories,
  active,
  onSelect,
}: {
  categories: SettingsCategory[];
  active: SettingsCategoryId | null;
  onSelect: (id: SettingsCategoryId) => void;
}) {
  return (
    <>
      {/* デスクトップ: 左サイドバー */}
      <nav className="hidden md:flex md:flex-col md:w-56 shrink-0 gap-0.5 sticky top-4 self-start">
        {categories.map((c) => {
          const Icon = c.icon;
          const isActive = active === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-left transition",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                c.danger && isActive && "bg-destructive/10 text-destructive",
                c.danger && !isActive && "hover:text-destructive"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{c.label}</span>
            </button>
          );
        })}
      </nav>

      {/* モバイル: 横スクロールタブ */}
      <nav className="md:hidden -mx-4 px-4 flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none]">
        {categories.map((c) => {
          const Icon = c.icon;
          const isActive = active === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-accent",
                c.danger && isActive && "bg-destructive text-destructive-foreground border-destructive"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {c.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
