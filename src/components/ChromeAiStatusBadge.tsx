import { useEffect, useState } from "react";
import { Loader2, Sparkles, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  aiDiagnostics,
  aiEnsureReady,
  getAiEnginePref,
  setAiEnginePref,
  type AiDiagnostics,
  type AiEnginePref,
} from "@/lib/ai-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  const refresh = () => aiDiagnostics().then((x) => { setD(x); setPref(x.pref); });
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
    } finally { setBusy(false); }
  };

  const onChangePref = (v: string) => {
    const p = v as AiEnginePref;
    setPref(p);
    setAiEnginePref(p);
    refresh();
  };

  if (!d) return null;

  const activeLabel = d.active === "nano" ? "Gemini Nano"
    : d.active === "webllm" ? "WebLLM"
    : "利用不可";
  const activeColor = d.active === "none" ? "bg-red-500" : "bg-emerald-500";

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px]" title={`Nano:${d.nano.reason}\nWebLLM:${d.webllm.reason}`}>
        <span className={`h-2 w-2 rounded-full ${activeColor}`} />
        AI: {activeLabel}
      </span>
    );
  }

  const nanoUsable = d.nano.status === "available" || d.nano.status === "downloadable" || d.nano.status === "downloading";
  const webUsable = d.webllm.status === "available" || d.webllm.status === "downloadable" || d.webllm.status === "downloading";

  return (
    <Card className="p-3 text-xs space-y-2">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${activeColor}`} />
        <span className="font-bold">アクティブ: {activeLabel}</span>
        <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-[10px]" onClick={refresh} disabled={busy}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "再判定"}
        </Button>
      </div>

      {nanoUsable && webUsable && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">優先エンジン:</span>
          <Select value={pref} onValueChange={onChangePref}>
            <SelectTrigger className="h-7 text-[11px] w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">自動 (Nano 優先)</SelectItem>
              <SelectItem value="nano">Gemini Nano</SelectItem>
              <SelectItem value="webllm">WebLLM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        <div className="rounded border p-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusColor(d.nano.status)}`} />
            <span className="font-semibold">Gemini Nano ({d.nano.browser}): {statusLabel(d.nano.status)}</span>
          </div>
          <div className="text-muted-foreground whitespace-pre-wrap text-[10px]">{d.nano.reason}</div>
        </div>
        <div className="rounded border p-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusColor(d.webllm.status)}`} />
            <span className="font-semibold">WebLLM: {statusLabel(d.webllm.status)}</span>
          </div>
          <div className="text-muted-foreground whitespace-pre-wrap text-[10px]">{d.webllm.reason}</div>
        </div>
      </div>

      {(d.active === "nano" || d.active === "webllm") &&
       (d.nano.status === "downloadable" || d.webllm.status === "downloadable" || d.nano.status === "downloading" || d.webllm.status === "downloading") && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={download} disabled={busy}>
            {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
            モデルを取得
          </Button>
          {progress !== null && <span className="tabular-nums">{progress}%</span>}
          {progressText && <span className="text-[10px] text-muted-foreground truncate">{progressText}</span>}
        </div>
      )}

      {d.active === "none" && (
        <div className="text-[10px] text-amber-600 flex items-start gap-1">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          Gemini Nano・WebLLM のいずれも利用できません。Chrome の Built-in AI フラグを有効化するか、WebGPU 対応ブラウザ (Chrome / Edge) をご利用ください。
        </div>
      )}
      {d.active !== "none" && (
        <div className="text-[10px] text-emerald-600 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />すぐに生成できます ({activeLabel})。
        </div>
      )}
    </Card>
  );
}

/** 後方互換用の別名 */
export const ChromeAiStatusBadge = AiStatusBadge;