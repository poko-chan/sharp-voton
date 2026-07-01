import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote } from "lucide-react";

export const Route = createFileRoute("/_authenticated/coedit")({ component: CoeditPage });

function CoeditPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [content, setContent] = useState("");
  const saveTimer = useRef<any>(null);
  const load = () => { if(!user)return; supabase.from("coedit_notes").select("*").order("updated_at",{ascending:false}).then(({data})=>setNotes(data??[])); };
  useEffect(()=>{load();}, [user?.id]);
  useEffect(() => {
    if (!current) return;
    const ch = supabase.channel(`coedit-${current.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "coedit_notes", filter: `id=eq.${current.id}` }, (p: any) => {
        if (p.new.content !== content) setContent(p.new.content);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [current?.id]);
  const create = async () => { if(!user)return; const { data } = await supabase.from("coedit_notes").insert({ owner_id: user.id, title: "新規ノート" }).select().single(); if(data){ setCurrent(data); setContent(""); load(); } };
  const open = (n: any) => { setCurrent(n); setContent(n.content); };
  const onEdit = (v: string) => {
    setContent(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!current) return;
      await supabase.from("coedit_notes").update({ content: v, updated_at: new Date().toISOString() }).eq("id", current.id);
    }, 500);
  };
  return (<div className="p-4 md:p-8 max-w-6xl mx-auto grid md:grid-cols-[240px_1fr] gap-4">
    <div className="space-y-2">
      <div className="flex items-center gap-2"><StickyNote className="h-5 w-5" /><h2 className="font-bold">共同ノート</h2></div>
      <Button onClick={create} className="w-full">＋ 新規</Button>
      {notes.map(n=>(<button key={n.id} onClick={()=>open(n)} className={`w-full text-left p-2 rounded text-sm ${current?.id===n.id?"bg-primary/20":"bg-muted"}`}>{n.title}</button>))}
    </div>
    {current ? <Card className="p-4 space-y-2">
      <Input value={current.title} onChange={async (e)=>{ setCurrent({...current, title: e.target.value}); await supabase.from("coedit_notes").update({ title: e.target.value }).eq("id", current.id); }} />
      <Textarea rows={20} value={content} onChange={(e)=>onEdit(e.target.value)} />
      <div className="text-xs text-muted-foreground">共同編集者: {(current.collaborators??[]).length}</div>
    </Card> : <Card className="p-8 text-center text-muted-foreground">左からノートを選択</Card>}
  </div>);
}