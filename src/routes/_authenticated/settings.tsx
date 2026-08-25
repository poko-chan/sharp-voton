import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, User, Palette, Bell, BookOpen, Shield, Sparkles, Languages, Accessibility, Database, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SettingsNav } from "@/components/settings/SettingsNav";
import type { SettingsCategory, SettingsCategoryId } from "@/components/settings/types";
import { matchesKeyword } from "@/components/settings/types";
import { AccountSection } from "@/components/settings/AccountSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { NotificationsSection } from "@/components/settings/NotificationsSection";
import { StudySection } from "@/components/settings/StudySection";
import { PrivacySection } from "@/components/settings/PrivacySection";
import { AiSection } from "@/components/settings/AiSection";
import { LanguageSection } from "@/components/settings/LanguageSection";
import { AccessibilitySection } from "@/components/settings/AccessibilitySection";
import { DataSection } from "@/components/settings/DataSection";
import { DangerSection } from "@/components/settings/DangerSection";

const CATEGORIES: SettingsCategory[] = [
  { id: "account", label: "アカウント・プロフィール", icon: User, keywords: ["アカウント", "プロフィール", "表示名", "アイコン", "メール", "ユーザー名", "account", "profile"] },
  { id: "appearance", label: "外観・テーマ", icon: Palette, keywords: ["外観", "テーマ", "配色", "ダークモード", "フォント", "文字サイズ", "コンパクト", "ダッシュボード", "theme"] },
  { id: "notifications", label: "通知", icon: Bell, keywords: ["通知", "リマインダー", "お知らせ", "チャット", "ストリーク", "notification"] },
  { id: "study", label: "学習", icon: BookOpen, keywords: ["学習", "勉強", "タイマー", "教科", "休憩", "週の開始", "効果音", "目標", "study", "timer"] },
  { id: "privacy", label: "プライバシー", icon: Shield, keywords: ["プライバシー", "公開", "フレンド", "非公開", "privacy"] },
  { id: "ai", label: "AI", icon: Sparkles, keywords: ["AI", "モデル", "端末内", "webllm", "gemini", "nano", "ダウンロード", "容量"] },
  { id: "language", label: "言語・翻訳", icon: Languages, keywords: ["言語", "翻訳", "language", "translate", "日本語", "english"] },
  { id: "accessibility", label: "アクセシビリティ", icon: Accessibility, keywords: ["アクセシビリティ", "読み上げ", "動きを減らす", "コントラスト", "accessibility"] },
  { id: "data", label: "データ", icon: Database, keywords: ["データ", "エクスポート", "バックアップ", "キャッシュ", "data", "export"] },
  { id: "danger", label: "危険な操作", icon: AlertTriangle, keywords: ["削除", "退会", "リセット", "ログアウト", "danger", "delete"], danger: true },
];

const SECTIONS: Record<SettingsCategoryId, React.ComponentType> = {
  account: AccountSection,
  appearance: AppearanceSection,
  notifications: NotificationsSection,
  study: StudySection,
  privacy: PrivacySection,
  ai: AiSection,
  language: LanguageSection,
  accessibility: AccessibilitySection,
  data: DataSection,
  danger: DangerSection,
};

function UserSettingsPage() {
  const [term, setTerm] = useState("");
  const [active, setActive] = useState<SettingsCategoryId>("account");

  const visible = useMemo(
    () => CATEGORIES.filter((c) => matchesKeyword(term, c.label, ...c.keywords)),
    [term],
  );

  const searching = term.trim().length > 0;
  const shown = searching ? visible : CATEGORIES.filter((c) => c.id === active);

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 space-y-4">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">設定</h1>
          <p className="text-sm text-muted-foreground">アカウント・表示・通知・学習など、アプリの動作をカスタマイズできます。</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="設定を検索（例: 通知、テーマ、タイマー）"
            className="pl-9"
          />
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-6">
        {!searching && (
          <SettingsNav categories={CATEGORIES} active={active} onSelect={setActive} />
        )}

        <div className="flex-1 min-w-0 space-y-6">
          {shown.length === 0 && (
            <p className="text-sm text-muted-foreground py-10 text-center">
              「{term}」に一致する設定は見つかりませんでした。
            </p>
          )}
          {shown.map((c) => {
            const Section = SECTIONS[c.id];
            const Icon = c.icon;
            return (
              <section key={c.id} className="space-y-3">
                {searching && (
                  <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    {c.label}
                  </h2>
                )}
                <Section />
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "設定｜Study#" },
      { name: "description", content: "アカウント・表示・通知・学習・AI・プライバシーなど、Study# の各種設定を管理します。" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: UserSettingsPage,
});
