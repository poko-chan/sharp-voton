import { useEffect, useState } from "react";
import { Loader2, Sparkles, AlertTriangle, Download, Cpu, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  aiDiagnostics,
  aiEnsureReady,
  setAiEnginePref,
  AI_ENGINE_LABELS,
  type AiDiagnostics,
  type AiEnginePref,
} from "@/lib/ai-provider";
import { WEBLLM_MODELS, setWebLlmModelId, storageInfo, clearWebLlmCache, estimateModelBytes, type StorageInfo } from "@/lib/web-llm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AiRunIndicator } from "@/components/AiRunIndicator";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

function statusColor(s: string) {
  return s === "available" ? "bg-emerald-500"
    : s === "downloading" ? "bg-blue-500"
    : s === "downloadable" ? "bg-amber-500"
    : "bg-red-500";
}
function statusLabel(s: string) {
  return s === "available" ? "利用可能"
    : s === "downloading" ? "取得中"
    : s === "downloadable" ? "ダウンロード可"
    : "利用不可";
}

/** ローカル AI (Gemini Nano / WebLLM) 状態表示 + エンジン選択 + ダウンロード */
export function AiStatusBadge({ compact = false }: { compact?: boolean }) {
  const [d, setD] = useState<AiDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [progressText, setProgressText] = useState<string>("");
  const [pref, setPref] = useState<AiEnginePref>("auto");
  const [diagnosticsError, setDiagnosticsError] = useState(false);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [clearing, setClearing] = useState(false);


  const refresh = async () => {
    try {
      const x = await Promise.race([
        aiDiagnostics(),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);
      setD(x); setPref(x.pref); setDiagnosticsError(false);
    } catch {
      setDiagnosticsError(true);
      setPref(getStoredPref());
    }
  };
  const getStoredPref = (): AiEnginePref => {
    const value = window.localStorage.getItem("ai.engine.pref");
    return value === "nano" || value === "webllm" || value === "cpu" ? value : "auto";
  };
  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("ai-engine-pref-changed", handler);
    return () => window.removeEventListener("ai-engine-pref-changed", handler);
  }, []);

  const download = async () => {
    setBusy(true); setProgress(0); setProgressText("");
    try {
      await aiEnsureReady((loaded, total, text) => {
        setProgress(total > 0 ? Math.round((loaded / total) * 100) : null);
        if (text) setProgressText(text);
      });
      await refresh();
      toast.success("AIモデルの準備が完了しました");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AIモデルの取得に失敗しました");
      await refresh();
    } finally { setBusy(false); }
  };

  const onChangePref = (v: string) => {
    const p = v as AiEnginePref;
    setPref(p);
    setAiEnginePref(p);
    refresh();
  };

  const activeLabel = d ? AI_ENGINE_LABELS[d.active] : diagnosticsError ? "再確認" : "確認中…";
  const activeColor = !d ? diagnosticsError ? "bg-amber-500" : "bg-muted-foreground" : d.active === "none" ? "bg-red-500" : "bg-emerald-500";

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <AiRunIndicator />
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-[11px]">
              <span className={`h-2 w-2 rounded-full ${activeColor}`} />
              AI: {activeLabel}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>AI エンジンの選択と状態</DialogTitle></DialogHeader>
            <AiStatusBadge />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (!d) return (
    <Card className="p-3 text-xs text-muted-foreground space-y-2">
      <div>{diagnosticsError ? "AI の判定が時間切れになりました。対応状況を再確認できます。" : "AI の状態を確認中…"}</div>
      {diagnosticsError && <Button size="sm" variant="outline" onClick={refresh}>再確認</Button>}
    </Card>
  );

  const nanoUsable = d.nano.status === "available" || d.nano.status === "downloadable" || d.nano.status === "downloading";
  const webUsable = d.webllm.status === "available" || d.webllm.status === "downloadable" || d.webllm.status === "downloading";
  const cpuUsable = d.cpu.status !== "unavailable";

  return (
    <Card className="p-3 text-xs space-y-2">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${activeColor}`} />
        <span className="font-bold">アクティブ: {activeLabel}</span>
        <AiRunIndicator />
        <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-[10px]" onClick={refresh} disabled={busy}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "再判定"}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">優先エンジン:</span>
        <Select value={pref} onValueChange={onChangePref}>
          <SelectTrigger className="h-7 text-[11px] w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">自動 (Nano→WebLLM→CPU)</SelectItem>
            <SelectItem value="nano" disabled={!nanoUsable}>Gemini Nano (端末内)</SelectItem>
            <SelectItem value="webllm" disabled={!webUsable}>WebLLM (端末内)</SelectItem>
            <SelectItem value="cpu" disabled={!cpuUsable}>CPU AI (端末内)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div className="rounded border p-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusColor(d.nano.status)}`} />
            <Cpu className="h-3 w-3" />
            <span className="font-semibold">Gemini Nano ({d.nano.browser}): {statusLabel(d.nano.status)}</span>
          </div>
          <div className="text-muted-foreground whitespace-pre-wrap text-[10px]">{d.nano.reason}</div>
        </div>
        <div className="rounded border p-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusColor(d.webllm.status)}`} />
            <Cpu className="h-3 w-3" />
            <span className="font-semibold">WebLLM: {statusLabel(d.webllm.status)}</span>
          </div>
          <div className="text-muted-foreground whitespace-pre-wrap text-[10px]">{d.webllm.reason}</div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] text-muted-foreground shrink-0">モデル:</span>
            <Select
              value={d.webllm.modelId}
              onValueChange={(v) => { setWebLlmModelId(v); refresh(); }}
            >
              <SelectTrigger className="h-7 text-[11px] flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEBLLM_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.label}・{m.sizeLabel}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {WEBLLM_MODELS.find((m) => m.id === d.webllm.modelId)?.note}
            <br />大きいモデルほど賢くなりますが、初回ダウンロードが重くなります。
          </div>
        </div>

        <div className="rounded border p-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusColor(d.cpu.status)}`} />
            <Cloud className="h-3 w-3" />
            <span className="font-semibold">CPU AI: {statusLabel(d.cpu.status)}</span>
          </div>
          <div className="text-muted-foreground whitespace-pre-wrap text-[10px]">{d.cpu.reason}</div>
        </div>
      </div>

      {(d.nano.status === "downloadable" || d.webllm.status === "downloadable" || d.cpu.status === "downloadable" || d.nano.status === "downloading" || d.webllm.status === "downloading" || d.cpu.status === "downloading") && (
        <div className="space-y-2 pt-1 border-t">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={download} disabled={busy} className="h-8">
              {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
              モデルを取得
            </Button>
            {progress !== null && <span className="tabular-nums font-mono text-[10px]">{progress}%</span>}
            {progressText && <span className="text-[10px] text-muted-foreground truncate flex-1">{progressText}</span>}
          </div>
          {busy && progress !== null && <Progress value={progress} className="h-1" />}
        </div>
      )}

      {d.active === "none" && (
        <div className="text-[10px] text-amber-600 flex items-start gap-1 bg-amber-50 p-2 rounded border border-amber-200">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          この端末では端末内 AI を利用できません。Chrome 138+ で Prompt API を有効にするか、WebGPU 対応のブラウザを使用してください。
        </div>
      )}
      {d.active !== "none" && !busy && (
        <div className="text-[10px] text-emerald-600 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />すぐに生成できます ({activeLabel})。
        </div>
      )}
    </Card>
  );
}

export const ChromeAiStatusBadge = AiStatusBadge;
