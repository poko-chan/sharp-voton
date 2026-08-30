import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles, Download, Check, Loader2, HardDrive, Trash2, RefreshCw,
  GraduationCap, Cpu, Laptop, Chrome, Zap, Info, Search, Star, Gauge, Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  listAiModels, getAiSelection, setAiSelection, resolveAiTarget,
  AI_ENGINE_LABELS, type AiModelEntry, type AiEngine, type AiTarget,
} from "@/lib/ai-provider";
import {
  storageInfo, clearWebLlmCache, webLlmEnsureLoaded, WEBLLM_TAG_LABELS,
  type StorageInfo, type WebLlmTag,
} from "@/lib/web-llm";
import { chromeAiEnsureDownloaded } from "@/lib/chrome-ai";
import { ollamaDiagnostics, setOllamaUrl, getOllamaUrl } from "@/lib/ollama";

function EngineIcon({ engine, className = "h-4 w-4" }: { engine: AiEngine; className?: string }) {
  if (engine === "nano") return <Chrome className={className} />;
  if (engine === "ollama") return <Laptop className={className} />;
  if (engine === "webllm") return <Cpu className={className} />;
  return <Sparkles className={className} />;
}

const FILTERS: Array<{ key: "all" | WebLlmTag; label: string }> = [
  { key: "all", label: "すべて" },
  { key: "japanese", label: "日本語が得意" },
  { key: "reasoning", label: "考える力" },
  { key: "math", label: "数学" },
  { key: "code", label: "プログラミング" },
  { key: "light", label: "軽量" },
  { key: "pro", label: "高性能PC向け" },
];

function Meter({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-[10px] text-muted-foreground w-10 shrink-0">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, value)}%` }} />
      </span>
    </div>
  );
}

function TutorialDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <GraduationCap className="h-4 w-4" />使い方
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AIのはじめかた（3分でわかる）</DialogTitle>
          <DialogDescription>むずかしい知識はいりません。順番どおりにやればOKです。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {[
            { t: "① AIはこの端末の中で動きます", d: "Study# のAIは、あなたのパソコン・スマホの中だけで動きます。会話が外部に送られることはなく、料金もかかりません。" },
            { t: "② はじめに「ダウンロード」タブへ", d: "AIを使うには、まずAIの本体（モデル）を一度だけダウンロードします。ネットが速い場所で行ってください。数百MB〜数GBあります。" },
            { t: "③ 迷ったら「Qwen3 1.7B」か「標準」", d: "軽くて失敗しにくく、日本語もそこそこ得意です。パソコンが高性能なら Qwen3 4B / 8B にすると一気に賢くなります。" },
            { t: "④ 目的で選ぶのもおすすめ", d: "「日本語が得意」「数学」「考える力」などのタグで絞り込めます。数学の記述対策なら Math 系、作文や要約なら日本語特化が向いています。" },
            { t: "⑤ よくわからなければ「オート」", d: "オートにしておくと、ダウンロード済みの中から賢さと日本語力で一番おすすめのAIを自動で使います。" },
            { t: "⑥ もっと賢くしたい人は Ollama", d: "パソコンに Ollama（無料アプリ）を入れて起動すると、より大きく賢いモデルが使えます。起動時に OLLAMA_ORIGINS=\"*\" を設定してください。" },
          ].map((s) => (
            <div key={s.t} className="rounded-lg border p-3">
              <div className="font-semibold">{s.t}</div>
              <div className="text-muted-foreground text-[13px] mt-0.5">{s.d}</div>
            </div>
          ))}
          <div className="rounded-lg bg-muted/50 p-3 text-[12px] text-muted-foreground">
            うまくいかないときは、空き容量を確認してから「キャッシュを削除」してやり直すか、もっと小さいモデルを選んでください。
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModelCard({
  m, selected, mode, best, onSelect, onDownload, progress,
}: {
  m: AiModelEntry;
  selected: boolean;
  mode: "use" | "download";
  best?: boolean;
  onSelect: () => void;
  onDownload: () => void;
  progress?: { pct: number; text: string } | null;
}) {
  return (
    <Card
      className={`relative overflow-hidden p-3 space-y-2 transition hover:shadow-md ${
        selected ? "border-primary ring-1 ring-primary/40 bg-primary/[0.04]" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <EngineIcon engine={m.engine} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
            <span className="truncate">{m.name}</span>
            <Badge variant="secondary" className="text-[10px]">{m.engineLabel}</Badge>
            {best && <Badge className="text-[10px] gap-0.5"><Star className="h-3 w-3" />おすすめ</Badge>}
            {m.ready && <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">使えます</Badge>}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {m.sizeLabel}{m.params ? ` ・ ${m.params}B` : ""}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{m.note}</div>
          {!!m.tags?.length && (
            <div className="mt-1 flex flex-wrap gap-1">
              {m.tags.map((t) => (
                <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {WEBLLM_TAG_LABELS[t]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {m.engine === "webllm" && (
        <div className="grid gap-1 sm:grid-cols-2">
          <Meter icon={Gauge} label="賢さ" value={m.score} />
          <Meter icon={Languages} label="日本語" value={m.tags?.includes("japanese") ? Math.min(100, m.score + 15) : m.score} />
        </div>
      )}

      {progress && (
        <div className="space-y-1">
          <Progress value={progress.pct} />
          <div className="text-[11px] text-muted-foreground truncate">{progress.pct}% {progress.text}</div>
        </div>
      )}
      <div className="flex justify-end">
        {mode === "use" ? (
          <Button size="sm" variant={selected ? "default" : "outline"} onClick={onSelect}>
            {selected ? <><Check className="h-3.5 w-3.5 mr-1" />選択中</> : "これを使う"}
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={!!progress} onClick={onDownload}>
            {progress ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
            {progress ? "ダウンロード中…" : "ダウンロード"}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function AiStatusBadge({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<AiModelEntry[]>([]);
  const [target, setTarget] = useState<AiTarget | null>(null);
  const [sel, setSel] = useState<string>("auto");
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [ollama, setOllama] = useState<Awaited<ReturnType<typeof ollamaDiagnostics>> | null>(null);
  const [progress, setProgress] = useState<Record<string, { pct: number; text: string }>>({});
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | WebLlmTag>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ms, t, st, od] = await Promise.all([listAiModels(), resolveAiTarget(), storageInfo(), ollamaDiagnostics()]);
      setModels(ms); setTarget(t); setStorage(st); setOllama(od); setSel(getAiSelection());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (open) refresh(); }, [open, refresh]);

  const choose = (key: string) => {
    setAiSelection(key);
    setSel(key);
    resolveAiTarget().then(setTarget);
    toast.success(key === "auto" ? "オート（おすすめを自動選択）にしました" : "使用するAIを変更しました");
  };

  const download = async (m: AiModelEntry) => {
    setProgress((p) => ({ ...p, [m.key]: { pct: 0, text: "準備中…" } }));
    try {
      if (m.engine === "nano") {
        await chromeAiEnsureDownloaded((l, t) =>
          setProgress((p) => ({ ...p, [m.key]: { pct: t > 0 ? Math.round((l / t) * 100) : 0, text: "Chromeが取得中…" } })),
        );
      } else if (m.engine === "webllm") {
        await webLlmEnsureLoaded(
          (pr, text) => setProgress((p) => ({ ...p, [m.key]: { pct: Math.round(pr * 100), text } })),
          m.modelId,
        );
      }
      toast.success(`${m.name} を使えるようになりました`);
      choose(m.key);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "ダウンロードに失敗しました");
    } finally {
      setProgress((p) => { const n = { ...p }; delete n[m.key]; return n; });
    }
  };

  const match = useCallback((m: AiModelEntry) => {
    const okTag = filter === "all" || (m.tags?.includes(filter) ?? false);
    const okQ = !q.trim() || `${m.name} ${m.note} ${m.engineLabel}`.toLowerCase().includes(q.trim().toLowerCase());
    return okTag && okQ;
  }, [filter, q]);

  const ready = useMemo(
    () => models.filter((m) => m.ready).sort((a, b) => b.score - a.score),
    [models],
  );
  const installable = useMemo(
    () => models.filter((m) => m.installable).sort((a, b) => b.score - a.score),
    [models],
  );
  const readyShown = ready.filter(match);
  const installShown = installable.filter(match);
  const bestReady = ready[0]?.key;
  const bestInstall = installable[0]?.key;

  const activeLabel = target && target.engine !== "none" ? `${target.modelLabel}` : "AI未設定";
  const freeGb = storage ? storage.free / 1024 ** 3 : 0;
  const usedPct = storage && storage.quota > 0 ? Math.round((storage.usage / storage.quota) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 h-8">
          <Sparkles className={`h-4 w-4 ${target && target.engine !== "none" ? "text-primary" : "text-muted-foreground"}`} />
          {!compact && <span className="text-xs max-w-[160px] truncate">{activeLabel}</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />AIの設定</DialogTitle>
          <DialogDescription>
            AIはこの端末の中だけで動きます（無料・通信なし）。使うAIを選ぶか、新しいAIをダウンロードしてください。
          </DialogDescription>
        </DialogHeader>

        {/* いま使うAI ヒーロー */}
        <div className="rounded-2xl border bg-gradient-to-br from-primary/12 via-primary/5 to-transparent p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
              <EngineIcon engine={target?.engine ?? "none"} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">いま使うAI</div>
              <div className="truncate text-lg font-bold leading-tight">{activeLabel}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {target && target.engine !== "none" && (
                  <Badge variant="outline" className="gap-1 text-[10px]"><Zap className="h-3 w-3" />{AI_ENGINE_LABELS[target.engine]}</Badge>
                )}
                <Badge variant="secondary" className="text-[10px]">使えるAI {ready.length} 個</Badge>
                {sel === "auto" && <Badge variant="secondary" className="text-[10px]">オート選択中</Badge>}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              <TutorialDialog />
              <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-1">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />再判定
              </Button>
            </div>
          </div>
        </div>

        {/* 検索・絞り込み */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="モデル名や特徴で検索" className="pl-8 h-9" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  filter === f.key ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <Tabs defaultValue="use">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="use">つかう（{ready.length}）</TabsTrigger>
            <TabsTrigger value="download">ダウンロード（{installable.length}）</TabsTrigger>
          </TabsList>

          <TabsContent value="use" className="space-y-2 pt-3">
            <Card className={`p-3 flex items-center gap-3 ${sel === "auto" ? "border-primary ring-1 ring-primary/40" : ""}`}>
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">オート（おすすめ）</div>
                <div className="text-[11px] text-muted-foreground">
                  ダウンロード済みの中から、賢さと日本語力で一番良いAIを自動で選びます。迷ったらこれ。
                </div>
              </div>
              <Button size="sm" variant={sel === "auto" ? "default" : "outline"} onClick={() => choose("auto")}>
                {sel === "auto" ? <><Check className="h-3.5 w-3.5 mr-1" />選択中</> : "使う"}
              </Button>
            </Card>

            {ready.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground space-y-2">
                <Info className="h-5 w-5 mx-auto opacity-60" />
                <div>まだ使えるAIがありません。「ダウンロード」タブからAIを1つ入れてください。</div>
              </Card>
            ) : readyShown.length === 0 ? (
              <Card className="p-4 text-sm text-muted-foreground">条件に合うAIがありません。絞り込みを変えてみてください。</Card>
            ) : (
              readyShown.map((m) => (
                <ModelCard key={m.key} m={m} mode="use" selected={sel === m.key} best={m.key === bestReady}
                  onSelect={() => choose(m.key)} onDownload={() => download(m)} />
              ))
            )}
          </TabsContent>

          <TabsContent value="download" className="space-y-2 pt-3">
            {storage && (
              <Card className="p-3 space-y-2 text-[12px]">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1">
                    空き容量の目安: <b>{freeGb.toFixed(1)}GB</b>
                    <span className="text-muted-foreground">（使用 {(storage.usage / 1024 ** 3).toFixed(1)}GB）</span>
                  </div>
                  <Button size="sm" variant="ghost" className="gap-1 text-destructive"
                    onClick={async () => { await clearWebLlmCache(); toast.success("キャッシュを削除しました"); refresh(); }}>
                    <Trash2 className="h-3.5 w-3.5" />キャッシュ削除
                  </Button>
                </div>
                <Progress value={usedPct} />
              </Card>
            )}
            {installShown.length === 0 && (
              <Card className="p-4 text-sm text-muted-foreground">条件に合うAIがありません。絞り込みを変えてみてください。</Card>
            )}
            {installShown.map((m) => (
              <ModelCard key={m.key} m={m} mode="download" selected={sel === m.key} best={m.key === bestInstall}
                onSelect={() => choose(m.key)} onDownload={() => download(m)} progress={progress[m.key] ?? null} />
            ))}

            <Card className="p-3 space-y-1 text-[12px]">
              <div className="font-semibold flex items-center gap-1.5"><Laptop className="h-4 w-4 text-primary" />Ollama（上級者向け・いちばん賢い）</div>
              <div className="text-muted-foreground">{ollama?.reason}</div>
              <div className="text-muted-foreground">接続先: {getOllamaUrl()}</div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => {
                  const v = window.prompt("Ollama の接続先URL", getOllamaUrl());
                  if (v) { setOllamaUrl(v); refresh(); }
                }}>接続先を変更</Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export const ChromeAiStatusBadge = AiStatusBadge;
