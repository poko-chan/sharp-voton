import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Vote, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/polls")({ component: PollsPage });

function PollsPage() {
  const { user } = useAuth();
  const [polls, setPolls] = useState<any[]>([]);
  const [votes, setVotes] = useState<Record<string, any[]>>({});
  const [myVote, setMyVote] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<string[]>(["", ""]);

  const load = async () => {
    const { data: ps } = await supabase.from("polls").select("*").order("created_at", { ascending: false }).limit(50);
    setPolls(ps ?? []);
    const ids = (ps ?? []).map((p: any) => p.id);
    if (ids.length) {
      const { data: vs } = await supabase.from("poll_votes").select("*").in("poll_id", ids);
      const map: Record<string, any[]> = {}; const mine: Record<string, number> = {};
      for (const v of vs ?? []) {
        (map[v.poll_id] ??= []).push(v);
        if (v.user_id === user?.id) mine[v.poll_id] = v.option_index;
      }
      setVotes(map); setMyVote(mine);
    }
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("polls").on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const create = async () => {
    if (!user || !q.trim()) return;
    const filtered = opts.filter((o) => o.trim());
    if (filtered.length < 2) return;
    await supabase.from("polls").insert({ created_by: user.id, question: q, options: filtered });
    setQ(""); setOpts(["", ""]); load();
  };
  const vote = async (pid: string, idx: number) => {
    if (!user) return;
    await supabase.from("poll_votes").upsert({ poll_id: pid, user_id: user.id, option_index: idx }, { onConflict: "poll_id,user_id" });
    load();
  };
  const del = async (id: string) => { await supabase.from("polls").delete().eq("id", id); load(); };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2"><Vote className="h-7 w-7" /><h1 className="text-3xl font-bold">投票</h1></div>
      <Card className="p-4 space-y-2">
        <div className="font-semibold flex items-center gap-1"><Plus className="h-4 w-4" />新規投票</div>
        <Input placeholder="質問" value={q} onChange={(e) => setQ(e.target.value)} />
        {opts.map((o, i) => (
          <Input key={i} placeholder={`選択肢 ${i + 1}`} value={o} onChange={(e) => { const c = [...opts]; c[i] = e.target.value; setOpts(c); }} />
        ))}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpts([...opts, ""])}>+ 選択肢追加</Button>
          <Button onClick={create}>作成</Button>
        </div>
      </Card>
      {polls.map((p) => {
        const vs = votes[p.id] ?? [];
        const total = vs.length;
        const mine = myVote[p.id];
        return (
          <Card key={p.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div className="font-semibold">{p.question}</div>
              {p.created_by === user?.id && <Button size="sm" variant="ghost" onClick={() => del(p.id)}><Trash2 className="h-3 w-3" /></Button>}
            </div>
            {(p.options as string[]).map((o, i) => {
              const count = vs.filter((v: any) => v.option_index === i).length;
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <button key={i} onClick={() => vote(p.id, i)} className={`w-full text-left rounded border p-2 relative overflow-hidden ${mine === i ? "border-primary" : ""}`}>
                  <div className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${pct}%` }} />
                  <div className="relative flex justify-between text-sm"><span>{o}</span><span className="text-muted-foreground">{count} ({pct}%)</span></div>
                </button>
              );
            })}
            <div className="text-xs text-muted-foreground">{total}票</div>
          </Card>
        );
      })}
    </div>
  );
}