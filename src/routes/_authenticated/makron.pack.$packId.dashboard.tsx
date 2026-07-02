import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MakronShell } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw, BarChart3, Users, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/makron/pack/$packId/dashboard")({ component: PackDashboard });

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <Card className="p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value ?? "-"}</div>
    </Card>
  );
}

function PackDashboard() {
  const { packId } = Route.useParams();
  const [pack, setPack] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [attempters, setAttempters] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [filterUser, setFilterUser] = useState<string>("__all");
  const [editScore, setEditScore] = useState<Record<string, number>>({});

  const load = async () => {
    const { data: p } = await (supabase as any).from("makron_packs").select("*").eq("id", packId).maybeSingle();
    setPack(p);
    const [{ data: s, error: sErr }, { data: a, error: aErr }] = await Promise.all([
      (supabase as any).rpc("makron_pack_stats", { _pack_id: packId }),
      (supabase as any).rpc("makron_pack_attempters", { _pack_id: packId }),
    ]);
    if (sErr) toast.error("統計取得: " + sErr.message);
    if (aErr) toast.error("演習者取得: " + aErr.message);
    setStats(s);
    setAttempters(a ?? []);
    const { data: ses, error: sesErr } = await (supabase as any).from("makron_sessions")
      .select("id, user_id, total_score, total_points, passed, started_at, finished_at")
      .eq("pack_id", packId).order("started_at", { ascending: false }).limit(200);
    if (sesErr) toast.error("セッション取得: " + sesErr.message);
    const list = ses ?? [];
    // makron_sessions.user_id は auth.users を参照するため profiles を別クエリで結合
    const uids = Array.from(new Set(list.map((r: any) => r.user_id).filter(Boolean)));
    let profMap: Record<string, any> = {};
    if (uids.length > 0) {
      const { data: profs } = await (supabase as any).from("profiles")
        .select("id, display_name, username").in("id", uids);
      (profs ?? []).forEach((p: any) => { profMap[p.id] = p; });
    }
    setSessions(list.map((r: any) => ({ ...r, profile: profMap[r.user_id] })));
  };
  useEffect(() => { load(); }, [packId]);

  const resetAll = async () => {
    if (!confirm("全演習者の演習回数をリセットしますか？")) return;
    const { error } = await (supabase as any).rpc("makron_pack_reset_attempts", { _pack_id: packId, _user_id: null });
    if (error) return toast.error(error.message);
    toast.success("リセットしました"); load();
  };
  const resetUser = async (uid: string) => {
    const { error } = await (supabase as any).rpc("makron_pack_reset_attempts", { _pack_id: packId, _user_id: uid });
    if (error) return toast.error(error.message);
    toast.success("リセットしました"); load();
  };
  const saveSession = async (sid: string, score: number, passed: boolean) => {
    const { error } = await (supabase as any).rpc("makron_update_session", { _session_id: sid, _score: score, _passed: passed });
    if (error) return toast.error(error.message);
    toast.success("更新しました"); load();
  };
  const delSession = async (sid: string) => {
    if (!confirm("このセッション(解答含む)を削除しますか？")) return;
    await (supabase as any).from("makron_sessions").delete().eq("id", sid);
    load();
  };

  const visibleSessions = filterUser === "__all" ? sessions : sessions.filter((s) => s.user_id === filterUser);

  return (
    <MakronShell back="/makron" title="パックダッシュボード" subtitle={pack?.title}>
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link to="/makron/pack/$packId" params={{ packId }}><Button variant="outline" size="sm">パックに戻る</Button></Link>
          <Button size="sm" variant="destructive" onClick={resetAll}><RotateCcw className="h-4 w-4 mr-1" />全員リセット</Button>
        </div>

        <Tabs defaultValue="stats">
          <TabsList>
            <TabsTrigger value="stats"><BarChart3 className="h-3 w-3 mr-1" />統計</TabsTrigger>
            <TabsTrigger value="attempters"><Users className="h-3 w-3 mr-1" />演習者</TabsTrigger>
            <TabsTrigger value="sessions">セッション・採点</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-3">
            {stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                <Stat label="問題数" value={stats.questions_count} />
                <Stat label="満点" value={stats.total_points} />
                <Stat label="セッション数" value={stats.sessions_count} />
                <Stat label="完了セッション" value={stats.completed_sessions} />
                <Stat label="ユニーク演習者" value={stats.unique_users} />
                <Stat label="合格数" value={stats.pass_count} />
                <Stat label="不合格数" value={stats.fail_count} />
                <Stat label="合格率(%)" value={stats.pass_rate} />
                <Stat label="最高点" value={stats.max_score} />
                <Stat label="最低点" value={stats.min_score} />
                <Stat label="平均点" value={stats.avg_score} />
                <Stat label="中央値" value={stats.median_score} />
                <Stat label="回答総数" value={stats.answers_count} />
                <Stat label="正解数" value={stats.correct_answers} />
                <Stat label="正解率(%)" value={stats.accuracy_rate} />
                <Stat label="平均所要(秒)" value={stats.avg_duration_sec} />
              </div>
            ) : <div className="text-sm text-muted-foreground">読み込み中…</div>}
          </TabsContent>

          <TabsContent value="attempters" className="mt-3">
            <Card className="divide-y">
              {attempters.length === 0 && <div className="p-6 text-sm text-center text-muted-foreground">演習者はまだいません</div>}
              {attempters.map((a: any) => (
                <div key={a.user_id} className="p-3 flex items-center gap-2 text-sm">
                  <div className="flex-1">
                    <div className="font-medium">{a.display_name ?? a.user_id?.slice(0, 8)}</div>
                    <div className="text-[11px] text-muted-foreground">演習{a.attempts_count}回 ・ 最高{a.best_score}点 ・ 最終{a.last_attempt_at ? new Date(a.last_attempt_at).toLocaleString("ja-JP") : "-"}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setFilterUser(a.user_id); }}>セッション表示</Button>
                  <Button size="sm" variant="ghost" onClick={() => resetUser(a.user_id)}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="w-64"><SelectValue placeholder="演習者で絞り込み" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">すべての演習者</SelectItem>
                  {attempters.map((a: any) => <SelectItem key={a.user_id} value={a.user_id}>{a.display_name ?? a.user_id?.slice(0,8)}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">{visibleSessions.length}件</span>
            </div>
            <Card className="divide-y max-h-[60vh] overflow-auto">
              {visibleSessions.length === 0 && <div className="p-6 text-sm text-center text-muted-foreground">セッションはありません</div>}
              {visibleSessions.map((s: any) => (
                <div key={s.id} className="p-3 flex items-center gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.profile?.display_name ?? s.profile?.username ?? s.user_id?.slice(0,8)}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(s.started_at).toLocaleString("ja-JP")} ・ {s.finished_at ? "完了" : "途中"}</div>
                  </div>
                  <Input type="number" className="w-20" value={editScore[s.id] ?? s.total_score ?? 0}
                    onChange={(e) => setEditScore((p) => ({ ...p, [s.id]: Number(e.target.value) }))} />
                  <span className="text-[11px] text-muted-foreground">/ {s.total_points ?? 0}</span>
                  <Select value={s.passed === true ? "1" : s.passed === false ? "0" : "_"} onValueChange={(v) => saveSession(s.id, editScore[s.id] ?? s.total_score ?? 0, v === "1")}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">未判定</SelectItem>
                      <SelectItem value="1">合格</SelectItem>
                      <SelectItem value="0">不合格</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => saveSession(s.id, editScore[s.id] ?? s.total_score ?? 0, s.passed === true)}><Pencil className="h-3.5 w-3.5 mr-1" />保存</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => delSession(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MakronShell>
  );
}