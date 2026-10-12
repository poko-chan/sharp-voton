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
    <div className="space-y-6">
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
                save({
                  timer_break_minutes: Math.max(1, Math.min(60, Number(e.target.value) || 1)),
                })
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
      <Card className="p-6 space-y-5">
        <div className="font-semibold">学習目標・記録・集中</div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>1日の目標時間（分）</Label>
            <Input
              type="number"
              min={10}
              max={600}
              step={10}
              value={prefs.daily_goal_minutes}
              onChange={(e) => save({ daily_goal_minutes: Number(e.target.value) || 10 })}
            />
          </div>
          <div className="space-y-1">
            <Label>ポモドーロの回数</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={prefs.pomodoro_rounds}
              onChange={(e) => save({ pomodoro_rounds: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="space-y-1">
            <Label>長い休憩（分）</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={prefs.pomodoro_long_break_minutes}
              onChange={(e) => save({ pomodoro_long_break_minutes: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="space-y-1">
            <Label>記録する最短の分数</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={prefs.min_session_minutes}
              onChange={(e) => save({ min_session_minutes: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="space-y-1">
            <Label>復習の間隔（日）</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={prefs.review_reminder_days}
              onChange={(e) => save({ review_reminder_days: Number(e.target.value) || 1 })}
            />
          </div>
        </div>
        <SettingRow
          label="タイマー終了で自動的に記録"
          checked={prefs.auto_log_timer}
          onChange={(v) => save({ auto_log_timer: v })}
        />
        <SettingRow
          label="集中モードを厳しくする"
          desc="集中中は他の画面への移動を確認します。"
          checked={prefs.focus_mode_strict}
          onChange={(v) => save({ focus_mode_strict: v })}
        />
        <SettingRow
          label="連続記録が途切れそうなときに知らせる"
          checked={prefs.streak_warning}
          onChange={(v) => save({ streak_warning: v })}
        />
      </Card>
    </div>
  );
}
