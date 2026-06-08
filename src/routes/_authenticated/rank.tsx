import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rank")({ component: RankPage });

const RANKS = [
  { min: 0, title: "白帯", color: "bg-gray-200" },
  { min: 60, title: "黄帯", color: "bg-yellow-300" },
  { min: 300, title: "緑帯", color: "bg-green-400" },
  { min: 900, title: "青帯", color: "bg-blue-500" },
  { min: 2400, title: "紫帯", color: "bg-purple-500" },
  { min: 6000, title: "茶帯", color: "bg-amber-700 text-white" },
  { min: 12000, title: "黒帯", color: "bg-black text-white" },
  { min: 30000, title: "師範", color: "bg-gradient-to-r from-yellow-400 to-red-500 text-white" },
];

function RankPage() {
  const { user } = useAuth();
  const [mins, setMins] = useState(0);
  useEffect(() => {
    if (!user) return;
    supabase.from("study_logs").select("duration_minutes").eq("user_id", user.id)
      .then(({ data }) => setMins((data ?? []).reduce((s, r: any) => s + (r.duration_minutes ?? 0), 0)));
  }, [user?.id]);

  const current = [...RANKS].reverse().find((r) => mins >= r.min)!;
  const nextIdx = RANKS.findIndex((r) => r.title === current.title) + 1;
  const next = RANKS[nextIdx];

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2"><Award /> 段位・称号</h1>
      <Card className={`p-8 text-center ${current.color}`}>
        <div className="text-sm opacity-80">現在の段位</div>
        <div className="text-5xl font-bold mt-2">{current.title}</div>
        <div className="mt-4">合計 {mins} 分</div>
        {next && <div className="mt-2 text-sm">次の段位「{next.title}」まで あと {next.min - mins} 分</div>}
      </Card>
      <h2 className="text-xl font-bold mt-8 mb-3">すべての段位</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {RANKS.map((r) => (
          <Card key={r.title} className={`p-4 text-center ${r.color} ${mins >= r.min ? "" : "opacity-30"}`}>
            <div className="font-bold">{r.title}</div>
            <div className="text-xs mt-1">{r.min}分〜</div>
          </Card>
        ))}
      </div>
    </div>
  );
}