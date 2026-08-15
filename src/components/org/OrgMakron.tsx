import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { BookOpen, Star, Lock, CheckCircle2, Flame, Clock, Trophy } from "lucide-react";

const HUES = ["#7B6CFF", "#34D7B5", "#38bdf8", "#fb923c", "#f472b6"];

export function OrgMakron({ orgId }: { orgId: string; ctx: any }) {
  const [packs, setPacks] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [done, setDone] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: a }] = await Promise.all([
        (supabase as any).from("makron_packs").select("id, title, status, description").eq("organization_id", orgId).limit(100),
        (supabase as any).from("org_pack_assignments").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
      ]);
      setPacks(p ?? []); setAssignments(a ?? []);
      const { data: { user } } = await supabase.auth.getUser();
      if (user && (p ?? []).length) {
        const { data: at } = await (supabase as any).from("makron_pack_attempts")
          .select("pack_id, score").eq("user_id", user.id).in("pack_id", (p ?? []).map((x: any) => x.id));
        const m: Record<string, number> = {};
        for (const r of at ?? []) m[r.pack_id] = Math.max(m[r.pack_id] ?? 0, Number(r.score ?? 0));
        setDone(m);
      }
    })();
  }, [orgId]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="p-5 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border-primary/30">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/20 grid place-items-center"><BookOpen className="h-6 w-6 text-primary" /></div>
          <div className="flex-1">
            <div className="text-lg font-extrabold">Makron for School</div>
            <div className="text-xs text-muted-foreground">組織のカリキュラムを上から順に進めましょう</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-extrabold text-primary">{Object.keys(done).length}<span className="text-sm">/{packs.length}</span></div>
            <div className="text-[10px] text-muted-foreground">クリア</div>
          </div>
        </div>
      </Card>

      {assignments.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-bold flex items-center gap-1"><Flame className="h-4 w-4 text-orange-500" />いまやる課題</div>
          {assignments.map((a) => (
            <Link key={a.id} to="/makron/pack/$packId" params={{ packId: a.pack_id }}
              className="flex items-center gap-3 rounded-xl border-2 border-orange-400/40 bg-orange-500/5 p-3 hover:border-orange-400 transition">
              <div className="h-10 w-10 rounded-xl bg-orange-500/15 grid place-items-center"><Trophy className="h-5 w-5 text-orange-500" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{a.title}</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />{a.due_at ? `期限 ${new Date(a.due_at).toLocaleString("ja-JP")}` : "期限なし"}{a.required ? " ・必須" : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <div className="text-sm font-bold flex items-center gap-1"><Star className="h-4 w-4 text-amber-500" />カリキュラム</div>
        {packs.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">まだ問題集はありません</Card>}
        <div className="relative pt-3">
          {packs.map((p, i) => {
            const cleared = done[p.id] !== undefined;
            const unlocked = i === 0 || done[packs[i - 1].id] !== undefined;
            const hue = HUES[i % HUES.length];
            const off = [0, 56, 80, 56, 0, -56, -80, -56][i % 8];
            return (
              <div key={p.id} className="flex flex-col items-center">
                {i > 0 && <div className="h-6 w-1 rounded-full bg-border" style={{ marginLeft: off }} />}
                <div className="flex items-center gap-3 w-full justify-center" style={{ transform: `translateX(${off}px)` }}>
                  <Link to="/makron/pack/$packId" params={{ packId: p.id }}
                    className={`relative h-16 w-16 rounded-full grid place-items-center shadow-md transition hover:scale-105 ${unlocked ? "" : "grayscale opacity-60"}`}
                    style={{ background: cleared ? hue : `${hue}33`, border: `3px solid ${hue}` }}
                    aria-label={p.title}>
                    {cleared ? <CheckCircle2 className="h-7 w-7 text-white" /> : unlocked ? <Star className="h-7 w-7" style={{ color: hue }} /> : <Lock className="h-6 w-6 text-muted-foreground" />}
                    {cleared && <span className="absolute -bottom-1 text-[9px] px-1.5 rounded-full bg-background border">{done[p.id]}点</span>}
                  </Link>
                  <div className="max-w-[160px]">
                    <div className="text-sm font-bold leading-tight">{p.title}</div>
                    {p.description && <div className="text-[11px] text-muted-foreground line-clamp-2">{p.description}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
