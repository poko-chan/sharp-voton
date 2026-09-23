import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Flame, Clock, CalendarDays, TrendingUp } from "lucide-react";
import { localDateStr, addDaysStr } from "@/lib/date";

const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

/** 学習記録の分析サマリー（追加クエリなし・propsのlogsだけで計算） */
export function StudyStats({ logs }: { logs: any[] }) {
  const s = useMemo(() => {
    const today = localDateStr();
    const byDate = new Map<string, number>();
    const bySubject = new Map<string, { name: string; color: string; min: number }>();
    let total = 0;
    const weekStart = addDaysStr(new Date(), -6);
    const monthStart = today.slice(0, 7);
    let week = 0,
      month = 0,
      todayMin = 0;

    for (const l of logs) {
      const min = l.duration_minutes ?? 0;
      total += min;
      byDate.set(l.date, (byDate.get(l.date) ?? 0) + min);
      if (l.date === today) todayMin += min;
      if (l.date >= weekStart && l.date <= today) week += min;
      if (String(l.date).startsWith(monthStart)) month += min;
      const key = l.subjects?.id ?? "none";
      const cur = bySubject.get(key) ?? {
        name: l.subjects?.name ?? "未分類",
        color: l.subjects?.color ?? "#94a3b8",
        min: 0,
      };
      cur.min += min;
      bySubject.set(key, cur);
    }

    // 連続記録日数
    let streak = 0;
    for (let i = 0; i < 400; i++) {
      const d = addDaysStr(new Date(), -i);
      if ((byDate.get(d) ?? 0) > 0) streak++;
      else if (i > 0 || (byDate.get(today) ?? 0) === 0) break;
    }

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDaysStr(new Date(), -(6 - i));
      return { date: d, min: byDate.get(d) ?? 0 };
    });
    const max = Math.max(1, ...days.map((d) => d.min));
    const subjects = Array.from(bySubject.values()).sort((a, b) => b.min - a.min);
    const subjTotal = subjects.reduce((a, b) => a + b.min, 0) || 1;

    return { todayMin, week, month, total, streak, days, subjects, subjTotal };
  }, [logs]);

  const Stat = ({
    icon,
    label,
    value,
    sub,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    sub?: string;
  }) => (
    <div className="flex items-center gap-3 rounded-xl border bg-card/60 px-3 py-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-lg font-bold leading-tight tabular-nums">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );

  return (
    <Card className="p-5 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Stat icon={<Clock className="h-4 w-4" />} label="今日" value={fmt(s.todayMin)} />
        <Stat icon={<CalendarDays className="h-4 w-4" />} label="直近7日" value={fmt(s.week)} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="今月" value={fmt(s.month)} />
        <Stat
          icon={<Flame className="h-4 w-4" />}
          label="連続記録"
          value={`${s.streak}日`}
          sub={`累計 ${fmt(s.total)}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">7日間の学習時間</div>
          <div className="flex h-28 items-end gap-1.5">
            {s.days.map((d) => {
              const max = Math.max(1, ...s.days.map((x) => x.min));
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t bg-primary/80 transition-all"
                      style={{ height: `${Math.max(d.min ? 6 : 2, (d.min / max) * 100)}%` }}
                      title={`${d.date}: ${d.min}分`}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{d.date.slice(8)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">教科の割合</div>
          {s.subjects.length === 0 ? (
            <p className="text-xs text-muted-foreground">まだデータがありません</p>
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                {s.subjects.slice(0, 8).map((x, i) => (
                  <div
                    key={i}
                    style={{ width: `${(x.min / s.subjTotal) * 100}%`, background: x.color }}
                    title={`${x.name} ${x.min}分`}
                  />
                ))}
              </div>
              <div className="mt-2 space-y-1">
                {s.subjects.slice(0, 5).map((x, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: x.color }}
                    />
                    <span className="flex-1 truncate">{x.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {Math.round((x.min / s.subjTotal) * 100)}% ・ {fmt(x.min)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
