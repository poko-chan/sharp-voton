import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  BellRing,
  BookOpen,
  Building2,
  Coins,
  ExternalLink,
  FileText,
  Flag,
  HelpCircle,
  Megaphone,
  Settings,
  Shield,
  Users,
  Wrench,
} from "lucide-react";
import { UsersTab } from "@/components/admin/users";
import { RestrictionsHub } from "@/components/admin/restrictions";
import { AnnouncementsTab, FaqTab, LoginBoardsTab } from "@/components/admin/content";
import { CoinGrantAllTab, MaintenanceTab, VersionTab } from "@/components/admin/system";
import { FeedbackTab } from "@/components/admin/feedback";
import { OrgsAdminTab } from "@/components/admin/commerce";
import { MaterialsReviewTab } from "@/components/admin/materials";
import { NotificationsAdminTab } from "@/components/admin/notifications";

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: (s: Record<string, unknown>) => ({ tab: (s.tab as string) || undefined }),
  component: AdminPage,
});

type AdminTab =
  | "users"
  | "maintenance"
  | "restrictions"
  | "orgs"
  | "materials"
  | "faq"
  | "version"
  | "announcements"
  | "feedback"
  | "coingrant"
  | "boards"
  | "notifications";

type AdminItem = {
  tab: AdminTab;
  label: string;
  description: string;
  icon: typeof Users;
};

const groups: { title: string; items: AdminItem[] }[] = [
  {
    title: "ユーザーとアクセス",
    items: [
      { tab: "users", label: "ユーザー管理", description: "アカウント、権限、利用停止", icon: Users },
      { tab: "restrictions", label: "利用制限", description: "機能やサービスの公開範囲", icon: Flag },
      { tab: "orgs", label: "組織管理", description: "学校・組織の申請と設定", icon: Building2 },
    ],
  },
  {
    title: "コンテンツと連絡",
    items: [
      { tab: "notifications", label: "通知を送る", description: "全員または個別ユーザーへ通知", icon: BellRing },
      { tab: "announcements", label: "お知らせ", description: "公開日時つきのお知らせを作成", icon: Megaphone },
      { tab: "feedback", label: "フィードバック", description: "要望や問い合わせに返信", icon: HelpCircle },
      { tab: "faq", label: "FAQ", description: "よくある質問を管理", icon: FileText },
      { tab: "boards", label: "ログイン掲示板", description: "ログイン前に表示する掲示板", icon: Megaphone },
      { tab: "materials", label: "教材承認", description: "投稿された教材を確認", icon: BookOpen },
    ],
  },
  {
    title: "システム",
    items: [
      { tab: "maintenance", label: "メンテナンス", description: "停止状態と案内文を設定", icon: Wrench },
      { tab: "version", label: "バージョン", description: "アプリのバージョン情報", icon: Settings },
      { tab: "coingrant", label: "コイン一括配布", description: "全ユーザーへコインを付与", icon: Coins },
    ],
  },
];

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/admin" });
  const tab = search.tab as AdminTab | undefined;

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [isAdmin, loading, navigate]);

  if (!isAdmin) return null;
  if (!tab) return <AdminOverview onSelect={(next) => navigate({ to: "/admin", search: { tab: next } })} />;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6 md:p-8">
      <Button variant="ghost" className="-ml-3" onClick={() => navigate({ to: "/admin" })}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        管理機能一覧
      </Button>
      {renderTab(tab)}
    </div>
  );
}

function AdminOverview({ onSelect }: { onSelect: (tab: AdminTab) => void }) {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-warning/20 text-warning-foreground">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">管理者専用</p>
          <h1 className="text-3xl font-bold tracking-tight">管理者ダッシュボード</h1>
          <p className="mt-1 text-sm text-muted-foreground">目的の管理機能を選択してください。</p>
        </div>
      </div>
      {groups.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{group.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.tab}
                  role="button"
                  tabIndex={0}
                  className="group cursor-pointer p-5 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                  onClick={() => onSelect(item.tab)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onSelect(item.tab);
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{item.label}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function renderTab(tab: AdminTab) {
  switch (tab) {
    case "users": return <UsersTab />;
    case "maintenance": return <MaintenanceTab />;
    case "restrictions": return <RestrictionsHub />;
    case "orgs": return <OrgsAdminTab />;
    case "materials": return <MaterialsReviewTab />;
    case "faq": return <FaqTab />;
    case "version": return <VersionTab />;
    case "announcements": return <AnnouncementsTab />;
    case "feedback": return <FeedbackTab />;
    case "coingrant": return <CoinGrantAllTab />;
    case "boards": return <LoginBoardsTab />;
    case "notifications": return <NotificationsAdminTab />;
  }
}
