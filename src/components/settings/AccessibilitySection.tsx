import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { useUserPrefs, useLocalPrefs } from "@/lib/user-prefs";
import { SectionHeading, SettingRow } from "./shared";

export function AccessibilitySection() {
  const { prefs, save } = useUserPrefs();
  const { prefs: localPrefs, save: saveLocal } = useLocalPrefs();
  return (
    <div className="space-y-6">
      <SectionHeading title="アクセシビリティ" desc="文字サイズやコントラスト、動きの設定です" />
      <Card className="p-4 space-y-3">
        <div className="font-semibold flex items-center gap-1"><Eye className="h-4 w-4" />表示</div>
        <div className="flex items-center justify-between">
          <span className="text-sm">文字サイズ: {Math.round(prefs.font_scale * 100)}%</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => save({ font_scale: Math.max(0.8, prefs.font_scale - 0.1) })}>−</Button>
            <Button size="sm" variant="outline" onClick={() => save({ font_scale: 1 })}>標準</Button>
            <Button size="sm" variant="outline" onClick={() => save({ font_scale: Math.min(1.5, prefs.font_scale + 0.1) })}>+</Button>
          </div>
        </div>
        <SettingRow label="高コントラストモード" checked={prefs.high_contrast} onChange={(v) => save({ high_contrast: v })} />
      </Card>
      <Card className="p-6 space-y-3">
        <div className="font-semibold">動き</div>
        <SettingRow
          label="動きを減らす"
          desc="アニメーションや自動再生の演出を抑えます（この端末のみ）"
          checked={localPrefs.reduce_motion}
          onChange={(v) => saveLocal({ reduce_motion: v })}
        />
      </Card>
    </div>
  );
}
