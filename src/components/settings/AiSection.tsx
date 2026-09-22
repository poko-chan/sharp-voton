import { Card } from "@/components/ui/card";
import { Sparkles, ShieldCheck } from "lucide-react";
import { SectionHeading } from "./shared";
import { AiStatusBadge } from "@/components/ChromeAiStatusBadge";

export function AiSection() {
  return (
    <div className="space-y-6">
      <SectionHeading title="AI" desc="使用するAIモデルの選択とダウンロード" />

      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> 使用するAI
        </div>
        <p className="text-sm text-muted-foreground">
          AIはサーバー側で動くので、ダウンロードや設定なしですぐ使えます。端末内で動くAIを選ぶこともできます。
          はじめての方は「使い方」ボタンから読んでみてください。
        </p>

        <AiStatusBadge />
      </Card>

      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" /> プライバシー
        </div>
        <p className="text-sm text-muted-foreground">
          端末内AIを選んだ場合、会話は端末の外に送信されません。サーバー側のAIを使う場合は、回答の生成のためだけに送信され、学習には使われません。AIチャットで「AIが参照できる情報」を種類ごとにオン・オフできます。
        </p>

      </Card>
    </div>
  );
}
