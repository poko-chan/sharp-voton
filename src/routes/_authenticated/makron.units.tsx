import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MakronShell, MakronBadge } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Package, Trophy, Zap, History, Shield, Filter, Play, ListChecks, Settings, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { GRADES } from "@/lib/makron-grades";

export const Route = createFileRoute("/_authenticated/makron/units")({ component: MakronUnits });

type Row = { user_id: string; display_name: string | null; avatar_url: string | null; xp: number; level: number; rank: number };
type Me = { xp: number; level: number; rank: number; total_users: number };

function MakronUnits() {
  const { user, isAdmin } = useAuth();
  const nav = useNavigate();
  const [packs, setPacks] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [board, setBoard] = useState<Row[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [fGrade, setFGrade] = useState("__all");
  const [fSubj, setFSubj] = useState("__all");
  const [fField, setFField] = useState("__all");
  const [fUnit, setFUnit] = useState("__all");

  useEffect(() => {
    (async () => {
      const [{ data: ps }, { data: us }, { data: ss }, { data: fs }] = await Promise.all([
        (supabase as any).from("makron_packs")
          .select("*, qcount:makron_questions(count)")
          .eq("is_active", true).order("order_idx").order("created_at", { ascending: false }),
        (supabase as any).from("makron_units").select("*").order("order_idx"),
        (supabase as any).from("makron_subjects").select("*").order("order_idx").order("name"),
        (supabase as any).from("makron_fields").select("*").order("order_idx").order("name"),
      ]);
      setPacks(ps ?? []); setUnits(us ?? []); setSubjects(ss ?? []); setFields(fs ?? []);
      const { data: lb } = await (supabase as any).rpc("get_makron_leaderboard", { _limit: 20 });
      setBoard((lb ?? []) as Row[]);
      const { data: meRow } = await (supabase as any).rpc("get_my_makron_rank");
      if (meRow && meRow[0]) setMe(meRow[0] as Me);
    })();
  }, [user?.id]);

  const unitById = (id: string | null) => units.find((u) => u.id === id);
  const subjectIdOf = (p: any) => p.subject_id ?? unitById(p.unit_id)?.subject_id ?? null;
  const fieldIdOf = (p: any) => p.field_id ?? unitById(p.unit_id)?.field_id ?? null;
  const labelOf = (p: any) => {
    const s = subjects.find((x) => x.id === subjectIdOf(p))?.name;
    const f = fields.find((x) => x.id === fieldIdOf(p))?.name;
    const u = unitById(p.unit_id)?.title;
    return [p.grade, s, f, u].filter(Boolean).join(" / ") || "未分類";
  };

  const visibleFields = fields.filter((f) => fSubj === "__all" || f.subject_id === fSubj);
  const visibleUnits = units.filter((u) =>
    (fSubj === "__all" || u.subject_id === fSubj) && (fField === "__all" || u.field_id === fField));

  const filtered = packs.filter((p) =>
    (fGrade === "__all" || p.grade === fGrade) &&
    (fSubj === "__all" || subjectIdOf(p) === fSubj) &&
    (fField === "__all" || fieldIdOf(p) === fField) &&
    (fUnit === "__all" || p.unit_id === fUnit));

  const startPack = async (packId: string) => {
    const { data, error } = await (supabase as any).rpc("makron_start_pack_session", { _pack_id: packId });
    if (error) return toast.error(error.message);
    nav({ to: "/makron/session/$sessionId", params: { sessionId: data } });
  };

  return (
    <MakronShell back="/makron" title="Makron" subtitle="問題演習プラットフォーム">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap gap-2 items-center">
          <MakronBadge icon={Zap} label="XP" value={me?.xp ?? 0} />
          <MakronBadge icon={Trophy} label="レベル" value={`Lv${me?.level ?? 1}`} />
          <MakronBadge icon={Trophy} label="順位" value={me && me.rank > 0 ? `${me.rank}位 / ${me.total_users}人` : "未参加"} />
          <div className="ml-auto flex gap-2">
            <Link to="/makron/history"><Button variant="outline" size="sm"><History className="h-4 w-4 mr-1" />履歴</Button></Link>
            {isAdmin && <Link to="/makron/admin"><Button size="sm"><Shield className="h-4 w-4 mr-1" />管理者画面</Button></Link>}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />問題パック ({filtered.length}/{packs.length})
            </h2>
            <Card className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2 bg-muted/30">
              <Select value={fGrade} onValueChange={setFGrade}>
                <SelectTrigger><Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="学年" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">すべての学年</SelectItem>
                  {GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={fSubj} onValueChange={(v) => { setFSubj(v); setFField("__all"); setFUnit("__all"); }}>
                <SelectTrigger><SelectValue placeholder="教科" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">すべての教科</SelectItem>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={fField} onValueChange={(v) => { setFField(v); setFUnit("__all"); }} disabled={fSubj === "__all"}>
                <SelectTrigger><SelectValue placeholder="分野" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">すべての分野</SelectItem>
                  {visibleFields.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={fUnit} onValueChange={setFUnit}>
                <SelectTrigger><SelectValue placeholder="単元" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">すべての単元</SelectItem>
                  {visibleUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </Card>

            <div className="grid sm:grid-cols-2 gap-3">
              {filtered.map((p) => {
                const qCount = p.qcount?.[0]?.count ?? 0;
                return (
                  <Card key={p.id} className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <div className="font-bold flex-1 truncate">{p.title}</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{labelOf(p)}</div>
                    {p.description && <div className="text-xs text-muted-foreground line-clamp-2">{p.description}</div>}
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3">
                      <span><ListChecks className="h-3 w-3 inline mr-0.5" />{qCount}問</span>
                      {p.shuffle && <span>シャッフル</span>}
                      {p.question_limit && <span>{p.question_limit}問出題</span>}
                      {p.max_attempts && <span>最大{p.max_attempts}回</span>}
                    </div>
                    <div className="flex gap-1 pt-1">
                      <Button size="sm" className="flex-1" onClick={() => startPack(p.id)} disabled={qCount === 0}>
                        <Play className="h-4 w-4 mr-1" />演習開始
                      </Button>
                      {isAdmin && (
                        <>
                          <Link to="/makron/pack/$packId" params={{ packId: p.id }}>
                            <Button size="sm" variant="outline" title="編集・設定"><Settings className="h-4 w-4" /></Button>
                          </Link>
                          <Link to="/makron/pack/$packId/dashboard" params={{ packId: p.id }}>
                            <Button size="sm" variant="outline" title="ダッシュボード"><BarChart3 className="h-4 w-4" /></Button>
                          </Link>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })}
              {filtered.length === 0 && (
                <Card className="p-8 text-center text-sm text-muted-foreground col-span-full">
                  条件に合う問題パックがありません{isAdmin && "（管理者画面から追加できます）"}
                </Card>
              )}
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
            </Card>
            <Card className="divide-y divide-border/60">
              {board.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">まだ参加者がいません</div>}
              {board.map((r) => (
                <div key={r.user_id} className={`flex items-center gap-2 p-2 ${r.user_id === user?.id ? "bg-primary/10" : ""}`}>
                  <div className="w-7 text-center text-sm font-bold tabular-nums">{r.rank}</div>
                  <Avatar className="h-7 w-7"><AvatarImage src={r.avatar_url ?? undefined} /><AvatarFallback>{(r.display_name ?? "?").slice(0, 1)}</AvatarFallback></Avatar>
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
