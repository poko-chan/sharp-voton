import { useEffect, useState } from "react";
import { Loader2, Sparkles, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { chromeAiDiagnostics, chromeAiEnsureDownloaded, type ChromeAiDiagnostics } from "@/lib/chrome-ai";

/** Chrome Built-in AI (Gemini Nano) の状態表示 + 手動ダウンロード起動 */
export function ChromeAiStatusBadge({ compact = false }: { compact?: boolean }) {
  const [d, setD] = useState<ChromeAiDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const refresh = () => chromeAiDiagnostics().then(setD);
  useEffect(() => { refresh(); }, []);

  const download = async () => {
    setBusy(true); setProgress(0);
    try {
      await chromeAiEnsureDownloaded((loaded, total) => {
        setProgress(total > 0 ? Math.round((loaded / total) * 100) : null);
      });
      await refresh();
    } finally { setBusy(false); }
  };

  if (!d) return null;
  const color = d.status === "available" ? "bg-emerald-500"
    : d.status === "downloading" ? "bg-blue-500"
    : d.status === "downloadable" ? "bg-amber-500"
    : "bg-red-500";
  const label = d.status === "available" ? "利用可能"
    : d.status === "downloading" ? "取得中"
    : d.status === "downloadable" ? "ダウンロード可"
    : "利用不可";

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px]" title={d.reason}>
        <span className={`h-2 w-2 rounded-full ${color}`} />
        Gemini Nano: {label}
      </span>
    );
  }

  return (
    <Card className="p-3 text-xs space-y-2">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <span className="font-bold">Gemini Nano ({d.browser}): {label}</span>
        <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-[10px]" onClick={refresh} disabled={busy}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "再判定"}
        </Button>
      </div>
      <div className="text-muted-foreground whitespace-pre-wrap">{d.reason}</div>
      {(d.status === "downloadable" || d.status === "downloading") && d.hasApi && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={download} disabled={busy}>
            {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
            モデルを取得
          </Button>
          {progress !== null && <span className="tabular-nums">{progress}%</span>}
        </div>
      )}
      {!d.hasApi && (
        <div className="text-[10px] text-amber-600 flex items-start gap-1">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          Chrome の設定でフラグを有効化しないとブラウザ内AIは動作しません。詳細は上部の説明を参照。
        </div>
      )}
      {d.status === "available" && (
        <div className="text-[10px] text-emerald-600 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />すぐに生成できます。
        </div>
      )}
    </Card>
  );
}