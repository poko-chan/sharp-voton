import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocalPrefs, type LocalPrefs } from "@/lib/user-prefs";
import { SectionHeading, SettingRow } from "./shared";

const TABS: { value: LocalPrefs["town_default_tab"]; label: string }[] = [
  { value: "economy", label: "経済" },
  { value: "policy", label: "政策" },
  { value: "build", label: "建設" },
  { value: "map", label: "地図" },
  { value: "info", label: "情報" },
];

export function TownSection() {
  const { prefs, save } = useLocalPrefs();
  return (
    <div className="space-y-6">
      <SectionHeading title="街" desc="ダッシュボードの街の表示を調整します（この端末のみ）" />
      <Card className="p-6 space-y-5">
        <SettingRow
          label="3Dの自動回転"
          desc="街をゆっくり回転させます。動きが気になる場合はオフに。"
          checked={prefs.town_auto_rotate}
          onChange={(v) => save({ town_auto_rotate: v })}
        />
        <SettingRow
          label="建物のラベルを表示"
          desc="選択中の区画に建物名を表示します"
          checked={prefs.town_show_labels}
          onChange={(v) => save({ town_show_labels: v })}
        />
        <div className="space-y-1">
          <Label>最初に開くタブ</Label>
          <Select
            value={prefs.town_default_tab}
            onValueChange={(v) => save({ town_default_tab: v as LocalPrefs["town_default_tab"] })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TABS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>
    </div>
  );
}
