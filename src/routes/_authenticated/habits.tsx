import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Plus, Trash2, Stamp } from "lucide-react";
import { toast } from "sonner";
import { localDateStr } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/habits")({ component: HabitsPage });

const DEFAULTS = [
  { key: "morning_study", label: "朝の勉強", emoji: "🌅" },
  { key: "review", label: "復習する", emoji: "🔁" },
  { key: "reading", label: "読書", emoji: "📖" },
  { key: "exercise", label: "運動", emoji: "🏃" },
  { key: "sleep_early", label: "早寝", emoji: "🌙" },
];

type Stamp = { id: string; habit_key: string; date: string };

function HabitsPage() {
  const { user } = useAuth();
  const [habits, setHabits] = useState(() => {
    try { return JSON.parse(localStorage.getItem("habits.v1") || "null") || DEFAULTS; }
    catch { return DEFAULTS; }
  });
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [newName, setNewName] = useState("");
  const today = localDateStr();

  useEffect(() => { localStorage.setItem("habits.v1", JSON.stringify(habits)); }, [habits]);

  useEffect(() => {
    if (!user) return;
    const since = new Date(); since.setDate(since.getDate() - 30);
    supabase.from("habit_stamps").select("id,habit_key,date").eq("user_id", user.id).gte("date", since.toISOString().slice(0, 10))
      .then(({ data }) => setStamps((data as any) ?? []));
  }, [user]);

  const stamped = (key: string, date: string) => stamps.find((s) => s.habit_key === key && s.date === date);

  const toggleStamp = async (key: string) => {
    if (!user) return;
    const ex = stamped(key, today);
    if (ex) {
      await supabase.from("habit_stamps").delete().eq("id", ex.id);
      setStamps((s) => s.filter((x) => x.id !== ex.id));
    } else {
      const { data } = await supabase.from("habit_stamps").insert({ user_id: user.id, habit_key: key, date: today }).select().single();
      if (data) { setStamps((s) => [...s, data as Stamp]); toast.success("スタンプ獲得！"); }
    }
  };

  const addHabit = () => {
    const t = newName.trim(); if (!t) return;
    setHabits((h: any[]) => [...h, { key: "h_" + Date.now(), label: t, emoji: "⭐" }]);
    setNewName("");
  };
  const removeHabit = (key: string) => setHabits((h: any[]) => h.filter((x) => x.key !== key));

  const last14 = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">習慣スタンプ</h1>
      </div>
      <Card className="p-4">
        <div className="flex gap-2 mb-4">
          <Input placeholder="新しい習慣..." value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHabit()} />
          <Button onClick={addHabit}><Plus className="h-4 w-4 mr-1" />追加</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left p-2 font-medium">習慣</th>
                {last14.map((d) => (
                  <th key={d} className="p-1 text-center font-medium text-muted-foreground tabular-nums">{d.slice(5)}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {habits.map((h: any) => (
                <tr key={h.key} className="border-t">
                  <td className="p-2 whitespace-nowrap">
                    <span className="mr-1">{h.emoji}</span>{h.label}
                  </td>
                  {last14.map((d) => {
                    const on = !!stamped(h.key, d);
                    const isToday = d === today;
                    return (
                      <td key={d} className="p-1 text-center">
                        <button
                          disabled={!isToday}
                          onClick={() => isToday && toggleStamp(h.key)}
                          className={`h-7 w-7 rounded-lg border flex items-center justify-center ${
                            on ? "bg-primary text-primary-foreground border-primary shadow" : "bg-muted/30 border-border"
                          } ${isToday ? "hover:scale-110 transition cursor-pointer" : "opacity-70 cursor-default"}`}
                          title={d}
                        >
                          {on && <Stamp className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                    );
                  })}
                  <td className="p-1">
                    <Button size="icon" variant="ghost" onClick={() => removeHabit(h.key)}><Trash2 className="h-3 w-3" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-4">今日の欄をタップでスタンプ。連続日数に挑戦！</p>
      </Card>
    </div>
  );
}