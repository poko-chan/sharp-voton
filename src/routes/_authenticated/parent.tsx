import { createFileRoute } from "@tanstack/react-router";
import { ParentControls } from "@/components/parent/ParentControls";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyChildren,
  linkChildAccount,
  unlinkChild,
  updateChildProfile,
  getChildFullDashboard,
  getChildrenOverview,
  listChildMissions,
  createChildMission,
  deleteChildMission,
  reviewChildMission,
  setFocusLock,
  setFocusLockAll,
} from "@/lib/parent.functions";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Users,
  Link2,
  Trash2,
  Ban,
  Activity,
  Trophy,
  Coins,
  Brain,
  Target,
  Camera,
  Clock,
  BookOpen,
  ShieldAlert,
  Sparkles,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { SERVICES } from "@/lib/restriction-context";

export const Route = createFileRoute("/_authenticated/parent")({
  head: () => ({
    meta: [
      { title: "保護者ダッシュボード｜Study#" },
      {
        name: "description",
        content: "お子様の学習状況・利用時間・ミッションをひと目で見守れる保護者専用ページです。",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ParentPage,
});

function ParentPage() {
  const { accountKind } = useAuth();
  const list = useServerFn(listMyChildren);
  const overview = useServerFn(getChildrenOverview);
  const link = useServerFn(linkChildAccount);
  const unlink = useServerFn(unlinkChild);
  const lockAll = useServerFn(setFocusLockAll);
  const [children, setChildren] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [uname, setUname] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [cs, ov] = await Promise.all([list(), overview()]);
    setChildren(cs as any[]);
    setRows(ov as any[]);
    setSelected((prev) => prev ?? ((cs as any[])[0]?.id ?? null));
  }, [list, overview]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (accountKind !== "parent") {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card className="p-6 text-sm text-muted-foreground">
          このページは保護者アカウント専用です。
        </Card>
      </div>
    );
  }

  const onLink = async () => {
    if (!uname || !pw) return toast.error("ユーザー名とパスワードを入力");
    setBusy(true);
    try {
      await link({ data: { username: uname.trim(), password: pw } });
      toast.success("子供アカウントとリンクしました");
      setUname("");
      setPw("");
      void reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onLockAll = async (minutes: number) => {
    await lockAll({ data: { minutes, scope: "study_only" } });
    toast.success(minutes > 0 ? "全員を集中モードにしました" : "集中モードを解除しました");
    void reload();
  };

  const child = children.find((c) => c.id === selected) ?? null;
  const row = rows.find((r) => r.id === selected) ?? null;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Users /> 保護者ダッシュボード
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* 左ペイン */}
        <div className="space-y-4">
          <Card className="space-y-2 p-4">
            <div className="text-sm font-semibold">お子様</div>
            {rows.length === 0 && (
              <p className="text-xs text-muted-foreground">まだリンクされていません。</p>
            )}
            {rows.map((r) => {
              const active = r.id === selected;
              const focus = r.focusUntil && new Date(r.focusUntil).getTime() > Date.now();
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    active ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <Avatar className="h-10 w-10">
                    {r.avatar_url ? <AvatarImage src={r.avatar_url} /> : null}
                    <AvatarFallback>{(r.display_name ?? "U").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {r.display_name || r.username}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      今日 {r.todayMinutes}分
                      {r.dailyLimit ? ` / ${r.dailyLimit + (r.bonusMinutes ?? 0)}分` : ""}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {focus && <Badge className="px-1 text-[10px]">集中中</Badge>}
                    {r.pendingRequests > 0 && (
                      <Badge variant="destructive" className="px-1 text-[10px]">
                        申請{r.pendingRequests}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </Card>

          <Card className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <ShieldAlert className="h-4 w-4" /> 今すぐ全員集中
            </div>
            <p className="text-[11px] text-muted-foreground">
              勉強以外のページを一時的に使えなくします。
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="destructive" onClick={() => onLockAll(30)}>
                30分
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onLockAll(60)}>
                1時間
              </Button>
              <Button size="sm" variant="outline" onClick={() => onLockAll(0)}>
                解除
              </Button>
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Link2 className="h-4 w-4" /> お子様を追加
            </div>
            <div className="space-y-2">
              <Label className="text-xs">ユーザー名</Label>
              <Input value={uname} onChange={(e) => setUname(e.target.value)} />
              <Label className="text-xs">パスワード</Label>
              <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <Button size="sm" onClick={onLink} disabled={busy} className="w-full">
              リンクする
            </Button>
          </Card>
        </div>

        {/* 右ペイン */}
        {child ? (
          <ChildWorkspace
            key={child.id}
            child={child}
            row={row}
            onChange={reload}
            unlink={unlink}
          />
        ) : (
          <Card className="grid place-items-center p-16 text-sm text-muted-foreground">
            左からお子様をえらんでください。
          </Card>
        )}
      </div>
    </div>
  );
}

function ChildWorkspace({ child, row, onChange, unlink }: any) {
  const updateProfile = useServerFn(updateChildProfile);
  const lock = useServerFn(setFocusLock);
  const [name, setName] = useState(child.display_name ?? "");

  const save = async () => {
    try {
      await updateProfile({ data: { childId: child.id, display_name: name.trim() } });
      toast.success("保存しました");
      onChange();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const doUnlink = async () => {
    if (!confirm("リンクを解除しますか？")) return;
    await unlink({ data: { childId: child.id } });
    toast.success("解除しました");
    onChange();
  };
  const doLock = async (minutes: number) => {
    await lock({ data: { childId: child.id, minutes, scope: "study_only" } });
    toast.success(minutes > 0 ? "集中モードにしました" : "解除しました");
    onChange();
  };

  const focusUntil = row?.focusUntil ? new Date(row.focusUntil) : null;
  const focusOn = focusUntil && focusUntil.getTime() > Date.now();

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <Avatar className="h-14 w-14">
          {child.avatar_url ? <AvatarImage src={child.avatar_url} /> : null}
          <AvatarFallback>{(child.display_name ?? "U").slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-bold">{child.display_name || child.username}</div>
          <div className="truncate text-xs text-muted-foreground">
            @{child.username} · {child.email}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {focusOn && (
            <Badge className="gap-1">
              <Timer className="h-3 w-3" />
              {focusUntil?.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}まで集中
            </Badge>
          )}
          <Button size="sm" variant="destructive" onClick={() => doLock(30)}>
            30分集中
          </Button>
          <Button size="sm" variant="destructive" onClick={() => doLock(60)}>
            1時間集中
          </Button>
          <Button size="sm" variant="outline" onClick={() => doLock(0)}>
            解除
          </Button>
          <Button variant="ghost" size="icon" onClick={doUnlink}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">
            <Activity className="mr-1 h-3 w-3" /> 概要と分析
          </TabsTrigger>
          <TabsTrigger value="missions">
            <Sparkles className="mr-1 h-3 w-3" /> ミッション
          </TabsTrigger>
          <TabsTrigger value="controls">見守り・やり取り</TabsTrigger>
          <TabsTrigger value="restrict">
            <Ban className="mr-1 h-3 w-3" /> 利用制限
          </TabsTrigger>
          <TabsTrigger value="profile">プロフィール</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <ChildFullDetail childId={child.id} todayMinutes={row?.todayMinutes ?? 0} />
        </TabsContent>
        <TabsContent value="missions" className="pt-4">
          <MissionPanel childId={child.id} />
        </TabsContent>
        <TabsContent value="controls" className="pt-4">
          <ParentControls childId={child.id} />
        </TabsContent>
        <TabsContent value="restrict" className="pt-4">
          <ChildRestrictions childId={child.id} />
        </TabsContent>
        <TabsContent value="profile" className="space-y-2 pt-4">
          <Label>表示名</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm" />
          <Button size="sm" onClick={save}>
            保存
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MissionPanel({ childId }: { childId: string }) {
  const listFn = useServerFn(listChildMissions);
  const createFn = useServerFn(createChildMission);
  const delFn = useServerFn(deleteChildMission);
  const reviewFn = useServerFn(reviewChildMission);
  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [coins, setCoins] = useState(50);
  const [due, setDue] = useState("");

  const load = useCallback(async () => {
    setRows((await listFn({ data: { childId } })) as any[]);
  }, [childId, listFn]);
  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!title.trim()) return toast.error("ミッションの内容を入力してください");
    await createFn({
      data: {
        childId,
        title: title.trim(),
        detail: detail.trim() || undefined,
        reward_coins: coins,
        due_date: due || null,
      },
    });
    setTitle("");
    setDetail("");
    setDue("");
    toast.success("ミッションを出しました");
    void load();
  };

  const label: Record<string, string> = {
    open: "とりくみ中",
    claimed: "承認まち",
    done: "たっせい",
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3 p-5">
        <div className="font-semibold">新しいミッション</div>
        <div className="space-y-1">
          <Label className="text-xs">やること</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="英単語を20問おぼえる"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">くわしく（任意）</Label>
          <Input value={detail} onChange={(e) => setDetail(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">ごほうびコイン</Label>
            <Input
              type="number"
              min={0}
              max={300}
              value={coins}
              onChange={(e) => setCoins(Math.max(0, Math.min(300, Number(e.target.value) || 0)))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">期限（任意）</Label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <Button onClick={add} size="sm">
          ミッションを出す
        </Button>
      </Card>

      <Card className="space-y-2 p-5">
        <div className="font-semibold">ミッション一覧</div>
        {rows.length === 0 && <p className="text-xs text-muted-foreground">まだありません。</p>}
        <div className="max-h-[420px] space-y-2 overflow-auto">
          {rows.map((m) => (
            <div key={m.id} className="rounded-xl border p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {label[m.status] ?? m.status} · {m.reward_coins}コイン
                    {m.due_date ? ` · ${m.due_date}まで` : ""}
                  </div>
                  {m.detail && <div className="mt-1 text-xs">{m.detail}</div>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await delFn({ data: { missionId: m.id } });
                    void load();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {m.status === "claimed" && (
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      await reviewFn({ data: { missionId: m.id, approve: true } });
                      toast.success("承認してコインをあげました");
                      void load();
                    }}
                  >
                    承認してコイン
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await reviewFn({ data: { missionId: m.id, approve: false } });
                      void load();
                    }}
                  >
                    もう少し
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ChildFullDetail({ childId, todayMinutes }: { childId: string; todayMinutes: number }) {
  const fetchFull = useServerFn(getChildFullDashboard);
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    fetchFull({ data: { childId } })
      .then(setD)
      .catch(() => {});
  }, [childId]);
  if (!d) return <div className="text-sm text-muted-foreground">読み込み中...</div>;

  const totalMin = (d.logs ?? []).reduce((s: number, r: any) => s + (r.duration_minutes ?? 0), 0);
  const focusMin = Math.round(
    (d.focusLogs ?? []).reduce((s: number, r: any) => s + (r.duration_sec ?? 0), 0) / 60,
  );
  const correct = (d.makronAnswers ?? []).filter((a: any) => a.is_correct).length;
  const answered = (d.makronAnswers ?? []).length;
  const acc = answered ? Math.round((correct / answered) * 100) : 0;
  const openGoals = (d.goals ?? []).filter((g: any) => !g.completed_at).length;

  // 直近7日の推移
  const days: { date: string; min: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(Date.now() + 9 * 3600_000 - i * 86400_000).toISOString().slice(0, 10);
    const min = (d.logs ?? [])
      .filter((l: any) => l.date === day)
      .reduce((s: number, l: any) => s + (l.duration_minutes ?? 0), 0);
    days.push({ date: day.slice(5), min });
  }
  const maxDay = Math.max(1, ...days.map((x) => x.min));

  // 教科バランス
  const subjName = new Map<string, string>((d.subjects ?? []).map((s: any) => [s.id, s.name]));
  const bySubject = new Map<string, number>();
  for (const l of d.logs ?? []) {
    const k = subjName.get(l.subject_id) ?? "その他";
    bySubject.set(k, (bySubject.get(k) ?? 0) + (l.duration_minutes ?? 0));
  }
  const subjRank = [...bySubject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const subjMax = Math.max(1, ...subjRank.map((x) => x[1]));

  const Stat = ({ icon: Icon, label, value }: any) => (
    <div className="flex items-center gap-3 rounded-xl border p-3">
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
      <div className="max-h-56 divide-y overflow-auto rounded border text-xs">
        {rows.length === 0 && <div className="p-3 text-center text-muted-foreground">なし</div>}
        {rows.map((r: any, i: number) => (
          <div key={i} className="p-2">
            {render(r)}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={Clock} label="今日の学習(分)" value={todayMinutes} />
        <Stat icon={Clock} label="90日学習(分)" value={totalMin} />
        <Stat icon={Brain} label="Markon正解率" value={`${acc}%`} />
        <Stat icon={Coins} label="コイン残高" value={d.coins?.balance ?? 0} />
        <Stat icon={Activity} label="集中(分)" value={focusMin} />
        <Stat icon={Target} label="進行中の目標" value={openGoals} />
        <Stat icon={Trophy} label="バッジ" value={(d.badges ?? []).length} />
        <Stat icon={BookOpen} label="ノート" value={(d.notes ?? []).length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <div className="text-sm font-semibold">この7日間の学習時間</div>
          <div className="flex h-40 items-end gap-2">
            {days.map((x) => (
              <div key={x.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="text-[10px] tabular-nums text-muted-foreground">{x.min}</div>
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${(x.min / maxDay) * 100}%`, minHeight: x.min ? 4 : 2 }}
                />
                <div className="text-[10px] text-muted-foreground">{x.date}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <div className="text-sm font-semibold">教科バランス（90日）</div>
          {subjRank.length === 0 && (
            <p className="text-xs text-muted-foreground">まだ記録がありません。</p>
          )}
          <div className="space-y-2">
            {subjRank.map(([k, v]) => (
              <div key={k} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{k}</span>
                  <span className="tabular-nums text-muted-foreground">{v}分</span>
                </div>
                <div className="h-2 rounded bg-muted">
                  <div
                    className="h-2 rounded bg-primary"
                    style={{ width: `${(v / subjMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border p-3 text-xs">
            {subjRank.length > 1 ? (
              <>
                いちばん少ないのは <b>{subjRank[subjRank.length - 1][0]}</b> です。
                声かけのヒントにしてください。
              </>
            ) : (
              "教科ごとの記録がふえると、苦手がわかります。"
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <List
          title="Today予定"
          rows={d.todayEntries.slice(0, 30)}
          render={(r: any) => (
            <div className="flex justify-between">
              <span>
                {r.planned_date} · {r.title ?? r.content ?? ""}
              </span>
              <span className="text-muted-foreground">{r.done_at ? "済" : "未"}</span>
            </div>
          )}
        />
        <List
          title="目標"
          rows={d.goals}
          render={(r: any) => (
            <div className="flex justify-between">
              <span>{r.title}</span>
              <span className="text-muted-foreground">
                {r.completed_at ? "達成" : `${r.progress ?? 0}/${r.target ?? "?"}`}
              </span>
            </div>
          )}
        />
        <List
          title="Markonセッション"
          rows={d.makronSessions}
          render={(r: any) => (
            <div className="flex justify-between">
              <span>{new Date(r.started_at).toLocaleDateString("ja-JP")}</span>
              <span>
                {r.total_score ?? "-"}/{r.total_points ?? "-"}{" "}
                {r.passed === true ? "✅" : r.passed === false ? "❌" : ""}
              </span>
            </div>
          )}
        />
        <List
          title="集中セッション"
          rows={d.focusLogs.slice(0, 30)}
          render={(r: any) => (
            <div className="flex justify-between">
              <span>{new Date(r.started_at).toLocaleString("ja-JP")}</span>
              <span>
                {Math.round((r.duration_sec ?? 0) / 60)}分 集中度{r.focus_score ?? "-"}
              </span>
            </div>
          )}
        />
        <List
          title="コイン取引"
          rows={d.txns.slice(0, 30)}
          render={(r: any) => (
            <div className="flex justify-between">
              <span className={r.amount > 0 ? "text-green-600" : "text-red-600"}>
                {r.amount > 0 ? "+" : ""}
                {r.amount}
              </span>
              <span className="ml-2 truncate text-muted-foreground">{r.reason}</span>
            </div>
          )}
        />
        <List
          title="振り返り"
          rows={d.reflections}
          render={(r: any) => (
            <div>
              <div className="text-muted-foreground">{r.date}</div>
              <div className="line-clamp-2">{r.content ?? r.text ?? ""}</div>
            </div>
          )}
        />
        <List
          title="試験"
          rows={d.exams}
          render={(r: any) => (
            <div className="flex justify-between">
              <span>{r.title}</span>
              <span className="text-muted-foreground">{r.date}</span>
            </div>
          )}
        />
        <List
          title="写真ログ"
          rows={d.photoLogs}
          render={(r: any) => (
            <div className="flex items-center gap-2">
              {r.image_url && <img src={r.image_url} className="h-10 w-10 rounded object-cover" />}
              <span className="text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString("ja-JP")}
              </span>
              <span className="truncate">{r.caption ?? ""}</span>
            </div>
          )}
        />
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Camera className="h-3 w-3" /> 写真ログ {(d.photoLogs ?? []).length} 件
      </div>
    </div>
  );
}

function ChildRestrictions({ childId }: { childId: string }) {
  const [rows, setRows] = useState<Record<string, boolean>>({});
  useEffect(() => {
    supabase
      .from("user_service_restrictions")
      .select("service_key, restricted")
      .eq("user_id", childId)
      .then(({ data }) => {
        const m: Record<string, boolean> = {};
        for (const r of data ?? []) m[r.service_key] = !!r.restricted;
        setRows(m);
      });
  }, [childId]);
  const toggle = async (key: string, v: boolean) => {
    setRows((r) => ({ ...r, [key]: v }));
    await supabase
      .from("user_service_restrictions")
      .upsert(
        { user_id: childId, service_key: key, restricted: v },
        { onConflict: "user_id,service_key" },
      );
    toast.success(v ? "利用停止しました" : "解除しました");
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {SERVICES.map((s) => (
        <div key={s.key} className="flex items-center justify-between rounded border p-2">
          <span className="text-sm">{s.label}</span>
          <Switch checked={!!rows[s.key]} onCheckedChange={(v) => toggle(s.key, v)} />
        </div>
      ))}
    </div>
  );
}
