import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MakronShell, MakronBadge } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Trophy, Zap, History, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/makron/")({ component: MakronHome });

type Unit = { id: string; title: string; subject: string | null; field: string | null; unit: string | null; description: string | null };
type Row = { user_id: string; display_name: string | null; avatar_url: string | null; xp: number; level: number; rank: number };
type Me = { xp: number; level: number; rank: number; total_users: number };

function MakronHome() {
  const { user, isAdmin } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [board, setBoard] = useState<Row[]>([]);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await (supabase as any).from("makron_units").select("*").order("order_idx").order("created_at");
      setUnits(u ?? []);
      const { data: lb } = await (supabase as any).rpc("get_makron_leaderboard", { _limit: 20 });
      setBoard((lb ?? []) as Row[]);
      const { data: meRow } = await (supabase as any).rpc("get_my_makron_rank");
      if (meRow && meRow[0]) setMe(meRow[0] as Me);
    })();
  }, [user?.id]);

  const inTop20 = me && board.some((b) => b.user_id === user?.id);

  return (
    <MakronShell title="Makron" subtitle="問題演習プラットフォーム">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap gap-2 items-center">
          <MakronBadge icon={Zap} label="XP" value={me?.xp ?? 0} />
          <MakronBadge icon={Trophy} label="レベル" value={`Lv${me?.level ?? 1}`} />
          <MakronBadge icon={Trophy} label="順位" value={me && me.rank > 0 ? `${me.rank}位 / ${me.total_users}人` : "未参加"} />
          <div className="ml-auto flex gap-2">
            <Link to="/makron/history"><Button variant="outline" size="sm"><History className="h-4 w-4 mr-1" />履歴</Button></Link>
            {isAdmin && <Link to="/makron/admin"><Button size="sm"><Plus className="h-4 w-4 mr-1" />問題管理</Button></Link>}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />単元一覧</h2>
            {units.length === 0 && (
              <Card className="p-8 text-center text-muted-foreground text-sm">
                単元はまだありません{isAdmin && "（管理者画面から追加）"}
              </Card>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              {units.map((u) => (
                <Link key={u.id} to="/makron/unit/$unitId" params={{ unitId: u.id }}>
                  <Card className="p-4 hover:border-primary transition cursor-pointer h-full">
                    <div className="font-bold">{u.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {[u.subject, u.field, u.unit].filter(Boolean).join(" / ") || "未分類"}
                    </div>
                    {u.description && <div className="text-xs mt-2 text-muted-foreground line-clamp-2">{u.description}</div>}
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" />ランキング (Top 20)</h2>
            <Card className="p-3 bg-primary/5 border-primary/30">
              <div className="text-[10px] text-muted-foreground">あなたのステータス</div>
              <div className="flex items-center justify-between mt-1">
                <div className="font-bold">{me && me.rank > 0 ? `${me.rank}位` : "圏外"}</div>
                <div className="text-xs">{me?.xp ?? 0} XP / Lv{me?.level ?? 1}</div>
              </div>
              {me && me.rank > 20 && <div className="text-[10px] text-muted-foreground mt-1">トップ20圏外</div>}
              {!inTop20 && me && me.rank > 0 && me.rank <= 20 && <div className="text-[10px] text-muted-foreground mt-1">あなたは{me.rank}位</div>}
            </Card>
            <Card className="divide-y divide-border/60">
              {board.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">まだ参加者がいません</div>}
              {board.map((r) => (
                <div key={r.user_id} className={`flex items-center gap-2 p-2 ${r.user_id === user?.id ? "bg-primary/10" : ""}`}>
                  <div className="w-7 text-center text-sm font-bold tabular-nums">{r.rank}</div>
                  <Avatar className="h-7 w-7"><AvatarImage src={r.avatar_url ?? undefined} /><AvatarFallback>{(r.display_name ?? "?").slice(0,1)}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0 text-sm truncate">{r.display_name ?? "?"}</div>
                  <div className="text-xs tabular-nums">{r.xp} XP</div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </MakronShell>
  );
}