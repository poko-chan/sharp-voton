import { useAuth } from "@/lib/auth-context";
import { useLocalPrefs, useUserPrefs } from "@/lib/user-prefs";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionHeading, SettingRow } from "./shared";

export function PrivacySection() {
  const { isAdmin } = useAuth();
  const { prefs, save } = useUserPrefs();
  const { prefs: localPrefs, save: saveLocal } = useLocalPrefs();
  return (
    <div className="space-y-6">
      <SectionHeading
        title="プライバシー"
        desc="プロフィールの公開範囲とフレンド機能を管理します"
      />
      <Card className="p-6 space-y-3 text-sm text-muted-foreground">
        プロフィールの公開範囲や学習記録の表示は「アカウント・プロフィール」から設定できます。
      </Card>
      <Card className="p-6 space-y-5">
        <div className="font-semibold">フレンド・招待</div>
        <div className="space-y-2">
          <Label className="text-sm">勉強ルームに招待できる人</Label>
          <Select
            value={localPrefs.allow_room_invites}
            onValueChange={(v) =>
              saveLocal({ allow_room_invites: v as typeof localPrefs.allow_room_invites })
            }
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
          label="フレンド申請を受け取る"
          checked={localPrefs.allow_friend_requests}
          onChange={(v) => saveLocal({ allow_friend_requests: v })}
        />
        <SettingRow
          label="応援スタンプを受け取る"
          checked={localPrefs.allow_cheers}
          onChange={(v) => saveLocal({ allow_cheers: v })}
        />
        <SettingRow
          label="ランキングに載らない"
          checked={localPrefs.hide_from_ranking}
          onChange={(v) => saveLocal({ hide_from_ranking: v })}
        />
      </Card>
      {isAdmin && (
        <Card className="p-6 space-y-1 border-warning/40 bg-warning/5">
          <SettingRow
            label="管理者として実行"
            desc="ONにすると、利用停止サービスを管理者として閲覧・操作できます。OFFでは一般ユーザーと同じ制限を受けます。"
            checked={prefs.act_as_admin}
            onChange={(v) => save({ act_as_admin: v })}
          />
        </Card>
      )}
    </div>
  );
}
