import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingRow, SectionHeading } from "./shared";
import { useLocalPrefs, type LocalPrefs } from "@/lib/user-prefs";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <h3 className="text-sm font-bold">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

export function AdvancedSection() {
  const { prefs, save } = useLocalPrefs();
  const set = <K extends keyof LocalPrefs>(k: K, v: LocalPrefs[K]) => save({ [k]: v } as any);

  return (
    <div className="space-y-4">
      <SectionHeading
        title="操作・表示"
        desc="画面の操作や表示に関する設定です。この端末に保存されます。"
      />

      <Group title="表示・操作">
        <div className="space-y-2">
          <Label className="text-sm">ログイン後に最初に開く画面</Label>
          <Select
            value={prefs.home_start_page}
            onValueChange={(v) => set("home_start_page", v as LocalPrefs["home_start_page"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dashboard">ダッシュボード</SelectItem>
              <SelectItem value="study">勉強記録</SelectItem>
              <SelectItem value="timer">タイマー</SelectItem>
              <SelectItem value="makron">Makron</SelectItem>
              <SelectItem value="chat">チャット</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <SettingRow
          label="ヘッダーを固定"
          desc="スクロールしても上部のバーを表示し続けます。"
          checked={prefs.sticky_header}
          onChange={(v) => set("sticky_header", v)}
        />
        <SettingRow
          label="カードに影をつける"
          checked={prefs.card_shadows}
          onChange={(v) => set("card_shadows", v)}
        />
        <SettingRow
          label="教科を色分けして表示"
          checked={prefs.colorful_subjects}
          onChange={(v) => set("colorful_subjects", v)}
        />
        <SettingRow
          label="ヒントを表示"
          desc="各画面の使い方の吹き出しを表示します。"
          checked={prefs.show_tips}
          onChange={(v) => set("show_tips", v)}
        />
        <SettingRow
          label="削除の前に確認する"
          checked={prefs.confirm_before_delete}
          onChange={(v) => set("confirm_before_delete", v)}
        />
        <SettingRow
          label="キーボードショートカット"
          desc="Ctrl（⌘）+ K でコマンドパレットを開けます。"
          checked={prefs.keyboard_shortcuts}
          onChange={(v) => set("keyboard_shortcuts", v)}
        />
        <SettingRow
          label="クイック操作ボタン"
          checked={prefs.quick_actions}
          onChange={(v) => set("quick_actions", v)}
        />
        <SettingRow
          label="勉強時間を「時間」で表示"
          desc="90分 → 1時間30分 のように表示します。"
          checked={prefs.number_format_hours}
          onChange={(v) => set("number_format_hours", v)}
        />
      </Group>
    </div>
  );
}
