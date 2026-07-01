import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mentor")({ component: MentorPage });

function MentorPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [list, setList] = useState<any[]>([]);
  const load = () => supabase.from("mentor_sessions").select("*").order("created_at",{ascending:false}).limit(30).then(({data})=>setList(data??[]));
  useEffect(()=>{load();}, []);
  const ask = async () => { if(!user||!q)return; await supabase.from("mentor_sessions").insert({ student_id: user.id, mentor_id: user.id, question: q } as any); setQ(""); load(); };
  const reply = async (id: string, ans: string) => { if(!user||!ans)return; const { data:c } = await supabase.from("user_coins").select("balance").eq("user_id", user.id).maybeSingle(); await supabase.from("mentor_sessions").update({ mentor_id: user.id, answer: ans, reward_coins: 15 }).eq("id", id); await supabase.from("user_coins").upsert({ user_id: user.id, balance: (c?.balance ?? 0) + 15 }); toast.success("+15コイン"); load(); };
  return (<div className="p-4 md:p-8 max-w-4xl mx-auto space-y-4">
    <div className="flex items-center gap-2"><Users className="h-7 w-7 text-primary" /><h1 className="text-2xl font-bold">メンター</h1></div>
    <Card className="p-4 space-y-2"><Textarea placeholder="質問を投稿…" value={q} onChange={(e)=>setQ(e.target.value)} /><Button onClick={ask}>質問する</Button></Card>
    {list.map(s => (<Card key={s.id} className="p-4 space-y-2">
      <div className="text-sm whitespace-pre-wrap"><b>Q:</b> {s.question}</div>
      {s.answer ? <div className="text-sm bg-muted p-2 rounded"><b>A:</b> {s.answer}</div> :
        s.student_id !== user?.id && <ReplyBox onSubmit={(a)=>reply(s.id,a)} />}
    </Card>))}
  </div>);
}
function ReplyBox({ onSubmit }: { onSubmit: (t:string)=>void }) {
  const [t, setT] = useState("");
  return (<div className="space-y-1"><Textarea value={t} onChange={(e)=>setT(e.target.value)} placeholder="回答して +15コイン" /><Button size="sm" onClick={()=>{onSubmit(t); setT("");}}>回答</Button></div>);
}