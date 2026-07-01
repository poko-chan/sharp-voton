import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessagesSquare, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/qa")({ component: QaPage });

function QaPage() {
  const { user } = useAuth();
  const [qs, setQs] = useState<any[]>([]);
  const [as, setAs] = useState<Record<string, any[]>>({});
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const load = async () => {
    const { data } = await supabase.from("class_qa_questions").select("*").order("created_at",{ascending:false}).limit(50);
    setQs(data ?? []);
    if (data?.length) {
      const { data: ans } = await supabase.from("class_qa_answers").select("*").in("question_id", data.map(q=>q.id));
      const m: Record<string, any[]> = {}; for (const a of ans ?? []) (m[a.question_id] ??= []).push(a); setAs(m);
    }
  };
  useEffect(()=>{load();}, []);
  const post = async () => { if(!user||!title)return; await supabase.from("class_qa_questions").insert({ user_id: user.id, title, body }); setTitle(""); setBody(""); load(); };
  const answer = async (qid: string, txt: string) => { if(!user||!txt)return; await supabase.from("class_qa_answers").insert({ user_id: user.id, question_id: qid, body: txt }); load(); };
  const pickBest = async (q: any, aid: string, ansUser: string) => {
    if (q.user_id !== user?.id) return;
    await supabase.from("class_qa_questions").update({ best_answer_id: aid }).eq("id", q.id);
    const { data: c } = await supabase.from("user_coins").select("balance").eq("user_id", ansUser).maybeSingle();
    await supabase.from("user_coins").upsert({ user_id: ansUser, balance: (c?.balance ?? 0) + 20 });
    toast.success("ベスト回答！ +20コイン"); load();
  };
  return (<div className="p-4 md:p-8 max-w-4xl mx-auto space-y-4">
    <div className="flex items-center gap-2"><MessagesSquare className="h-7 w-7 text-primary" /><h1 className="text-2xl font-bold">Q&A掲示板</h1></div>
    <Card className="p-4 space-y-2">
      <Input placeholder="質問タイトル" value={title} onChange={(e)=>setTitle(e.target.value)} />
      <Textarea placeholder="詳細" value={body} onChange={(e)=>setBody(e.target.value)} />
      <Button onClick={post}>質問する</Button>
    </Card>
    {qs.map(q => (<Card key={q.id} className="p-4 space-y-2">
      <div className="font-semibold">{q.title}</div>
      {q.body && <div className="text-sm text-muted-foreground whitespace-pre-wrap">{q.body}</div>}
      <div className="space-y-2 pt-2">
        {(as[q.id] ?? []).map(a => (<div key={a.id} className={`p-2 rounded text-sm ${q.best_answer_id===a.id?"bg-yellow-500/20":"bg-muted"}`}>
          <div className="flex justify-between"><span>{a.body}</span>
            {q.user_id===user?.id && q.best_answer_id!==a.id && <Button size="sm" variant="ghost" onClick={()=>pickBest(q,a.id,a.user_id)}><Trophy className="h-3 w-3" /></Button>}
          </div></div>))}
        <AnswerBox onSubmit={(t)=>answer(q.id,t)} />
      </div>
    </Card>))}
  </div>);
}
function AnswerBox({ onSubmit }: { onSubmit: (t: string) => void }) {
  const [t, setT] = useState("");
  return (<div className="flex gap-1"><Input placeholder="回答…" value={t} onChange={(e)=>setT(e.target.value)} /><Button size="sm" onClick={()=>{onSubmit(t); setT("");}}>送信</Button></div>);
}