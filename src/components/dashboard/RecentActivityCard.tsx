import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { APPS } from "@/lib/app-directory";
import { clearRecents, getRecents, type RecentItem } from "@/lib/recent-activity";

function ago(at: number) {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

/** 最近つかった機能の履歴（端末内に保存） */
export function RecentActivityCard() {
  const [items, setItems] = useState<RecentItem[]>([]);
  useEffect(() => {
    const load = () => setItems(getRecents().slice(0, 8));
    load();
    window.addEventListener("study:recent-updated", load);
    return () => window.removeEventListener("study:recent-updated", load);
  }, []);

  return (
    <Card className="liquid-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-primary" /> 最近の利用状況
        </CardTitle>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearRecents();
              setItems([]);
            }}
            title="履歴を消す"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-1">
        {items.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            まだ履歴はありません。いろいろ開いてみましょう。
          </p>
        )}
        {items.map((it) => {
          const app = APPS.find((a) => a.to === it.to);
          const Icon = app?.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-accent"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {Icon ? <Icon className="h-4 w-4" /> : null}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {app?.label ?? it.label}
              </span>
              <span className="text-xs text-muted-foreground">{ago(it.at)}</span>
              <span className="text-[10px] text-muted-foreground">×{it.count}</span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
