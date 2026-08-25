import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { SectionHeading } from "./shared";

export function AiSection() {
  return (
    <div className="space-y-6">
      <SectionHeading title="AI" desc="AIによる学習サポート機能について" />
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" /> AI学習サポート</div>
        <p className="text-sm text-muted-foreground">
          AIは「学習」タブの町の目標や学習記録を見て、アドバイスや町の発展・退化を判断します。
          町の目標は具体的に書くほどAIの提案が的確になります。
        </p>
        <p className="text-xs text-muted-foreground">町の目標の編集は「学習」カテゴリーから行えます。</p>
      </Card>
    </div>
  );
}
