import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/challenges")({ component: Ch });

function Ch() {
  const { user } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState("");
  const load = () => supabase.from("group_challenges").select("*, group_challenge_members(*)").order("created_at",{ascending:false}).then(({data})=>setList(data??[]));
  useEffect(()=>{load();}, []);
  const create = async () => { if(!user||!name)return; const today=new Date(); const start=today.toISOString().slice(0,10); const end=new Date(today.getTime()+7*86400000).toISOString().slice(0,10); const { data } = await supabase.from("group_challenges").insert({ owner_id: user.id, name, starts_on: start, ends_on: end }).select().single(); if(data) await supabase.from("group_challenge_members").insert({ challenge_id: data.id, user_id: user.id }); setName(""); load(); };
  const join = async (cid: string) => { if(!user)return; await supabase.from("group_challenge_members").insert({ challenge_id: cid, user_id: user.id }); load(); };
  return (<div className="p-4 md:p-8 max-w-4xl mx-auto space-y-4">
    <div className="flex items-center gap-2"><Trophy className="h-7 w-7 text-primary" /><h1 className="text-2xl font-bold">グループチャレンジ</h1></div>
    <Card className="p-4 flex gap-2"><Input placeholder="チーム名" value={name} onChange={(e)=>setName(e.target.value)} /><Button onClick={create}>作成</Button></Card>
    {list.map(c => (<Card key={c.id} className="p-4">
      <div className="flex justify-between"><div className="font-semibold">{c.name}</div><Button size="sm" onClick={()=>join(c.id)}>参加</Button></div>
      <div className="text-xs text-muted-foreground">{c.starts_on} 〜 {c.ends_on} / メンバー {c.group_challenge_members?.length ?? 0}</div>
    </Card>))}
  </div>);
}