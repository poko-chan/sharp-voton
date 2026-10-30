import { useCallback, useEffect, useState } from "react";
import {
  ListTodo,
  CalendarDays,
  ClipboardList,
  Brain,
  Video,
  GraduationCap,
  StickyNote,
  NotebookPen,
  Users,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type MarketAccess = {
  /** 表示される場所 */
  display: string[];
  /** 通知・端末権限など */
  notifications: string[];
  /** アクセスするデータ */
  data: string[];
};

export type MarketApp = {
  id: string;
  route: string;
  name: string;
  subtitle: string;
  category: "学習・演習" | "記録・管理" | "交流";
  developer: string;
  verified: boolean;
  version: string;
  updatedAt: string;
  icon: LucideIcon;
  description: string;
  highlights: string[];
  integrations: string[];
  access: MarketAccess;
  /** 準備中（インストールは可能） */
  preparing?: boolean;
};

export const OFFICIAL_DEVELOPER = "Study# 管理者";

const base = { developer: OFFICIAL_DEVELOPER, verified: true, version: "1.0.0", updatedAt: "2026-10-30" };

/** マーケットからインストールして使うアプリ。ここに無い機能は標準機能（常に利用可）。 */
export const MARKET_APPS: MarketApp[] = [
  {
    ...base,
    id: "todo",
    route: "/todo",
    name: "ToDoリスト",
    subtitle: "勉強を後回しにしない、学習直結型タスク管理",
    category: "記録・管理",
    updatedAt: "2026-10-29",
    icon: ListTodo,
    description:
      "「何をやるか」を決めておくだけで、勉強は驚くほど始めやすくなります。教科・目安時間・期日・優先度を付けて学習タスクを整理し、ワンタップでタイマー計測を始められる Study# 公式のタスク管理アプリです。",
    highlights: [
      "教科・目安時間・期日・優先度・メモ付きでタスクを登録",
      "「今日」「期限切れ」「近日」「完了済み」で自動整理",
      "▶ ボタンでタスク名と教科を引き継いでタイマー開始",
      "完了時に勉強記録へワンタップ登録",
    ],
    integrations: ["タイマー", "勉強記録", "教科設定"],
    access: {
      display: ["サイドバー"],
      notifications: ["通知は送りません"],
      data: ["ToDoタスク", "教科設定（読み取り）", "勉強記録（完了時に追加）"],
    },
  },
  {
    ...base,
    id: "calendar",
    route: "/calendar",
    name: "カレンダー",
    subtitle: "予定と勉強計画をひとつのカレンダーで",
    category: "記録・管理",
    icon: CalendarDays,
    description:
      "学校の予定や勉強の計画を月・週・日で管理できるカレンダーです。当日の予定はお知らせで知らせてくれるので、やるべきことを忘れません。",
    highlights: ["予定・勉強計画の登録", "勉強計画の完了チェック", "当日の予定をお知らせ"],
    integrations: ["通知", "勉強記録"],
    access: {
      display: ["サイドバー"],
      notifications: ["当日の予定・勉強計画のお知らせ（アプリを開いたとき1日1回）"],
      data: ["カレンダーの予定", "勉強計画"],
    },
  },
  {
    ...base,
    id: "exams",
    route: "/exams",
    name: "試験",
    subtitle: "定期テスト・模試の日程と結果をまとめて管理",
    category: "記録・管理",
    icon: ClipboardList,
    description:
      "試験の日程・科目・目標点・結果を記録し、本番までのカウントダウンを表示します。結果を残すことで、次の試験に向けた振り返りができます。",
    highlights: ["試験日程と科目の登録", "目標点と結果の記録", "シリーズ（模試など）でまとめて管理"],
    integrations: ["ダッシュボード"],
    access: {
      display: ["サイドバー", "ダッシュボード（直近の試験・おすすめ行動）"],
      notifications: ["通知は送りません"],
      data: ["試験の日程・科目・点数"],
    },
  },
  {
    ...base,
    id: "flashcards",
    route: "/flashcards",
    name: "暗記カード",
    subtitle: "忘れる前に復習する、暗記カード",
    category: "学習・演習",
    icon: Brain,
    description: "単語や用語をカードにして、覚えたかどうかで次の復習タイミングを自動で決める暗記アプリです。",
    highlights: ["デッキごとにカードを作成", "覚えた度合いで復習日を自動調整"],
    integrations: ["ダッシュボード"],
    access: {
      display: ["サイドバー", "ダッシュボード（ショートカット）"],
      notifications: ["通知は送りません"],
      data: ["暗記カード・デッキ", "復習の履歴"],
    },
  },
  {
    ...base,
    id: "meetings",
    route: "/meetings",
    name: "会議",
    subtitle: "画面共有もできるオンライン勉強会",
    category: "交流",
    icon: Video,
    description: "会議コードで集まって、カメラ・マイク・画面共有を使いながら一緒に勉強や話し合いができます。",
    highlights: ["画面共有中もカメラ表示", "ギャラリー/スピーカー表示", "会議メモ・チャット"],
    integrations: ["チャット"],
    access: {
      display: ["サイドバー"],
      notifications: ["カメラ・マイク・画面共有の許可（使うときだけ）"],
      data: ["会議の情報・参加者", "会議メモ・チャット"],
    },
  },
  {
    ...base,
    id: "classroom",
    route: "/classroom",
    name: "クラスルーム",
    subtitle: "クラスで課題を受け取り、みんなで学ぶ",
    category: "学習・演習",
    icon: GraduationCap,
    description: "先生や仲間とクラスを作り、課題の配布・提出やクラス内の交流ができます。",
    highlights: ["クラスへの参加", "課題の受け取りと提出", "クラスXP"],
    integrations: ["ダッシュボード"],
    access: {
      display: ["サイドバー", "スマホ下部メニュー"],
      notifications: ["クラスからのお知らせ"],
      data: ["参加クラス", "課題・提出物"],
    },
  },
  {
    ...base,
    id: "notes",
    route: "/notes",
    name: "付箋",
    subtitle: "自由に貼ってはがせる付箋ボード",
    category: "記録・管理",
    icon: StickyNote,
    description: "思いついたことを色付きの付箋にして、ボード上に自由に並べられます。",
    highlights: ["5色の付箋", "ドラッグで自由に配置"],
    integrations: [],
    access: {
      display: ["サイドバー"],
      notifications: ["通知は送りません"],
      data: ["付箋の内容・位置"],
    },
  },
  {
    ...base,
    id: "notebooks",
    route: "/notebooks",
    name: "メモ（Voton Cnote）",
    subtitle: "ペンで書ける手書きノート",
    category: "学習・演習",
    icon: NotebookPen,
    description: "ペンや指で手書きできるノートです。バケツ塗り・なげなわ・図形補正などのツールが使えます。",
    highlights: ["ペン消しゴム対応", "指で移動・ピンチで拡大", "ページ管理"],
    integrations: [],
    access: {
      display: ["サイドバー"],
      notifications: ["通知は送りません"],
      data: ["ノート・ページ・手書きデータ"],
    },
  },
  {
    ...base,
    id: "feed",
    route: "/feed",
    name: "タイムライン",
    subtitle: "みんなの勉強をのぞいて、やる気アップ",
    category: "交流",
    icon: Users,
    description: "フレンドやみんなの勉強の記録が流れるタイムラインです。リアクションで応援し合えます。",
    highlights: ["みんなの勉強記録", "リアクション・コメント"],
    integrations: ["勉強記録", "フレンド"],
    access: {
      display: ["サイドバー"],
      notifications: ["リアクション・コメントのお知らせ"],
      data: ["公開した勉強記録", "フレンドの公開記録"],
    },
  },
  {
    ...base,
    id: "ai-chat",
    route: "/ai-chat",
    name: "AIチャット",
    subtitle: "勉強の質問に答えるAI（準備中）",
    category: "学習・演習",
    version: "0.9.0",
    icon: Sparkles,
    preparing: true,
    description: "勉強の質問にAIが答えるチャットです。現在準備中のため、インストールはできますがまだ使えません。",
    highlights: ["公開時期は未定です"],
    integrations: [],
    access: {
      display: ["サイドバー"],
      notifications: ["通知は送りません"],
      data: ["AIとの会話履歴（公開後）"],
    },
  },
];

export const MARKET_ROUTES = new Set(MARKET_APPS.map((a) => a.route));

export function findMarketAppByPath(path: string) {
  return MARKET_APPS.find((a) => path === a.route || path.startsWith(a.route + "/"));
}

const EVENT = "market-apps-changed";

export function useInstalledApps() {
  const { user } = useAuth();
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_installed_apps")
      .select("app_id")
      .eq("user_id", user.id);
    setInstalled(new Set((data ?? []).map((r) => r.app_id)));
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    void load();
    const h = () => void load();
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, [load]);

  const install = async (id: string) => {
    if (!user) return;
    await supabase.from("user_installed_apps").upsert({ user_id: user.id, app_id: id });
    window.dispatchEvent(new Event(EVENT));
  };
  const uninstall = async (id: string) => {
    if (!user) return;
    await supabase.from("user_installed_apps").delete().eq("user_id", user.id).eq("app_id", id);
    window.dispatchEvent(new Event(EVENT));
  };

  return { installed, loaded, install, uninstall };
}

/** 指定アプリがインストール済みか（パスで判定）。マーケット対象外は常に true */
export function isPathInstalled(path: string, installed: Set<string>) {
  const app = findMarketAppByPath(path);
  return !app || installed.has(app.id);
}
