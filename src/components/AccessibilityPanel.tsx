import { useUserPrefs } from "@/lib/user-prefs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Eye } from "lucide-react";

export function AccessibilityPanel() {
  const { prefs, save } = useUserPrefs();
  return (
    <Card className="p-4 space-y-3">
      <div className="font-semibold flex items-center gap-1"><Eye className="h-4 w-4" />アクセシビリティ</div>
      <div className="flex items-center justify-between">
        <span className="text-sm">文字サイズ: {Math.round(prefs.font_scale * 100)}%</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => save({ font_scale: Math.max(0.8, prefs.font_scale - 0.1) })}>−</Button>
          <Button size="sm" variant="outline" onClick={() => save({ font_scale: 1 })}>標準</Button>
          <Button size="sm" variant="outline" onClick={() => save({ font_scale: Math.min(1.5, prefs.font_scale + 0.1) })}>+</Button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">高コントラストモード</span>
        <Switch checked={prefs.high_contrast} onCheckedChange={(v) => save({ high_contrast: v })} />
      </div>
    </Card>
  );
}