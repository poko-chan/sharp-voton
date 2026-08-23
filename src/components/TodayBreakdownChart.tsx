import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { CalendarClock } from "lucide-react";
import { addDaysStr } from "@/lib/date";

const CATEGORIES: Record<string, { label: string; color: string }> = {
  school:   { label: "学校",     color: "#60a5fa" },
  study:    { label: "勉強",     color: "#22c55e" },
  meal:     { label: "ご飯",     color: "#f59e0b" },
  activity: { label: "習い事",   color: "#a855f7" },
  free:     { label: "自由時間", color: "#ec4899" },
  sleep:    { label: "睡眠",     color: "#6366f1" },
  bath:     { label: "お風呂",   color: "#06b6d4" },
  travel:   { label: "移動",     color: "#94a3b8" },
  event:    { label: "イベント", color: "#ef4444" },
  custom:   { label: "カスタム", color: "#0ea5e9" },
};
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export function TodayBreakdownChart() {
  const { user } = useAuth();
  const [days, setDays] = useState<any[]>([]);
  const [pie, setPie] = useState<{ name: string; value: number; color: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    const from = addDaysStr(new Date(), -13);
    supabase.from("today_entries")
      .select("date, category, start_time, end_time")
      .eq("user_id", user.id)
      .gte("date", from)
      .then(({ data }) => {
        const rows = data ?? [];
        const byDay: Record<string, Record<string, number>> = {};
        const byCat: Record<string, number> = {};
        for (const r of rows as any[]) {
          const dur = toMin(r.end_time) - toMin(r.start_time);
          if (dur <= 0) continue;
          byDay[r.date] ??= {};
          byDay[r.date][r.category] = (byDay[r.date][r.category] ?? 0) + dur;
          byCat[r.category] = (byCat[r.category] ?? 0) + dur;
        }
        const today = new Date();
        const arr = Array.from({ length: 14 }).map((_, i) => {
          const d = addDaysStr(today, -(13 - i));
          const row: any = { date: d.slice(5) };
          for (const k of Object.keys(CATEGORIES)) row[k] = Math.round(((byDay[d] ?? {})[k] ?? 0) / 60 * 10) / 10;
          return row;
        });
        setDays(arr);
        setPie(Object.entries(byCat).map(([k, v]) => ({
          name: CATEGORIES[k]?.label ?? k, value: Math.round(v / 60 * 10) / 10, color: CATEGORIES[k]?.color ?? "#888",
        })).filter((x) => x.value > 0));
      });
  }, [user?.id]);

  if (days.length === 0) return null;
  const empty = pie.length === 0;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Today — 日別の時間配分（過去14日）</h2>
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground">Today ページで予定を追加すると、ここに時間配分グラフが表示されます。</p>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days}>
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} unit="h" />
                <Tooltip formatter={(v: any) => `${v} h`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {Object.entries(CATEGORIES).map(([k, c]) => (
                  <Bar key={k} dataKey={k} name={c.label} stackId="a" fill={c.color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                  {pie.map((p, i) => <Cell key={i} fill={p.color} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `${v} h`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}