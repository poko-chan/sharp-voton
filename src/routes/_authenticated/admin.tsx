import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Shield, Megaphone, ShoppingBag, Building2, Ticket, Coins } from "lucide-react";
import { UsersTab } from "@/components/admin/users";
import { RestrictionsHub } from "@/components/admin/restrictions";
import { AnnouncementsTab, FaqTab, LoginBoardsTab } from "@/components/admin/content";
import { CoinGrantAllTab, NavConfigTab, MaintenanceTab, VersionTab } from "@/components/admin/system";
import { FeedbackTab } from "@/components/admin/feedback";
import { ShopAdminTab, RedemptionsTab, OrgsAdminTab } from "@/components/admin/commerce";

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: (s: Record<string, unknown>) => ({ tab: (s.tab as string) || "users" }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/admin" });
  useEffect(() => { if (!loading && !isAdmin) navigate({ to: "/dashboard" }); }, [isAdmin, loading]);
  if (!isAdmin) return null;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-7 w-7" />
        <h1 className="text-3xl font-bold">管理者ダッシュボード</h1>
      </div>
      <Tabs value={search.tab} onValueChange={(v) => navigate({ to: "/admin", search: { tab: v } as any })}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="users">ユーザー管理</TabsTrigger>
          <TabsTrigger value="maintenance">メンテナンス</TabsTrigger>
          <TabsTrigger value="restrictions" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-600">利用停止</TabsTrigger>
          <TabsTrigger value="shop"><ShoppingBag className="h-3 w-3 mr-1" />ショップ</TabsTrigger>
          <TabsTrigger value="redemptions"><Ticket className="h-3 w-3 mr-1" />引換</TabsTrigger>
          <TabsTrigger value="orgs"><Building2 className="h-3 w-3 mr-1" />組織</TabsTrigger>
          <TabsTrigger value="faq" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600">FAQ</TabsTrigger>
          <TabsTrigger value="nav">サイドバー設定</TabsTrigger>
          <TabsTrigger value="version">バージョン</TabsTrigger>
          <TabsTrigger value="announcements">お知らせ</TabsTrigger>
          <TabsTrigger value="feedback">フィードバック</TabsTrigger>
          <TabsTrigger value="coingrant"><Coins className="h-3 w-3 mr-1" />コイン一括配布</TabsTrigger>
          <TabsTrigger value="boards"><Megaphone className="h-3 w-3 mr-1" />ログイン掲示板</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="maintenance"><MaintenanceTab /></TabsContent>
        <TabsContent value="restrictions"><RestrictionsHub /></TabsContent>
        <TabsContent value="shop"><ShopAdminTab /></TabsContent>
        <TabsContent value="redemptions"><RedemptionsTab /></TabsContent>
        <TabsContent value="orgs"><OrgsAdminTab /></TabsContent>
        <TabsContent value="faq"><FaqTab /></TabsContent>
        <TabsContent value="nav"><NavConfigTab /></TabsContent>
        <TabsContent value="version"><VersionTab /></TabsContent>
        <TabsContent value="announcements"><AnnouncementsTab /></TabsContent>
        <TabsContent value="feedback"><FeedbackTab /></TabsContent>
        <TabsContent value="coingrant"><CoinGrantAllTab /></TabsContent>
        <TabsContent value="boards"><LoginBoardsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
