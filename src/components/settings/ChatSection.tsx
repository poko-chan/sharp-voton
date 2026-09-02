import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useLocalPrefs } from "@/lib/user-prefs";
import { SectionHeading, SettingRow } from "./shared";


export function ChatSection() {
  const { prefs, save } = useLocalPrefs();
  return (
    <div className="space-y-6">
      <SectionHeading title="チャット" desc="メッセージの送信方法や表示を調整します（この端末のみ）" />
      <Card className="p-6 space-y-5">
        <SettingRow
          label="Enterで送信"
          desc={prefs.chat_enter_send ? "Shift+Enterで改行します" : "Ctrl(⌘)+Enterで送信、Enterで改行します"}
          checked={prefs.chat_enter_send}
          onChange={(v) => save({ chat_enter_send: v })}
        />
        <SettingRow
          label="コンパクト表示"
          desc="余白を詰めて、より多くのメッセージを表示します"
          checked={prefs.chat_compact}
          onChange={(v) => save({ chat_compact: v })}
        />
        <SettingRow
          label="送信時刻を表示"
          desc="各メッセージの横に時刻を表示します"
          checked={prefs.chat_show_time}
          onChange={(v) => save({ chat_show_time: v })}
        />
        <SettingRow
          label="送信音"
          desc="メッセージを送ったときに短い効果音を鳴らします"
          checked={prefs.chat_send_sound}
          onChange={(v) => save({ chat_send_sound: v })}
        />
        <div className="space-y-2">
          <Label>吹き出しの文字サイズ: {Math.round(prefs.chat_font_scale * 100)}%</Label>
          <Slider
            value={[prefs.chat_font_scale]}
            min={0.85}
            max={1.4}
            step={0.05}
            onValueChange={([v]) => save({ chat_font_scale: v })}
          />
        </div>
      </Card>
    </div>
  );
}
