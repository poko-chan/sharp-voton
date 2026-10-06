import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalPrefs } from "@/lib/user-prefs";
import { useOrderedSubjects } from "@/lib/subjects";
import { SectionHeading, SettingRow } from "./shared";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function StudySection() {
  return (
    <div className="space-y-6">
      <SectionHeading title="学習" desc="学習の初期設定やタイマーを管理します" />
      <StudyPrefsPanel />
    </div>
  );
}

function StudyPrefsPanel() {
  const { prefs, save } = useLocalPrefs();
  const { subjects } = useOrderedSubjects();
  return (
    <Card className="p-6 space-y-5">
      <div className="font-semibold">学習の初期設定（この端末のみ）</div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>週の開始曜日</Label>
          <Select
            value={String(prefs.week_start_day)}
            onValueChange={(v) => save({ week_start_day: Number(v) as 0 | 1 })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{WEEKDAYS[0]}曜日</SelectItem>
              <SelectItem value="1">{WEEKDAYS[1]}曜日</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>既定の学習教科</Label>
          <Select
            value={prefs.default_subject_id ?? "none"}
            onValueChange={(v) => save({ default_subject_id: v === "none" ? null : v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">指定なし</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>タイマーの既定時間（分）</Label>
          <Input
            type="number"
            min={1}
            max={180}
            value={prefs.timer_default_minutes}
            onChange={(e) =>
              save({
                timer_default_minutes: Math.max(1, Math.min(180, Number(e.target.value) || 1)),
              })
            }
          />
        </div>
        <div className="space-y-1">
          <Label>自動休憩の長さ（分）</Label>
          <Input
            type="number"
            min={1}
            max={60}
            value={prefs.timer_break_minutes}
            onChange={(e) =>
              save({ timer_break_minutes: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })
            }
            disabled={!prefs.timer_auto_break}
          />
        </div>
        <div className="space-y-1">
          <Label>一覧の既定表示件数</Label>
          <Select
            value={String(prefs.list_page_size)}
            onValueChange={(v) => save({ list_page_size: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}件
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <SettingRow
        label="タイマー終了後に自動で休憩を開始する"
        desc="学習タイマーが終わったら自動的に休憩タイマーを開始します"
        checked={prefs.timer_auto_break}
        onChange={(v) => save({ timer_auto_break: v })}
      />
    </Card>
  );
}
