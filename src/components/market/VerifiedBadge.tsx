import { BadgeCheck } from "lucide-react";

export function DeveloperLine({ developer, verified }: { developer: string; verified: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      開発者: {developer}
      {verified && (
        <span title="Study# 公式認定アカウント（動作・安全性確認済み）" className="inline-flex">
          <BadgeCheck className="h-4 w-4 text-primary" aria-label="公式認定" />
        </span>
      )}
    </span>
  );
}
