import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
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
        title="詳細設定"
        desc="表示・学習・通知・プライバシーを細かく調整できます。設定はこの端末に保存されます。"
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

      <Group title="学習">
        <div className="space-y-2">
          <Label className="text-sm">1日の目標時間: {prefs.daily_goal_minutes}分</Label>
          <Slider
            value={[prefs.daily_goal_minutes]}
            min={10}
            max={600}
            step={10}
            onValueChange={([v]) => set("daily_goal_minutes", v)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">ポモドーロの回数</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={prefs.pomodoro_rounds}
              onChange={(e) => set("pomodoro_rounds", Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">長い休憩（分）</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={prefs.pomodoro_long_break_minutes}
              onChange={(e) => set("pomodoro_long_break_minutes", Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">記録する最短の分数</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={prefs.min_session_minutes}
              onChange={(e) => set("min_session_minutes", Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">復習の間隔（日）</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={prefs.review_reminder_days}
              onChange={(e) => set("review_reminder_days", Number(e.target.value) || 1)}
            />
          </div>
        </div>
        <SettingRow
          label="タイマー終了で自動的に記録"
          checked={prefs.auto_log_timer}
          onChange={(v) => set("auto_log_timer", v)}
        />
        <SettingRow
          label="集中モードを厳しくする"
          desc="集中中は他の画面への移動を確認します。"
          checked={prefs.focus_mode_strict}
          onChange={(v) => set("focus_mode_strict", v)}
        />
        <SettingRow
          label="連続記録が途切れそうなときに知らせる"
          checked={prefs.streak_warning}
          onChange={(v) => set("streak_warning", v)}
        />
      </Group>

      <Group title="通知">
        <SettingRow
          label="おやすみモード"
          desc="指定した時間帯は通知を出しません。"
          checked={prefs.quiet_hours_enabled}
          onChange={(v) => set("quiet_hours_enabled", v)}
        />
        {prefs.quiet_hours_enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">開始</Label>
              <Input
                type="time"
                value={prefs.quiet_start}
                onChange={(e) => set("quiet_start", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">終了</Label>
              <Input
                type="time"
                value={prefs.quiet_end}
                onChange={(e) => set("quiet_end", e.target.value)}
              />
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-sm">通知のまとめ方</Label>
          <Select
            value={prefs.notif_digest}
            onValueChange={(v) => set("notif_digest", v as LocalPrefs["notif_digest"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instant">そのつど届く</SelectItem>
              <SelectItem value="daily">1日1回まとめて</SelectItem>
              <SelectItem value="off">受け取らない</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <SettingRow
          label="応援スタンプの通知"
          checked={prefs.notif_cheers}
          onChange={(v) => set("notif_cheers", v)}
        />
        <SettingRow
          label="勉強ルームへの招待の通知"
          checked={prefs.notif_room_invites}
          onChange={(v) => set("notif_room_invites", v)}
        />
        <SettingRow
          label="週間レポートの通知"
          checked={prefs.notif_weekly_report}
          onChange={(v) => set("notif_weekly_report", v)}
        />
        <SettingRow
          label="目標のリマインド"
          checked={prefs.notif_goal_reminder}
          onChange={(v) => set("notif_goal_reminder", v)}
        />
      </Group>

      <Group title="プライバシー・フレンド">
        <div className="space-y-2">
          <Label className="text-sm">プロフィールの公開範囲</Label>
          <Select
            value={prefs.profile_visibility}
            onValueChange={(v) =>
              set("profile_visibility", v as LocalPrefs["profile_visibility"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">全員に公開</SelectItem>
              <SelectItem value="friends">フレンドのみ</SelectItem>
              <SelectItem value="private">非公開</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm">勉強ルームに招待できる人</Label>
          <Select
            value={prefs.allow_room_invites}
            onValueChange={(v) => set("allow_room_invites", v as LocalPrefs["allow_room_invites"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全員</SelectItem>
              <SelectItem value="friends">フレンドのみ</SelectItem>
              <SelectItem value="none">招待を受け取らない</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <SettingRow
          label="オンライン状態を見せる"
          checked={prefs.show_online_status}
          onChange={(v) => set("show_online_status", v)}
        />
        <SettingRow
          label="勉強時間をフレンドに見せる"
          checked={prefs.show_study_time}
          onChange={(v) => set("show_study_time", v)}
        />
        <SettingRow
          label="フレンド申請を受け取る"
          checked={prefs.allow_friend_requests}
          onChange={(v) => set("allow_friend_requests", v)}
        />
        <SettingRow
          label="応援スタンプを受け取る"
          checked={prefs.allow_cheers}
          onChange={(v) => set("allow_cheers", v)}
        />
        <SettingRow
          label="ランキングに載らない"
          checked={prefs.hide_from_ranking}
          onChange={(v) => set("hide_from_ranking", v)}
        />
      </Group>
    </div>
  );
}
