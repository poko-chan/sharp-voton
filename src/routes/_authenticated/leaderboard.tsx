import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Flame, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboard")({ component: LeaderboardPage });

function LeaderboardPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [invRows, setInvRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_leaderboard", { _limit: 20 });
      setRows(data ?? []);
      const { data: inv } = await (supabase as any).rpc("get_referral_leaderboard", { _limit: 20 });
      setInvRows(inv ?? []);
    })();
  }, []);
  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2"><Trophy /> ランキング</h1>
      <Tabs defaultValue="study">
        <TabsList>
          <TabsTrigger value="study">学習</TabsTrigger>
          <TabsTrigger value="invite"><UserPlus className="h-3 w-3 mr-1" />招待</TabsTrigger>
        </TabsList>
        <TabsContent value="study" className="space-y-2">
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
        </TabsContent>
        <TabsContent value="invite" className="space-y-2">
          {invRows.length === 0 && <Card className="p-6 text-sm text-center text-muted-foreground">まだ招待実績がありません</Card>}
          {invRows.map((r, i) => (
            <Card key={r.user_id} className="p-3 flex items-center gap-3">
              <div className="text-2xl font-bold w-10 text-center">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </div>
              <Avatar><AvatarImage src={r.avatar_url} /><AvatarFallback>{(r.display_name ?? "?")[0]}</AvatarFallback></Avatar>
              <div className="flex-1">
                <div className="font-medium">{r.display_name ?? "ユーザー"}</div>
                <div className="text-xs text-muted-foreground">招待 {r.invite_count} 人</div>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}