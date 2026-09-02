import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Sparkles, Loader2, History, ArrowLeft, ArrowRight, Users, TrendingUp, Leaf,
  Hammer, Map as MapIcon, Coins, Trash2, Smile, Landmark, Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { listTowns, recomputeTown, getTownHistory } from "@/lib/town.functions";
import { stageName, stageDescription, MAX_STAGE } from "@/lib/town";
import {
  BUILD_DEFS, POLICY_DEFS, buildDef, refundOf, computeMetrics, fmtNum, isBuildableCell,
  type BuildingRow, type Metrics, type StudyInput,
} from "@/lib/town-economy";

import { TownMap } from "@/components/town/TownMap";
import { localDateStr, addDaysStr } from "@/lib/date";

const Town3D = lazy(() => import("@/components/Town3D"));

type TownRow = {
  id: string;
  name: string;
  town_goal: string;
  stage: number;
  max_stage_reached: number;
  archived: boolean;
  last_judged_at: string | null;
  created_at: string;
};

export function Town() {
  const fetchList = useServerFn(listTowns);
  const [towns, setTowns] = useState<TownRow[] | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const load = async () => {
    const data = await fetchList();
    const active = (data as TownRow[]).filter((t) => !t.archived);
    setTowns(active);
    setActiveIdx((i) => Math.min(i, Math.max(0, active.length - 1)));
  };

  useEffect(() => { load(); }, []);

  if (towns === null) {
    return (
      <Card className="overflow-hidden">
        <Skeleton className="h-[340px] w-full rounded-none" />
        <div className="p-4 space-y-2 border-t">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-40" />
        </div>
      </Card>
    );
  }

  if (towns.length === 0) {
    return (
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-bold">あなたの街</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          まだ街がありません。<Link to="/settings" className="text-primary underline">設定</Link>で目標を入力して街を作りましょう。学習内容が人口・GDP・CO2として街に反映されます。
        </p>
      </Card>
    );
  }

  const t = towns[activeIdx];
  return (
    <Card className="overflow-hidden">
      {towns.length > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 text-xs">
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setActiveIdx((i) => (i - 1 + towns.length) % towns.length)}>
            <ArrowLeft className="h-3 w-3" />
          </Button>
          <span className="text-muted-foreground">{activeIdx + 1} / {towns.length}</span>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setActiveIdx((i) => (i + 1) % towns.length)}>
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}
      <TownCard town={t} onUpdate={load} />
    </Card>
  );
}

// ---------------- データ取得 ----------------
function useTownEconomy(townId: string) {
  const { user } = useAuth();
  const [study, setStudy] = useState<StudyInput | null>(null);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [policies, setPolicies] = useState<string[]>([]);
  const [coins, setCoins] = useState(0);

  const load = async () => {
    if (!user) return;
    const since = addDaysStr(new Date(), -29);
    const [logsRes, gradesRes, goalsRes, bRes, pRes, cRes] = await Promise.all([
      supabase.from("study_logs").select("date, duration_minutes, subject_id").eq("user_id", user.id).gte("date", since),
      supabase.from("grading_history").select("score").eq("user_id", user.id).limit(500),
      supabase.from("goals").select("done").eq("user_id", user.id),
      (supabase as any).from("town_buildings").select("id, kind, gx, gz, level").eq("town_id", townId),
      (supabase as any).from("town_policies").select("key, enabled").eq("town_id", townId),
      supabase.from("user_coins").select("balance").eq("user_id", user.id).maybeSingle(),
    ]);
    const logs = logsRes.data ?? [];
    const dayMap = new Map<string, number>();
    logs.forEach((l: any) => dayMap.set(l.date, (dayMap.get(l.date) ?? 0) + (l.duration_minutes ?? 0)));
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const k = addDaysStr(new Date(), -i);
      if ((dayMap.get(k) ?? 0) > 0) streak++;
      else if (i > 0) break;
    }
    const grades = gradesRes.data ?? [];
    setStudy({
      minutes30: logs.reduce((s: number, l: any) => s + Math.min(600, l.duration_minutes ?? 0), 0),
      activeDays30: Array.from(dayMap.values()).filter((v) => v > 0).length,
      avgScore: grades.length ? Math.round(grades.reduce((s: number, g: any) => s + (g.score ?? 0), 0) / grades.length) : 0,
      subjects: new Set(logs.map((l: any) => l.subject_id).filter(Boolean)).size,
      goalsDone: (goalsRes.data ?? []).filter((g: any) => g.done).length,
      streak,
    });
    setBuildings((bRes.data ?? []) as BuildingRow[]);
    setPolicies(((pRes.data ?? []) as any[]).filter((p) => p.enabled).map((p) => p.key));
    setCoins(cRes.data?.balance ?? 0);
  };

  useEffect(() => { load(); }, [townId, user?.id]);
  return { study, buildings, policies, coins, reload: load, todayStr: localDateStr() };
}

function MetricTile({ icon: Icon, label, value, sub, tone }: {
  icon: any; label: string; value: string; sub?: string; tone: "primary" | "emerald" | "amber";
}) {
  const cls = tone === "emerald" ? "bg-emerald-500/12 text-emerald-600"
    : tone === "amber" ? "bg-amber-500/12 text-amber-600" : "bg-primary/12 text-primary";
  return (
    <div className="p-3 rounded-xl border bg-card/60 flex items-start gap-2.5">
      <div className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${cls}`}><Icon className="h-4 w-4" /></div>
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="text-lg font-bold tabular-nums leading-tight truncate">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
      </div>
    </div>
  );
}

function TownCard({ town, onUpdate }: { town: TownRow; onUpdate: () => void }) {
  const judge = useServerFn(recomputeTown);
  const fetchHist = useServerFn(getTownHistory);
  const { study, buildings, policies, coins, reload } = useTownEconomy(town.id);
  const [open, setOpen] = useState(false);
  const [judging, setJudging] = useState(false);
  const [history, setHistory] = useState<any[] | null>(null);
  const [lastResult, setLastResult] = useState<{ delta: number; reason: string; narrative: string } | null>(null);

  const [buildMode, setBuildMode] = useState(false);
  const [picked, setPicked] = useState<BuildDefKind>(null);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [busy, setBusy] = useState(false);

  const metrics: Metrics | null = useMemo(
    () => (study ? computeMetrics(town.stage, study, buildings, policies) : null),
    [town.stage, study, buildings, policies],
  );

  const onJudge = async () => {
    setJudging(true);
    try {
      const r = await judge({ data: { townId: town.id } });
      setLastResult(r);
      if (r.delta > 0) toast.success(`街が +${r.delta} 段階 発展！`);
      else if (r.delta < 0) toast.warning(`街が ${r.delta} 段階 退化…`);
      else toast.info("街は現状維持です");
      onUpdate(); reload();
    } catch (e: any) {
      toast.error(e.message ?? "判定に失敗しました");
    } finally {
      setJudging(false);
    }
  };

  const loadHist = async () => setHistory(await fetchHist({ data: { townId: town.id } }));

  const selectedBuilding = selected
    ? buildings.find((b) => b.gx === selected[0] && b.gz === selected[1]) ?? null
    : null;

  const buildAt = async (gx: number, gz: number, kind?: string) => {
    const k = kind ?? picked;
    if (!k) return toast.info("先に建てる建物を選んでください");
    const def = buildDef(k)!;
    if (buildings.some((b) => b.gx === gx && b.gz === gz)) return toast.error("この区画にはすでに建物があります");
    if (town.stage < def.minStage) return toast.error(`ステージ ${def.minStage} 以上で建設できます`);
    if (coins < def.cost) return toast.error(`コインが足りません (必要 ${def.cost})`);
    setBusy(true);
    const { error } = await (supabase as any).rpc("town_build", {
      _town_id: town.id, _kind: def.kind, _gx: gx, _gz: gz, _cost: def.cost,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${def.label} を建設しました (-${def.cost} コイン)`);
    reload();
  };

  const build = async () => {
    if (!selected) return toast.info("区画を選んでください");
    await buildAt(selected[0], selected[1]);
  };

  /** 区画クリック：建物を選んでいて空き区画ならその場で建設、それ以外は選択のみ */
  const onCell = (gx: number, gz: number) => {
    setSelected([gx, gz]);
    const occupied = buildings.some((b) => b.gx === gx && b.gz === gz);
    if (picked && !occupied && !busy) void buildAt(gx, gz);
  };

  const demolish = async () => {
    if (!selectedBuilding) return;
    const def = buildDef(selectedBuilding.kind);
    const refund = refundOf(def?.cost ?? 0);
    if (!confirm(`${def?.label ?? "建物"} を解体しますか？（${refund} コイン返金）`)) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc("town_demolish", { _building_id: selectedBuilding.id, _refund: refund });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`解体しました (+${refund} コイン)`);
    setSelected(null);
    reload();
  };


  const togglePolicy = async (key: string, on: boolean) => {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;
    const { error } = await (supabase as any)
      .from("town_policies")
      .upsert({ town_id: town.id, user_id: uid, key, enabled: on }, { onConflict: "town_id,key" });
    if (error) return toast.error(error.message);
    reload();
  };

  const radius = Math.min(3, 1 + Math.floor(town.stage / 3));

  return (
    <>
      <div className="w-full text-left group">
        <div className="relative">
          <Suspense fallback={<Skeleton className="h-[340px] w-full rounded-none" />}>
            <Town3D stage={town.stage} height={340} userBuildings={buildings as any} />
          </Suspense>
          <Button
            size="sm" variant="secondary"
            className="absolute right-3 top-3 h-8 gap-1 shadow"
            onClick={() => setOpen(true)}
          >
            <Maximize2 className="h-3.5 w-3.5" />街を見る・建設
          </Button>
        </div>

        {/* 指標ストリップ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border-t bg-card">
          {metrics ? (
            <>
              <MetricTile icon={Users} label="人口" value={fmtNum(metrics.population)} sub={`成長率 ${metrics.growthPct > 0 ? "+" : ""}${metrics.growthPct}%`} tone="primary" />
              <MetricTile icon={TrendingUp} label="GDP" value={`${fmtNum(metrics.gdp)} 百万円`} sub={`一人当たり ${metrics.gdpPerCapita} 万円`} tone="emerald" />
              <MetricTile icon={Leaf} label="CO2排出" value={`${fmtNum(metrics.co2)} t/年`} sub={`環境スコア ${metrics.green}`} tone="amber" />
              <MetricTile icon={Smile} label="幸福度" value={`${metrics.happiness}`} sub={`${stageName(town.stage)} ・ 建物 ${buildings.length}`} tone="primary" />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
          )}
        </div>

        <div className="px-4 py-3 flex items-center justify-between gap-3 border-t bg-card">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground truncate">{town.name}</div>
            <div className="text-lg font-bold flex items-center gap-2">
              {stageName(town.stage)}
              <Badge variant="outline" className="text-[10px]">Stage {town.stage}</Badge>
              {town.max_stage_reached >= MAX_STAGE && <Badge variant="secondary" className="text-[10px]">⭐ MAX 到達</Badge>}
            </div>
          </div>
          <div className="text-xs flex items-center gap-1 shrink-0 text-amber-600 font-semibold tabular-nums">
            <Coins className="h-3.5 w-3.5" />{coins.toLocaleString("ja-JP")}
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {town.name} — {stageName(town.stage)}
              <span className="ml-auto text-xs font-normal flex items-center gap-1 text-amber-600">
                <Coins className="h-3.5 w-3.5" />{coins.toLocaleString("ja-JP")}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="relative rounded-lg overflow-hidden border">
            <Suspense fallback={<Skeleton className="h-[380px] w-full" />}>
              <Town3D
                stage={town.stage}
                height={380}
                userBuildings={buildings as any}
                buildMode={buildMode}
                selected={selected}
                autoRotate={!buildMode}
                onPick={onCell}
                onSelectBuilding={(b) => setSelected([b.gx, b.gz])}
              />
            </Suspense>
            <div className="absolute right-3 top-3 flex gap-2">
              <Button size="sm" variant={buildMode ? "default" : "secondary"} className="h-8" onClick={() => setBuildMode((v) => !v)}>
                <Hammer className="h-3.5 w-3.5 mr-1" />{buildMode ? "建設モード ON" : "建設モード"}
              </Button>
            </div>
            {buildMode && (
              <div className="absolute left-3 bottom-3 text-[11px] px-2 py-1 rounded bg-background/85 border">
                {picked
                  ? `${buildDef(picked)?.emoji} ${buildDef(picked)?.label} を選択中 — 空き区画をクリックすると即建設`
                  : "「建設」タブで建物を選ぶと、区画クリックで即建設できます"}
              </div>
            )}

          </div>

          <Tabs defaultValue="build" className="mt-2">
            <TabsList>
              <TabsTrigger value="economy"><TrendingUp className="h-3.5 w-3.5 mr-1" />経済</TabsTrigger>
              <TabsTrigger value="policy"><Landmark className="h-3.5 w-3.5 mr-1" />政策</TabsTrigger>
              <TabsTrigger value="build"><Hammer className="h-3.5 w-3.5 mr-1" />建設</TabsTrigger>
              <TabsTrigger value="map"><MapIcon className="h-3.5 w-3.5 mr-1" />地図</TabsTrigger>
              <TabsTrigger value="info">詳細</TabsTrigger>
            </TabsList>

            {/* 経済 */}
            <TabsContent value="economy" className="mt-3 space-y-3">
              {metrics && study && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <MetricTile icon={Users} label="人口" value={fmtNum(metrics.population)} sub={`成長率 ${metrics.growthPct > 0 ? "+" : ""}${metrics.growthPct}%`} tone="primary" />
                    <MetricTile icon={TrendingUp} label="GDP" value={`${fmtNum(metrics.gdp)} 百万円`} sub={`一人当たり ${metrics.gdpPerCapita} 万円`} tone="emerald" />
                    <MetricTile icon={Leaf} label="CO2排出" value={`${fmtNum(metrics.co2)} t/年`} sub={`一人当たり ${metrics.co2PerCapita} kg`} tone="amber" />
                    <MetricTile icon={Smile} label="幸福度 / 環境" value={`${metrics.happiness} / ${metrics.green}`} tone="primary" />
                  </div>
                  <div className="rounded-lg border p-3 text-xs space-y-1 bg-muted/20">
                    <div className="font-semibold text-[11px] text-muted-foreground">この指標を決めている勉強データ（直近30日）</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                      <span>学習時間: <b>{study.minutes30}分</b></span>
                      <span>活動日数: <b>{study.activeDays30}日</b></span>
                      <span>連続日数: <b>{study.streak}日</b></span>
                      <span>採点平均: <b>{study.avgScore}点</b></span>
                      <span>学習教科数: <b>{study.subjects}</b></span>
                      <span>達成した目標: <b>{study.goalsDone}</b></span>
                    </div>
                    <p className="text-muted-foreground pt-1">
                      学習時間と継続が人口を、学力(採点平均)と教科の広さが一人当たりGDPを、継続と再エネ・公園がCO2を決めます。
                    </p>
                  </div>
                </>
              )}
            </TabsContent>

            {/* 政策 */}
            <TabsContent value="policy" className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                勉強データで解放される経済政策です。ON/OFF すると指標が即座に変化します。
              </p>
              {POLICY_DEFS.map((p) => {
                const unlocked = study ? p.requires(study) : false;
                const on = policies.includes(p.key);
                const preview = study
                  ? computeMetrics(town.stage, study, buildings, on ? policies.filter((k) => k !== p.key) : [...policies, p.key])
                  : null;
                return (
                  <div key={p.key} className={`rounded-lg border p-3 flex items-start gap-3 ${unlocked ? "" : "opacity-60"}`}>
                    <div className="text-xl">{p.emoji}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm">{p.label}</div>
                      <div className="text-xs text-muted-foreground">{p.desc}</div>
                      {!unlocked && <div className="text-[11px] text-amber-600 mt-0.5">解放条件: {p.requireLabel}</div>}
                      {unlocked && preview && metrics && (
                        <div className="text-[11px] mt-1 tabular-nums text-muted-foreground">
                          {on ? "OFFにすると" : "ONにすると"} 人口 {sign(preview.population - metrics.population)} ・
                          GDP {sign(preview.gdp - metrics.gdp)} ・ CO2 {sign(preview.co2 - metrics.co2)}
                        </div>
                      )}
                    </div>
                    <Switch checked={on} disabled={!unlocked} onCheckedChange={(v) => togglePolicy(p.key, v)} />
                  </div>
                );
              })}
            </TabsContent>

            {/* 建設 */}
            <TabsContent value="build" className="mt-3 space-y-3">
              <div className="rounded-lg border bg-muted/20 p-2.5 flex flex-wrap items-center gap-2 text-xs sticky top-0 z-10 backdrop-blur">
                <Button size="sm" variant={buildMode ? "default" : "outline"} onClick={() => setBuildMode((v) => !v)}>
                  <Hammer className="h-3.5 w-3.5 mr-1" />建設モード{buildMode ? "ON" : "OFF"}
                </Button>
                <span className="font-medium">
                  {picked ? `${buildDef(picked)?.emoji} ${buildDef(picked)?.label} を選択中` : "建物を選んでください"}
                </span>
                {picked && (
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setPicked(null)}>選択解除</Button>
                )}
                <span className="text-muted-foreground ml-auto">
                  区画 {selected ? `(${selected[0]}, ${selected[1]})` : "未選択"}
                  {selectedBuilding && ` ・ ${buildDef(selectedBuilding.kind)?.label ?? selectedBuilding.kind}`}
                </span>
              </div>

              <div className="flex flex-col lg:flex-row gap-4">
                {/* 建てる場所（2Dマップ：クリックで即建設） */}
                <div className="shrink-0 space-y-2">
                  <TownMap
                    radius={radius}
                    buildings={buildings}
                    selected={selected}
                    onPick={onCell}
                    size={300}
                  />
                  <p className="text-[11px] text-muted-foreground max-w-[300px]">
                    グレーの線は道路です。マス（区画）をクリックすると、選択中の建物をその場に建設します。建物のあるマスを押すと詳細と解体ができます。
                  </p>
                  {selectedBuilding && (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={demolish} disabled={busy}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      解体（+{refundOf(buildDef(selectedBuilding.kind)?.cost ?? 0)}コイン）
                    </Button>
                  )}
                  {!selectedBuilding && selected && picked && (
                    <Button size="sm" onClick={build} disabled={busy}>
                      {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Hammer className="h-4 w-4 mr-1" />}
                      ここに建設（{buildDef(picked)?.cost}コイン）
                    </Button>
                  )}
                </div>

                {/* 建物パレット */}
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 flex-1 min-w-0 content-start">
                  {BUILD_DEFS.map((d) => {
                    const locked = town.stage < d.minStage;
                    const poor = coins < d.cost;
                    return (
                      <button
                        key={d.kind}
                        onClick={() => { setPicked(d.kind); setBuildMode(true); }}
                        disabled={locked}
                        className={`text-left rounded-lg border p-2.5 transition ${picked === d.kind ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "hover:bg-muted/40"} ${locked ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{d.emoji}</span>
                          <span className="font-semibold text-sm">{d.label}</span>
                          <span className={`ml-auto text-xs tabular-nums flex items-center gap-0.5 ${poor ? "text-destructive" : "text-amber-600"}`}>
                            <Coins className="h-3 w-3" />{d.cost}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{d.desc}</div>
                        <div className="text-[11px] mt-1 tabular-nums">
                          人口 {sign(d.pop)} ・ GDP {sign(d.gdp)} ・ CO2 {sign(d.co2)}
                        </div>
                        {locked && <div className="text-[10px] text-amber-600 mt-1">Stage {d.minStage} で解放</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                コインはミッションや学習報酬で貯まります。建てた建物は3Dの街にそのまま反映されます。
              </p>

            </TabsContent>

            {/* 地図 */}
            <TabsContent value="map" className="mt-3">
              <div className="flex flex-col md:flex-row gap-4 items-start">
                <TownMap
                  radius={radius}
                  buildings={buildings}
                  selected={selected}
                  onPick={(gx, gz) => { setBuildMode(true); onCell(gx, gz); }}
                  size={280}
                />
                <div className="text-sm space-y-2 min-w-0">
                  <div className="font-semibold">区画の詳細</div>
                  {selected ? (
                    selectedBuilding ? (
                      <div className="rounded-lg border p-3 space-y-1">
                        <div className="text-base font-bold">
                          {buildDef(selectedBuilding.kind)?.emoji} {buildDef(selectedBuilding.kind)?.label}
                        </div>
                        <div className="text-xs text-muted-foreground">位置 ({selected[0]}, {selected[1]}) ・ Lv{selectedBuilding.level}</div>
                        <div className="text-xs tabular-nums">
                          人口 {sign(buildDef(selectedBuilding.kind)?.pop ?? 0)} ・
                          GDP {sign(buildDef(selectedBuilding.kind)?.gdp ?? 0)} ・
                          CO2 {sign(buildDef(selectedBuilding.kind)?.co2 ?? 0)}
                        </div>
                        <Button size="sm" variant="outline" className="text-destructive mt-1" onClick={demolish} disabled={busy}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" />解体
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                        空き区画 ({selected[0]}, {selected[1]})。「建設」タブから建物を選んで建てられます。
                      </div>
                    )
                  ) : (
                    <div className="text-xs text-muted-foreground">地図か3Dの区画をクリックすると詳細が表示されます。</div>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    建物 {buildings.length} 棟 ・ 都市半径 {radius} ブロック
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 詳細 */}
            <TabsContent value="info" className="mt-3 space-y-3 text-sm">
              <p className="text-muted-foreground">{stageDescription(town.stage)}</p>
              <div className="rounded border bg-muted/30 p-3 space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">目標</div>
                <div className="whitespace-pre-wrap text-sm">{town.town_goal || "未設定"}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Info label="現在ステージ" value={`${town.stage}`} />
                <Info label="最大到達" value={`${town.max_stage_reached}`} />
                <Info label="最終判定" value={town.last_judged_at ? new Date(town.last_judged_at).toLocaleDateString("ja-JP") : "未判定"} />
              </div>

              {lastResult && (
                <div className="rounded border bg-primary/5 border-primary/30 p-3 space-y-1">
                  <div className="text-xs font-semibold flex items-center gap-2">
                    <Sparkles className="h-3 w-3" /> 判定結果 (Δ {lastResult.delta > 0 ? `+${lastResult.delta}` : lastResult.delta})
                  </div>
                  <div className="text-sm">{lastResult.reason}</div>
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap">{lastResult.narrative}</div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={onJudge} disabled={judging}>
                  {judging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  学習データを反映して再計算
                </Button>
                <Button variant="outline" onClick={loadHist}>
                  <History className="mr-2 h-4 w-4" /> 履歴を見る
                </Button>
                <Link to="/settings"><Button variant="ghost">⚙ 設定</Button></Link>
              </div>

              {history && (
                <div className="space-y-1 text-xs max-h-60 overflow-auto border rounded p-2">
                  {history.length === 0 && <div className="text-muted-foreground">履歴なし</div>}
                  {history.map((h) => (
                    <div key={h.id} className="border-b last:border-0 py-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{new Date(h.created_at).toLocaleString("ja-JP")}</span>
                        <span className={h.delta > 0 ? "text-emerald-600" : h.delta < 0 ? "text-amber-600" : "text-muted-foreground"}>
                          Δ {h.delta > 0 ? `+${h.delta}` : h.delta} ({h.stage_before}→{h.stage_after})
                        </span>
                      </div>
                      {h.reason && <div className="text-muted-foreground">{h.reason}</div>}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

type BuildDefKind = (typeof BUILD_DEFS)[number]["kind"] | null;

function sign(n: number) {
  if (n === 0) return "±0";
  return n > 0 ? `+${fmtNum(n)}` : `-${fmtNum(Math.abs(n))}`;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded bg-muted/30 border">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
