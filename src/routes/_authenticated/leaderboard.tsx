import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Flame } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboard")({ component: LeaderboardPage });

function LeaderboardPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_leaderboard", { _limit: 20 });
      setRows(data ?? []);
    })();
  }, []);
  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2"><Trophy /> ランキング</h1>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <Card key={r.user_id} className="p-3 flex items-center gap-3">
            <div className="text-2xl font-bold w-10 text-center">
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
            </div>
            <Avatar><AvatarImage src={r.avatar_url} /><AvatarFallback>{(r.display_name ?? "?")[0]}</AvatarFallback></Avatar>
            <div className="flex-1">
              <div className="font-medium">{r.display_name ?? "ユーザー"}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>{r.total_minutes}分</span>
                <Flame className="w-3 h-3" /> {r.streak_days}日
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}