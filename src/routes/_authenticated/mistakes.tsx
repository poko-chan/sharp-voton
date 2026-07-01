import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mistakes")({ component: Mistakes });

function Mistakes() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(()=>{ if(!user)return;
    supabase.from("makron_answers").select("*, makron_questions(prompt, answer)").eq("user_id", user.id).eq("is_correct", false).order("created_at",{ascending:false}).limit(100).then(({data})=>setRows(data??[])); }, [user?.id]);
  return (<div className="p-4 md:p-8 max-w-4xl mx-auto space-y-4">
    <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Brain className="h-7 w-7 text-primary" /><h1 className="text-2xl font-bold">間違い直しノート</h1></div>
    <Button onClick={()=>window.print()}>印刷 / PDF</Button></div>
    {rows.length === 0 && <Card className="p-6 text-sm text-muted-foreground">まだ誤答はありません。</Card>}
    {rows.map((r,i)=>(<Card key={r.id} className="p-4 space-y-1">
      <div className="text-xs text-muted-foreground">#{i+1} {new Date(r.created_at).toLocaleDateString("ja-JP")}</div>
      <div className="text-sm"><b>Q:</b> {r.makron_questions?.prompt}</div>
      <div className="text-sm text-red-500"><b>あなた:</b> {r.user_answer}</div>
      <div className="text-sm text-green-600"><b>正解:</b> {r.makron_questions?.answer}</div>
    </Card>))}
  </div>);
}