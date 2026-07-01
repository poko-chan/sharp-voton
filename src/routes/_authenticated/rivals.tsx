import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rivals")({ component: Rivals });

function Rivals() {
  const { user } = useAuth();
  const [list, setList] = useState<any[]>([]);
  useEffect(()=>{ if(!user)return; supabase.from("rival_matches").select("*").or(`a_id.eq.${user.id},b_id.eq.${user.id}`).order("created_at",{ascending:false}).then(({data})=>setList(data??[])); }, [user?.id]);
  return (<div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
    <div className="flex items-center gap-2"><Target className="h-7 w-7 text-primary" /><h1 className="text-2xl font-bold">ライバル対決</h1></div>
    {list.length === 0 && <Card className="p-6 text-sm text-muted-foreground">まだ対戦記録はありません。フレンドから指名すると1on1週間対決が始まります。</Card>}
    {list.map(m=>(<Card key={m.id} className="p-4 text-sm">週開始 {m.week_start} / 自分{m.a_id===user?.id?m.a_minutes:m.b_minutes}分 vs 相手{m.a_id===user?.id?m.b_minutes:m.a_minutes}分 {m.winner && <b>勝者: {m.winner===user?.id?"自分":"相手"}</b>}</Card>))}
  </div>);
}