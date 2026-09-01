import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Type, MousePointer2, Palette, Volume2, Sparkles } from "lucide-react";
import { useUserPrefs, useLocalPrefs, DEFAULT_LOCAL_PREFS } from "@/lib/user-prefs";
import { SectionHeading, SettingRow } from "./shared";

const FILTERS: { v: "none" | "grayscale" | "protanopia" | "deuteranopia" | "tritanopia"; label: string }[] = [
  { v: "none", label: "なし" },
  { v: "protanopia", label: "P型（赤）" },
  { v: "deuteranopia", label: "D型（緑）" },
  { v: "tritanopia", label: "T型（青）" },
  { v: "grayscale", label: "白黒" },
];

export function AccessibilitySection() {
  const { prefs, save } = useUserPrefs();
  const { prefs: lp, save: saveLocal } = useLocalPrefs();

  return (
    <div className="space-y-6">
      <SectionHeading title="アクセシビリティ（ユニバーサルデザイン）" desc="誰でも使いやすいように、文字・色・操作・読み上げを調整できます" />

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
        <SettingRow label="高コントラストモード" desc="背景と文字の明暗差を最大にします" checked={prefs.high_contrast} onChange={(v) => save({ high_contrast: v })} />
        <SettingRow label="画像を控えめにする" desc="画像を薄く表示し、文字に集中しやすくします" checked={lp.hide_images} onChange={(v) => saveLocal({ hide_images: v })} />
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-semibold flex items-center gap-1"><Type className="h-4 w-4" />読みやすさ</div>
        <SettingRow label="読みやすいフォント（UDフォント）" desc="文字の形が見分けやすいユニバーサルデザイン書体を使います" checked={lp.readable_font} onChange={(v) => saveLocal({ readable_font: v })} />
        <SettingRow label="文字間隔・行間を広げる" desc="ディスレクシアや読み疲れの軽減に役立ちます" checked={lp.text_spacing} onChange={(v) => saveLocal({ text_spacing: v })} />
        {lp.text_spacing && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">行間: {lp.line_height.toFixed(1)}</span>
              <input type="range" min={1.4} max={2.4} step={0.1} value={lp.line_height}
                onChange={(e) => saveLocal({ line_height: Number(e.target.value) })} className="w-40" aria-label="行間" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">文字間隔: {lp.letter_spacing.toFixed(2)}em</span>
              <input type="range" min={0} max={0.2} step={0.01} value={lp.letter_spacing}
                onChange={(e) => saveLocal({ letter_spacing: Number(e.target.value) })} className="w-40" aria-label="文字間隔" />
            </div>
          </div>
        )}
        <SettingRow label="リンクに下線を付ける" desc="色だけに頼らずリンクを判別できます" checked={lp.underline_links} onChange={(v) => saveLocal({ underline_links: v })} />
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-semibold flex items-center gap-1"><Palette className="h-4 w-4" />色覚サポート</div>
        <p className="text-xs text-muted-foreground">見分けにくい色の組み合わせを補正します。</p>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button key={f.v} size="sm" variant={lp.color_filter === f.v ? "default" : "outline"}
              onClick={() => saveLocal({ color_filter: f.v })}>{f.label}</Button>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-semibold flex items-center gap-1"><MousePointer2 className="h-4 w-4" />操作</div>
        <SettingRow label="ボタンを押しやすくする" desc="タップ領域を44px以上に広げます" checked={lp.large_targets} onChange={(v) => saveLocal({ large_targets: v })} />
        <SettingRow label="フォーカス枠を強調" desc="キーボード操作中の位置がはっきり分かります" checked={lp.focus_ring} onChange={(v) => saveLocal({ focus_ring: v })} />
        <SettingRow label="大きいマウスカーソル" checked={lp.big_cursor} onChange={(v) => saveLocal({ big_cursor: v })} />
        <SettingRow label="動きを減らす" desc="アニメーションや自動再生の演出を抑えます" checked={lp.reduce_motion} onChange={(v) => saveLocal({ reduce_motion: v })} />
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-semibold flex items-center gap-1"><Volume2 className="h-4 w-4" />読み上げ</div>
        <SettingRow label="選択したテキストを読み上げる" desc="文章を選ぶと「読み上げ」ボタンが表示されます" checked={lp.tts_enabled} onChange={(v) => saveLocal({ tts_enabled: v })} />
      </Card>

      <Card className="p-4 space-y-2">
        <div className="font-semibold flex items-center gap-1"><Sparkles className="h-4 w-4" />おすすめ設定</div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => { save({ font_scale: 1.2, high_contrast: true }); saveLocal({ readable_font: true, text_spacing: true, underline_links: true, large_targets: true, focus_ring: true }); }}>
            見やすさ重視
          </Button>
          <Button size="sm" variant="outline" onClick={() => { saveLocal({ readable_font: true, text_spacing: true, line_height: 2, letter_spacing: 0.08, reduce_motion: true, tts_enabled: true }); }}>
            読むのが苦手な人向け
          </Button>
          <Button size="sm" variant="outline" onClick={() => { save({ font_scale: 1, high_contrast: false }); saveLocal({ ...DEFAULT_LOCAL_PREFS, week_start_day: lp.week_start_day, dashboard_cards: lp.dashboard_cards }); }}>
            すべて初期値に戻す
          </Button>
        </div>
      </Card>
    </div>
  );
}
