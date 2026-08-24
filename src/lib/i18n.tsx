import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ja" | "en";
const LS_KEY = "studyplus.lang";

const dict = {
  ja: {
    "nav.dashboard": "ダッシュボード",
    "nav.study": "勉強記録",
    "nav.timer": "タイマー",
    "nav.calendar": "カレンダー",
    "nav.goals": "学習目標",
    "nav.heatmap": "ヒートマップ",
    "nav.flashcards": "暗記カード",
    "nav.friends": "フレンド",
    "nav.polls": "投票",
    "nav.questions": "問題生成",
    "nav.practice": "苦手演習",
    "nav.tutor": "AI家庭教師",
    "nav.classroom": "Voton Classroom",
    "nav.chat": "ユーザーチャット",
    "nav.classchat": "クラスチャット",
    "nav.notes": "付箋メモ",
    "nav.announcements": "お知らせ",
    "nav.notifications": "通知",
    "nav.share": "共有・出力",
    "nav.settings": "ユーザー設定",
    "nav.admin": "管理者ツール",
    "nav.logout": "ログアウト",

    "common.loading": "読み込み中…",
    "common.save": "保存",
    "common.cancel": "キャンセル",
    "common.delete": "削除",
    "common.edit": "編集",
    "common.close": "閉じる",
    "common.more": "その他",
    "common.restricted": "利用停止中",
    "common.menu": "メニュー",
    "common.logout": "ログアウト",

    "settings.language": "表示言語",
    "settings.language.desc": "アプリの表示言語を切り替えます（再読み込み不要）",
    "lang.ja": "日本語",
    "lang.en": "English",

    "settings.title": "ユーザー設定",
    "settings.profile": "プロフィール",
    "settings.displayName": "表示名",
    "settings.changeIcon": "アイコンを変更",
    "settings.uploading": "アップロード中…",
    "settings.saveProfile": "プロフィールを保存",
    "settings.notifications": "通知設定",
    "settings.dailyReminder": "毎日の学習リマインダー",
    "settings.dailyReminderDesc": "設定した時刻にブラウザ通知でお知らせします",
    "settings.reminderTime": "リマインダー時刻",
    "settings.chatNotif": "チャット通知",
    "settings.chatNotifDesc": "新しいメッセージで通知",
    "settings.announcementNotif": "お知らせ通知",
    "settings.announcementNotifDesc": "管理者からのお知らせを受け取る",
    "settings.streakNotif": "連続学習の途切れ警告",
    "settings.streakNotifDesc": "streakが途切れそうな時にお知らせ",
    "settings.enableBrowserNotif": "ブラウザ通知を有効化",
    "settings.notifPermissionNeeded": "リマインダーにはブラウザ通知の許可が必要です",
    "settings.customization": "画面カスタマイズ",
    "settings.font": "フォント（Google Fonts）",
    "settings.fontDesc": "アプリ全体のフォントを変更します。選択時に Google Fonts から動的に読み込みます。",
    "settings.themeColor": "テーマカラー",
    "settings.themeColorDesc": "アプリ全体のアクセントカラーを変更します。",
    "settings.rightDock": "右下のフローティング機能",
    "settings.support": "サポート/フィードバック",
    "settings.ambient": "環境音 (タイマーのみ)",
    "settings.ambientNote": "※ 環境音ボタンはタイマー画面のみで表示されます。",
    "settings.sidebarItems": "左メニューに表示する項目",
    "settings.sidebarItemsDesc": "OFFにした項目は「その他」メニューから引き続きアクセスできます。",
    "settings.actAsAdmin": "管理者として実行",
    "settings.actAsAdminDesc": "ON にすると、利用停止サービスを管理者として閲覧・操作できます。OFFでは一般ユーザーと同じ制限を受けます。",
    "settings.themeSection": "テーマカラー",
    "settings.themeSectionDesc": "アプリの配色をお好みに切り替えできます",
    "settings.dataExport": "データ出力",
    "settings.dataExportDesc": "勉強記録や予定を外部にエクスポート。",
    "settings.currentPlan": "現在のプラン",
    "settings.invite": "友達を招待 (+10コイン)",
    "settings.dangerZone": "アカウント削除",

    "login.title": "ログイン",
    "login.signup": "新規登録",
    "login.startWith": "してはじめましょう",
    "login.username": "ユーザー名",
    "login.password": "パスワード",
    "login.submitSignin": "ログイン",
    "login.submitSignup": "登録する",
    "login.toSignup": "アカウントを作成する",
    "login.toSignin": "ログインに戻る",
    "login.forgot": "パスワード／メールアドレスを忘れた場合",
    "login.google": "Googleで",
    "login.or": "または",

    "landing.features": "機能",
    "landing.allServices": "全機能",
    "landing.forSchools": "学校・塾の方へ",
    "landing.guide": "使い方",
    "landing.faq": "FAQ",
    "landing.start": "はじめる",
    "landing.dashboard": "ダッシュボードへ",
    "landing.help": "ヘルプ",
    "landing.terms": "利用規約",
    "landing.privacy": "プライバシーポリシー",
  },
  en: {
    "nav.dashboard": "Dashboard",
    "nav.study": "Study Log",
    "nav.timer": "Timer",
    "nav.calendar": "Calendar",
    "nav.goals": "Goals",
    "nav.heatmap": "Heatmap",
    "nav.flashcards": "Flashcards",
    "nav.friends": "Friends",
    "nav.polls": "Polls",
    "nav.questions": "Question Maker",
    "nav.practice": "Practice",
    "nav.tutor": "AI Tutor",
    "nav.classroom": "Voton Classroom",
    "nav.chat": "Chat",
    "nav.classchat": "Class Chat",
    "nav.notes": "Sticky Notes",
    "nav.announcements": "Announcements",
    "nav.notifications": "Notifications",
    "nav.share": "Share & Export",
    "nav.settings": "Settings",
    "nav.admin": "Admin Tools",
    "nav.logout": "Sign out",

    "common.loading": "Loading…",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.close": "Close",
    "common.more": "More",
    "common.restricted": "Restricted",
    "common.menu": "Menu",
    "common.logout": "Sign out",

    "settings.language": "Display Language",
    "settings.language.desc": "Switch the app language (no reload required)",
    "lang.ja": "日本語",
    "lang.en": "English",

    "settings.title": "Settings",
    "settings.profile": "Profile",
    "settings.displayName": "Display name",
    "settings.changeIcon": "Change icon",
    "settings.uploading": "Uploading…",
    "settings.saveProfile": "Save profile",
    "settings.notifications": "Notifications",
    "settings.dailyReminder": "Daily study reminder",
    "settings.dailyReminderDesc": "Sends a browser notification at the set time",
    "settings.reminderTime": "Reminder time",
    "settings.chatNotif": "Chat notifications",
    "settings.chatNotifDesc": "Notify on new messages",
    "settings.announcementNotif": "Announcement notifications",
    "settings.announcementNotifDesc": "Receive announcements from admins",
    "settings.streakNotif": "Streak break warning",
    "settings.streakNotifDesc": "Notify when your streak is about to break",
    "settings.enableBrowserNotif": "Enable browser notifications",
    "settings.notifPermissionNeeded": "Reminders require browser notification permission",
    "settings.customization": "Customization",
    "settings.font": "Font (Google Fonts)",
    "settings.fontDesc": "Change the app's font. Loaded dynamically from Google Fonts when selected.",
    "settings.themeColor": "Theme color",
    "settings.themeColorDesc": "Change the app's accent color.",
    "settings.rightDock": "Bottom-right floating features",
    "settings.support": "Support / Feedback",
    "settings.ambient": "Ambient sound (timer only)",
    "settings.ambientNote": "* The ambient sound button only appears on the timer page.",
    "settings.sidebarItems": "Items shown in the left menu",
    "settings.sidebarItemsDesc": "Items turned OFF remain accessible from the \"More\" menu.",
    "settings.actAsAdmin": "Act as admin",
    "settings.actAsAdminDesc": "When ON, you can view/operate restricted services as an admin. When OFF, you have the same restrictions as a regular user.",
    "settings.themeSection": "Theme color",
    "settings.themeSectionDesc": "Switch the app's color scheme to your liking",
    "settings.dataExport": "Data export",
    "settings.dataExportDesc": "Export your study logs and schedule.",
    "settings.currentPlan": "Current plan",
    "settings.invite": "Invite friends (+10 coins)",
    "settings.dangerZone": "Delete account",

    "login.title": "Sign in",
    "login.signup": "Sign up",
    "login.startWith": " to get started",
    "login.username": "Username",
    "login.password": "Password",
    "login.submitSignin": "Sign in",
    "login.submitSignup": "Sign up",
    "login.toSignup": "Create an account",
    "login.toSignin": "Back to sign in",
    "login.forgot": "Forgot password / email",
    "login.google": "Continue with Google",
    "login.or": "or",

    "landing.features": "Features",
    "landing.allServices": "All Features",
    "landing.forSchools": "For Schools",
    "landing.guide": "Guide",
    "landing.faq": "FAQ",
    "landing.help": "Help",
    "landing.terms": "Terms",
    "landing.privacy": "Privacy Policy",
    "landing.dashboard": "Dashboard",
    "landing.start": "Get Started",
  },
} as const;

type Key = keyof typeof dict.ja;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "ja",
  setLang: () => {},
  t: (k) => dict.ja[k] ?? k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "ja";
    const v = localStorage.getItem(LS_KEY);
    return v === "en" ? "en" : "ja";
  });
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY && (e.newValue === "en" || e.newValue === "ja")) setLangState(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(LS_KEY, l); } catch { /* ignore */ }
  };
  const t = (k: Key) => (dict[lang][k] ?? dict.ja[k] ?? k) as string;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
