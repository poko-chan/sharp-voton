import {
  LayoutDashboard, Timer, CalendarDays, BookOpen, Brain, MessagesSquare, Sparkles, Target,
  Settings, Trophy, Megaphone, GraduationCap, StickyNote, Users, HelpCircle, ClipboardList,
  NotebookPen, BellRing, Flame, Building2, ShoppingBag, LineChart, Share2, FileDown, Bot,
  type LucideIcon,
} from "lucide-react";

export type AppEntry = {
  to: string;
  label: string;
  keywords: string;
  icon: LucideIcon;
  group: "学習" | "記録・分析" | "コミュニティ" | "組織" | "その他";
};

/** ランチャー・コマンドパレット・履歴で共有するサービス一覧 */
export const APPS: AppEntry[] = [
  { to: "/parent", label: "保護者ダッシュボード", keywords: "parent 保護者", icon: Users, group: "その他" },
  { to: "/dashboard", label: "ダッシュボード", keywords: "dashboard home ホーム", icon: LayoutDashboard, group: "学習" },
  { to: "/timer", label: "タイマー", keywords: "timer pomodoro ポモドーロ 集中", icon: Timer, group: "学習" },
  { to: "/study", label: "勉強記録", keywords: "study log 記録", icon: BookOpen, group: "記録・分析" },
  { to: "/makron", label: "Makron", keywords: "makron 演習 問題 quiz", icon: Target, group: "学習" },
  { to: "/flashcards", label: "暗記カード", keywords: "flashcard srs 暗記", icon: Brain, group: "学習" },
  { to: "/notebooks", label: "Voton Cnote", keywords: "note ノート 手書き cnote", icon: NotebookPen, group: "学習" },
  { to: "/notes", label: "メモ", keywords: "memo notes 付箋", icon: StickyNote, group: "学習" },
  { to: "/materials", label: "教材データベース", keywords: "materials 教材 参考書", icon: BookOpen, group: "学習" },
  { to: "/exams", label: "試験", keywords: "exam テスト 定期試験", icon: ClipboardList, group: "記録・分析" },
  { to: "/goals", label: "学習目標", keywords: "goal 目標", icon: Trophy, group: "記録・分析" },
  { to: "/calendar", label: "カレンダー", keywords: "calendar 予定 スケジュール", icon: CalendarDays, group: "記録・分析" },
  { to: "/heatmap", label: "ヒートマップ", keywords: "heatmap 継続 grass", icon: Flame, group: "記録・分析" },
  { to: "/mistakes", label: "まちがい直し", keywords: "mistake 復習", icon: LineChart, group: "記録・分析" },
  { to: "/export", label: "データ書き出し", keywords: "export csv バックアップ", icon: FileDown, group: "記録・分析" },
  { to: "/tutor", label: "AIチャット", keywords: "ai tutor chat gpt 質問", icon: Sparkles, group: "学習" },
  { to: "/mentor", label: "メンター", keywords: "mentor 相談", icon: Bot, group: "学習" },
  { to: "/chat", label: "チャット", keywords: "chat dm メッセージ", icon: MessagesSquare, group: "コミュニティ" },
  { to: "/feed", label: "タイムライン", keywords: "feed sns 投稿", icon: Users, group: "コミュニティ" },
  { to: "/friends", label: "フレンド", keywords: "friend フォロー 友達", icon: Users, group: "コミュニティ" },
  { to: "/leaderboard", label: "ランキング", keywords: "ranking leaderboard", icon: Trophy, group: "コミュニティ" },
  { to: "/classroom", label: "クラス", keywords: "classroom 授業 課題", icon: GraduationCap, group: "コミュニティ" },
  { to: "/organizations", label: "組織", keywords: "organization 学校 塾", icon: Building2, group: "組織" },
  { to: "/missions", label: "ミッション", keywords: "mission デイリー クエスト", icon: Target, group: "その他" },
  { to: "/inventory", label: "ショップ・持ち物", keywords: "shop coin アイテム", icon: ShoppingBag, group: "その他" },
  { to: "/share", label: "共有", keywords: "share 共有リンク", icon: Share2, group: "その他" },
  { to: "/announcements", label: "お知らせ", keywords: "announcement 運営", icon: Megaphone, group: "その他" },
  { to: "/notifications", label: "通知", keywords: "notification 通知", icon: BellRing, group: "その他" },
  { to: "/settings", label: "設定", keywords: "settings 設定 アカウント", icon: Settings, group: "その他" },
  { to: "/help", label: "ヘルプ", keywords: "help 使い方 サポート", icon: HelpCircle, group: "その他" },
];

const PARENT_APPS = new Set(["/parent", "/settings", "/notifications", "/announcements", "/help"]);
const ORG_APPS = new Set(["/organizations", "/settings", "/notifications", "/announcements", "/help"]);

export function appsForAccount(accountKind?: string | null) {
  if (accountKind === "parent") return APPS.filter((app) => PARENT_APPS.has(app.to));
  if (accountKind === "org") return APPS.filter((app) => ORG_APPS.has(app.to));
  return APPS.filter((app) => app.to !== "/parent");
}

export function findApp(path: string): AppEntry | undefined {
  return APPS.filter((a) => path === a.to || path.startsWith(a.to + "/"))
    .sort((a, b) => b.to.length - a.to.length)[0];
}
