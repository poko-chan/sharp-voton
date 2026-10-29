import { useCallback, useEffect, useState } from "react";
import { ListTodo, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

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
};

export const OFFICIAL_DEVELOPER = "Study# 管理者";

/** マーケットからインストールして使うアプリ。ここに無い機能は標準機能（常に利用可）。 */
export const MARKET_APPS: MarketApp[] = [
  {
    id: "todo",
    route: "/todo",
    name: "ToDoリスト",
    subtitle: "勉強を後回しにしない、学習直結型タスク管理",
    category: "記録・管理",
    developer: OFFICIAL_DEVELOPER,
    verified: true,
    version: "1.0.0",
    updatedAt: "2026-10-29",
    icon: ListTodo,
    description:
      "「何をやるか」を決めておくだけで、勉強は驚くほど始めやすくなります。ToDoリストは、教科・目安時間・期日・優先度を付けて学習タスクを整理し、ワンタップでタイマー計測を始められる Study# 公式のタスク管理アプリです。完了したタスクはそのまま勉強記録に残せるので、計画→実行→記録の流れが途切れません。",
    highlights: [
      "教科・目安時間・期日・優先度・メモ付きでタスクを登録",
      "「今日」「期限切れ」「近日」「完了済み」で自動整理",
      "▶ ボタンでタスク名と教科を引き継いでタイマー開始",
      "完了時に目安時間で勉強記録へワンタップ登録",
      "今日の達成率をひと目で確認",
    ],
    integrations: ["タイマー", "勉強記録", "教科設定"],
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
