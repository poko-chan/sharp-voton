import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyChildren, linkChildAccount, unlinkChild, updateChildProfile, getChildSummary, getChildFullDashboard } from "@/lib/parent.functions";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Users, Link2, Trash2, Ban, Activity, Trophy, Coins, Brain, Target, Camera, Clock, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { SERVICES } from "@/lib/restriction-context";

export const Route = createFileRoute("/_authenticated/parent")({ component: ParentPage });

function ParentPage() {
  const { accountKind } = useAuth();
  const list = useServerFn(listMyChildren);
  const link = useServerFn(linkChildAccount);
  const unlink = useServerFn(unlinkChild);
  const [children, setChildren] = useState<any[]>([]);
  const [uname, setUname] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => setChildren(await list() as any[]);
  useEffect(() => { reload(); }, []);

  if (accountKind !== "parent") {
    return <div className="p-8 max-w-2xl mx-auto">
      <Card className="p-6 text-sm text-muted-foreground">このページは保護者アカウント専用です。</Card>
    </div>;
  }

  const onLink = async () => {
    if (!uname || !pw) return toast.error("ユーザー名とパスワードを入力");
    setBusy(true);
    try {
      await link({ data: { username: uname.trim(), password: pw } });
      toast.success("子供アカウントとリンクしました");
      setUname(""); setPw("");
      reload();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2"><Users /> 保護者ダッシュボード</h1>

      <Card className="p-6 space-y-3">
        <div className="font-semibold flex items-center gap-2"><Link2 className="h-4 w-4" /> 子供アカウントをリンク</div>
        <p className="text-xs text-muted-foreground">お子様のユーザー名とパスワードを入力すると、認証成功時に紐づけられます。</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1"><Label>ユーザー名</Label><Input value={uname} onChange={(e) => setUname(e.target.value)} /></div>
          <div className="space-y-1"><Label>パスワード</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        </div>
        <Button onClick={onLink} disabled={busy}>リンクする</Button>
      </Card>

      {children.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">リンクされた子供アカウントはまだありません。</Card>
      ) : children.map((c) => (
        <ChildPanel key={c.id} child={c} onChange={reload} unlink={unlink} />
      ))}
    </div>
  );
}

function ChildPanel({ child, onChange, unlink }: any) {
  const updateProfile = useServerFn(updateChildProfile);
  const summary = useServerFn(getChildSummary);
  const [name, setName] = useState(child.display_name ?? "");
  const [data, setData] = useState<any>(null);
  useEffect(() => { summary({ data: { childId: child.id } }).then(setData).catch(() => {}); }, [child.id]);

  const save = async () => {
    try { await updateProfile({ data: { childId: child.id, display_name: name.trim() } }); toast.success("保存しました"); }
    catch (e: any) { toast.error(e.message); }
  };
  const unlinkChild = async () => {
    if (!confirm("リンクを解除しますか？")) return;
    await unlink({ data: { childId: child.id } });
    toast.success("解除しました"); onChange();
  };

  const total = (data?.logs ?? []).reduce((s: number, r: any) => s + (r.duration_minutes ?? 0), 0);

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          {child.avatar_url ? <AvatarImage src={child.avatar_url} /> : null}
          <AvatarFallback>{(child.display_name ?? "U").slice(0,1)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{child.display_name || child.username}</div>
          <div className="text-xs text-muted-foreground truncate">@{child.username} · {child.email}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={unlinkChild}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">プロフィール</TabsTrigger>
          <TabsTrigger value="restrict"><Ban className="h-3 w-3 mr-1" /> 利用制限</TabsTrigger>
          <TabsTrigger value="study">学習状況</TabsTrigger>
          <TabsTrigger value="detail"><Activity className="h-3 w-3 mr-1" /> 詳細</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="space-y-2 pt-3">
          <Label>表示名</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" onClick={save}>保存</Button>
        </TabsContent>
        <TabsContent value="restrict" className="space-y-2 pt-3">
          <ChildRestrictions childId={child.id} />
        </TabsContent>
        <TabsContent value="study" className="space-y-2 pt-3">
          <div className="text-sm">直近30日の合計学習時間: <b>{total}</b> 分</div>
          <div className="max-h-72 overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40"><tr><th className="text-left p-2">日付</th><th className="text-left p-2">分</th><th className="text-left p-2">内容</th></tr></thead>
              <tbody>
                {(data?.logs ?? []).map((r: any, i: number) => (
                  <tr key={i} className="border-t"><td className="p-2">{r.date}</td><td className="p-2">{r.duration_minutes}</td><td className="p-2">{r.content ?? ""}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="detail" className="pt-3">
          <ChildFullDetail childId={child.id} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function ChildFullDetail({ childId }: { childId: string }) {
  const fetchFull = useServerFn(getChildFullDashboard);
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetchFull({ data: { childId } }).then(setD).catch(() => {}); }, [childId]);
  if (!d) return <div className="text-sm text-muted-foreground">読み込み中...</div>;
  const totalMin = (d.logs ?? []).reduce((s: number, r: any) => s + (r.duration_minutes ?? 0), 0);
  const focusMin = Math.round((d.focusLogs ?? []).reduce((s: number, r: any) => s + (r.duration_sec ?? 0), 0) / 60);
  const correct = (d.makronAnswers ?? []).filter((a: any) => a.is_correct).length;
  const answered = (d.makronAnswers ?? []).length;
  const acc = answered ? Math.round((correct / answered) * 100) : 0;
  const openGoals = (d.goals ?? []).filter((g: any) => !g.completed_at).length;

  const Stat = ({ icon: Icon, label, value }: any) => (
    <div className="rounded border p-3 flex items-center gap-3">
      <Icon className="h-5 w-5 text-primary" />
      <div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="text-lg font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
  const List = ({ title, rows, render }: any) => (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-muted-foreground">{title}</div>
      <div className="max-h-56 overflow-auto rounded border divide-y text-xs">
        {rows.length === 0 && <div className="p-3 text-center text-muted-foreground">なし</div>}
        {rows.map((r: any, i: number) => <div key={i} className="p-2">{render(r)}</div>)}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat icon={Clock} label="90日学習(分)" value={totalMin} />
        <Stat icon={Activity} label="集中(分)" value={focusMin} />
        <Stat icon={Brain} label="Markon正解率" value={`${acc}%`} />
        <Stat icon={Coins} label="コイン残高" value={d.coins?.balance ?? 0} />
        <Stat icon={Target} label="進行中の目標" value={openGoals} />
        <Stat icon={Trophy} label="バッジ" value={(d.badges ?? []).length} />
        <Stat icon={BookOpen} label="ノート" value={(d.notes ?? []).length} />
        <Stat icon={Camera} label="写真ログ" value={(d.photoLogs ?? []).length} />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <List title="Today予定" rows={d.todayEntries.slice(0, 30)} render={(r: any) => (
          <div className="flex justify-between"><span>{r.planned_date} · {r.title ?? r.content ?? ""}</span><span className="text-muted-foreground">{r.done_at ? "済" : "未"}</span></div>
        )} />
        <List title="目標" rows={d.goals} render={(r: any) => (
          <div className="flex justify-between"><span>{r.title}</span><span className="text-muted-foreground">{r.completed_at ? "達成" : `${r.progress ?? 0}/${r.target ?? "?"}`}</span></div>
        )} />
        <List title="Markonセッション" rows={d.makronSessions} render={(r: any) => (
          <div className="flex justify-between"><span>{new Date(r.started_at).toLocaleDateString("ja-JP")}</span><span>{r.total_score ?? "-"}/{r.total_points ?? "-"} {r.passed === true ? "✅" : r.passed === false ? "❌" : ""}</span></div>
        )} />
        <List title="集中セッション" rows={d.focusLogs.slice(0, 30)} render={(r: any) => (
          <div className="flex justify-between"><span>{new Date(r.started_at).toLocaleString("ja-JP")}</span><span>{Math.round((r.duration_sec ?? 0)/60)}分 集中度{r.focus_score ?? "-"}</span></div>
        )} />
        <List title="コイン取引" rows={d.txns.slice(0, 30)} render={(r: any) => (
          <div className="flex justify-between"><span className={r.amount > 0 ? "text-green-600" : "text-red-600"}>{r.amount > 0 ? "+" : ""}{r.amount}</span><span className="text-muted-foreground truncate ml-2">{r.reason}</span></div>
        )} />
        <List title="振り返り" rows={d.reflections} render={(r: any) => (
          <div><div className="text-muted-foreground">{r.date}</div><div className="line-clamp-2">{r.content ?? r.text ?? ""}</div></div>
        )} />
        <List title="試験" rows={d.exams} render={(r: any) => (
          <div className="flex justify-between"><span>{r.title}</span><span className="text-muted-foreground">{r.date}</span></div>
        )} />
        <List title="ノート" rows={d.notes} render={(r: any) => (
          <div className="flex justify-between"><span className="truncate">{r.title || "無題"}</span><span className="text-muted-foreground">{new Date(r.updated_at).toLocaleDateString("ja-JP")}</span></div>
        )} />
        <List title="写真ログ" rows={d.photoLogs} render={(r: any) => (
          <div className="flex gap-2 items-center">{r.photo_url && <img src={r.photo_url} className="h-10 w-10 object-cover rounded" />}<span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ja-JP")}</span><span className="truncate">{r.caption ?? ""}</span></div>
        )} />
        <List title="ミッション" rows={d.missions.slice(0, 30)} render={(r: any) => (
          <div className="flex justify-between"><span>{r.date} {r.title ?? r.code}</span><span>{r.completed_at ? "✅" : "-"}</span></div>
        )} />
      </div>
    </div>
  );
}

function ChildRestrictions({ childId }: { childId: string }) {
  const [rows, setRows] = useState<Record<string, boolean>>({});
  useEffect(() => {
    supabase.from("user_service_restrictions").select("service_key, restricted").eq("user_id", childId)
      .then(({ data }) => {
        const m: Record<string, boolean> = {};
        for (const r of data ?? []) m[r.service_key] = !!r.restricted;
        setRows(m);
      });
  }, [childId]);
  const toggle = async (key: string, v: boolean) => {
    setRows((r) => ({ ...r, [key]: v }));
    await supabase.from("user_service_restrictions").upsert({ user_id: childId, service_key: key, restricted: v }, { onConflict: "user_id,service_key" });
    toast.success(v ? "利用停止しました" : "解除しました");
  };
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {SERVICES.map((s) => (
        <div key={s.key} className="flex items-center justify-between rounded border p-2">
          <span className="text-sm">{s.label}</span>
          <Switch checked={!!rows[s.key]} onCheckedChange={(v) => toggle(s.key, v)} />
        </div>
      ))}
    </div>
  );
}