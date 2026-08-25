import { useAuth } from "@/lib/auth-context";
import { useUserPrefs } from "@/lib/user-prefs";
import { Card } from "@/components/ui/card";
import { SectionHeading, SettingRow } from "./shared";

export function PrivacySection() {
  const { isAdmin } = useAuth();
  const { prefs, save } = useUserPrefs();
  return (
    <div className="space-y-6">
      <SectionHeading title="プライバシー" desc="権限やデータの取り扱いに関する設定です" />
      <Card className="p-6 space-y-3 text-sm text-muted-foreground">
        学習記録やチャット内容はあなた専用のデータとして保護されており、他のユーザーに公開されることはありません。
        データのエクスポートやアカウント削除は「データ」「危険な操作」から行えます。
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
