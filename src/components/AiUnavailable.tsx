import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Chrome Built-in AI が使えないブラウザ向けの説明バナー */
export function AiUnavailable({ feature, className }: { feature?: string; className?: string }) {
  return (
    <Card className={`p-4 border-amber-500/40 bg-amber-500/5 ${className ?? ""}`}>
      <div className="flex items-start gap-2 text-sm">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <div className="font-bold text-amber-700 dark:text-amber-400">
            この機能{feature ? `「${feature}」` : ""}は、お使いのブラウザでは利用できません
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            このアプリの AI 機能は <b>Chrome 内蔵 AI（Prompt API / Gemini Nano）</b>を使用しています。
            <br />
            <b>Chrome 138 以降のデスクトップ版</b>でご利用ください（Edge / Safari / Firefox / iOS は未対応）。
            <br />
            初回利用時、モデル（数 GB）の自動ダウンロードが発生する場合があります。
          </div>
        </div>
      </div>
    </Card>
  );
}