import { lazy, Suspense, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles, Loader2, History, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { listTowns, recomputeTown, getTownHistory } from "@/lib/town.functions";
import { stageName, stageDescription, MAX_STAGE } from "@/lib/town";

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
        <Skeleton className="h-[240px] w-full rounded-none" />
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
          <h2 className="font-bold">あなたの町</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          まだ町がありません。<Link to="/settings" className="text-primary underline">設定</Link>で目標を入力して町を作りましょう。AIがあなたの学習を見て町を成長(or 退化)させます。
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

function TownCard({ town, onUpdate }: { town: TownRow; onUpdate: () => void }) {
  const judge = useServerFn(recomputeTown);
  const fetchHist = useServerFn(getTownHistory);
  const [judging, setJudging] = useState(false);
  const [history, setHistory] = useState<any[] | null>(null);
  const [lastResult, setLastResult] = useState<{ delta: number; reason: string; narrative: string } | null>(null);

  const onJudge = async () => {
    setJudging(true);
    try {
      const r = await judge({ data: { townId: town.id } });
      setLastResult(r);
      if (r.delta > 0) toast.success(`町が +${r.delta} 段階 発展！`);
      else if (r.delta < 0) toast.warning(`町が ${r.delta} 段階 退化…`);
      else toast.info("町は現状維持です");
      onUpdate();
    } catch (e: any) {
      toast.error(e.message ?? "判定に失敗しました");
    } finally {
      setJudging(false);
    }
  };

  const loadHist = async () => {
    const r = await fetchHist({ data: { townId: town.id } });
    setHistory(r);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="w-full text-left group">
          <Suspense fallback={<Skeleton className="h-[280px] w-full rounded-none" />}>
            <Town3D stage={town.stage} />
          </Suspense>
          <div className="p-4 flex items-center justify-between gap-3 border-t bg-card">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground truncate">{town.name}</div>
              <div className="text-lg font-bold flex items-center gap-2">
                {stageName(town.stage)}
                <Badge variant="outline" className="text-[10px]">Stage {town.stage}</Badge>
                {town.max_stage_reached >= MAX_STAGE && (
                  <Badge variant="secondary" className="text-[10px]">⭐ MAX 到達</Badge>
                )}
              </div>
            </div>
            <div className="text-xs text-primary group-hover:underline shrink-0">詳細 →</div>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{town.name} — {stageName(town.stage)}</DialogTitle>
        </DialogHeader>
        <Suspense fallback={<Skeleton className="h-[280px] w-full" />}>
          <Town3D stage={town.stage} />
        </Suspense>
        <div className="space-y-3 text-sm">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded bg-muted/30 border">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
