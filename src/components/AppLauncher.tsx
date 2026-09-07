import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Grid3X3, Star, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { APPS } from "@/lib/app-directory";
import { getPinned, getRecents, togglePinned } from "@/lib/recent-activity";

/** Google / Microsoft のようなアプリ切り替えランチャー */
export function AppLauncher() {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setPinned(getPinned());
    setRecents(getRecents().slice(0, 5).map((r) => r.to));
  }, [open]);

  const pinnedApps = APPS.filter((a) => pinned.includes(a.to));
  const recentApps = APPS.filter((a) => recents.includes(a.to) && !pinned.includes(a.to));
  const groups = Array.from(new Set(APPS.map((a) => a.group)));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="アプリ一覧"
          title="アプリ一覧"
          className="h-9 w-9 inline-flex items-center justify-center rounded-xl transition hover:bg-accent active:scale-95"
        >
          <Grid3X3 className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(420px,92vw)] max-h-[70vh] overflow-y-auto p-3">
        {pinnedApps.length > 0 && (
          <Section title="お気に入り" icon={<Star className="h-3.5 w-3.5" />}>
            <Grid apps={pinnedApps} pinned={pinned} onPin={setPinned} onGo={() => setOpen(false)} />
          </Section>
        )}
        {recentApps.length > 0 && (
          <Section title="最近つかったもの" icon={<Clock className="h-3.5 w-3.5" />}>
            <Grid apps={recentApps} pinned={pinned} onPin={setPinned} onGo={() => setOpen(false)} />
          </Section>
        )}
        {groups.map((g) => (
          <Section key={g} title={g}>
            <Grid apps={APPS.filter((a) => a.group === g)} pinned={pinned} onPin={setPinned} onGo={() => setOpen(false)} />
          </Section>
        ))}
        <div className="pt-1 text-[11px] text-muted-foreground">
          アイコンを長めに押す（右クリック）でお気に入りに追加できます。
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Grid({
  apps, pinned, onPin, onGo,
}: {
  apps: typeof APPS;
  pinned: string[];
  onPin: (v: string[]) => void;
  onGo: () => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {apps.map((a) => (
        <Link
          key={a.to + a.label}
          to={a.to}
          onClick={onGo}
          onContextMenu={(e) => { e.preventDefault(); onPin(togglePinned(a.to)); }}
          className="group relative flex flex-col items-center gap-1.5 rounded-xl p-2 text-center transition hover:bg-accent active:scale-95"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <a.icon className="h-5 w-5" />
          </span>
          <span className="text-[10px] leading-tight text-foreground/90 line-clamp-2">{a.label}</span>
          {pinned.includes(a.to) && (
            <Star className="absolute right-1 top-1 h-3 w-3 fill-current text-primary" />
          )}
        </Link>
      ))}
    </div>
  );
}
