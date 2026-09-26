import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Megaphone,
  ClipboardList,
  CalendarDays,
  IdCard,
  MessagesSquare,
  BookOpen,
  GraduationCap,
  ListChecks,
  Building2,
  ShieldAlert,
  Users,
  UserPlus,
  Clock,
  Ban,
  LayoutGrid,
  Settings,
  Plus,
  UserCog,
  ClipboardCheck,
  Table,
  BarChart3,
  CalendarClock,
  HeartPulse,
  Eye,
  Copy,
  Wand2,
  ChevronRight,
} from "lucide-react";
import { ORG_APPS, useOrg } from "@/lib/org-apps";
import { ROLE_LABEL } from "@/lib/org-roles";
import { OrgSetupWizard } from "@/components/org/OrgSetupWizard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/organizations/$orgId/")({
  component: OrgHome,
});

const ICONS: Record<string, any> = {
  Bell,
  Megaphone,
  ClipboardList,
  CalendarDays,
  IdCard,
  MessagesSquare,
  BookOpen,
  GraduationCap,
  ClipboardCheck,
  Table,
  BarChart3,
  CalendarClock,
  HeartPulse,
  ShieldAlert,
  Eye,
};

const MANAGE_ITEMS = [
  { section: "members", label: "メンバー管理", icon: UserCog },
  { section: "requests", label: "参加申請", icon: UserPlus },
  { section: "invite", label: "招待", icon: Users },
  { section: "stats", label: "学習統計", icon: Clock },
  { section: "assignments", label: "課題", icon: ClipboardList },
  { section: "content", label: "問題集・クラス", icon: BookOpen },
  { section: "profile-fields", label: "プロフィール項目", icon: ListChecks },
  { section: "roster", label: "名簿（学年・クラス）", icon: Users },
  { section: "restrictions", label: "アプリ制限", icon: Ban },
  { section: "apps", label: "アプリ管理", icon: LayoutGrid },
  { section: "settings", label: "組織設定", icon: Settings },
  { section: "roles", label: "役職・権限", icon: ShieldAlert },
];

function OrgHome() {
  const { orgId } = Route.useParams();
  const {
    org,
    myRole,
    isStaff,
    leadGroups,
    loading,
    appEnabled,
    appLabel,
    canManage,
    manageSections,
    isOwner,
    apps: appRows,
    customRole,
    reload,
  } = useOrg(orgId);
  const canAdmin = isOwner || manageSections.length > 0;
  const [wizard, setWizard] = useState(false);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">読み込み中…</div>;
  if (!myRole && !canAdmin)
    return (
      <div className="p-6 text-sm text-muted-foreground space-y-2">
        <div>この組織に参加していません。</div>
        <Link to="/organizations" className="underline">
          ← 組織一覧へ戻る
        </Link>
      </div>
    );

  const apps = ORG_APPS.filter((a) => appEnabled(a.key));
  const notConfigured = (appRows ?? []).length === 0;
  const manageItems = MANAGE_ITEMS.filter((m) => canManage(m.section));
  const roleName = customRole?.name ?? ROLE_LABEL[myRole ?? ""] ?? "運営";

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-5">
      <Link to="/organizations" className="text-sm underline text-muted-foreground">
        ← 組織一覧へ
      </Link>

      {/* ヘッダー */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/15 to-primary/5 px-5 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/20">
              <Building2 className="h-6 w-6 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold">{org?.name}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span
                  className="rounded-full px-2 py-0.5 font-bold"
                  style={{
                    background: `${customRole?.color ?? "hsl(var(--muted))"}22`,
                    color: customRole?.color ?? undefined,
                  }}
                >
                  {roleName}
                </span>
                <span>アプリ {apps.length} 個</span>
              </div>
            </div>
            <Link
              to="/organizations/$orgId/profile"
              params={{ orgId }}
              className="text-xs underline text-muted-foreground"
            >
              組織内プロフィール
            </Link>
          </div>

          {org?.join_code && canManage("invite") && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs text-muted-foreground">参加コード</span>
              <code className="rounded bg-background/80 px-2 py-1 font-mono font-bold tracking-widest">
                {org.join_code}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(org.join_code);
                  toast.success("コピーしました");
                }}
              >
                <Copy className="mr-1 h-3.5 w-3.5" />
                コピー
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* はじめの設定ウィザード */}
      {canManage("apps") && (wizard || notConfigured) && (
        <OrgSetupWizard
          orgId={orgId}
          onDone={() => {
            setWizard(false);
            reload();
          }}
        />
      )}
      {canManage("apps") && !wizard && !notConfigured && (
        <button
          type="button"
          onClick={() => setWizard(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-dashed p-3 text-left text-sm transition hover:border-primary hover:bg-muted/40"
        >
          <Wand2 className="h-4 w-4 text-primary" />
          <span className="flex-1">使うアプリと役職を、まとめて設定しなおす</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Makron for education */}
      {appEnabled("edu") && (
        <Link to="/makron/edu/$orgId" params={{ orgId }}>
          <Card className="flex items-center gap-3 border-primary/30 p-4 transition hover:border-primary">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15">
              <GraduationCap className="h-5 w-5 text-primary" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-bold">Makron for education を開く</div>
              <div className="text-[11px] text-muted-foreground">
                問題演習・課題・ランキング・成績
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Card>
        </Link>
      )}

      {/* アプリ */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-muted-foreground">アプリ</h2>
        {apps.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            使えるアプリがまだありません。
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {apps.map((a) => {
              const Icon = ICONS[a.icon] ?? LayoutGrid;
              return (
                <Link
                  key={a.key}
                  to="/organizations/$orgId/app/$appKey"
                  params={{ orgId, appKey: a.key }}
                >
                  <Card className="h-full p-4 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
                    <span
                      className="mb-2 grid h-9 w-9 place-items-center rounded-lg"
                      style={{ background: `${a.color}22` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: a.color }} />
                    </span>
                    <div className="text-sm font-bold">{appLabel(a.key)}</div>
                    <div className="text-[11px] text-muted-foreground">{a.desc}</div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 管理メニュー */}
      {manageItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1 text-sm font-bold text-muted-foreground">
            <ShieldAlert className="h-4 w-4" />
            管理メニュー
          </h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
            {manageItems.map((m) => (
              <Link
                key={m.section}
                to="/organizations/$orgId/manage/$section"
                params={{ orgId, section: m.section }}
              >
                <Card className="flex items-center gap-2 p-3 text-sm transition hover:border-primary">
                  <m.icon className="h-4 w-4 text-primary" />
                  <span className="truncate">{m.label}</span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* グループ */}
      {(isStaff || leadGroups.length > 0) && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1 text-sm font-bold text-muted-foreground">
            <Users className="h-4 w-4" />
            グループ
          </h2>
          <div className="flex flex-wrap gap-2">
            {leadGroups.map((g: any) => (
              <Link
                key={g.id}
                to="/organizations/$orgId/group/$groupId"
                params={{ orgId, groupId: g.id }}
              >
                <Button variant="outline" size="sm" style={{ borderLeft: `4px solid ${g.color}` }}>
                  {g.name}
                </Button>
              </Link>
            ))}
            {isStaff && (
              <Link to="/organizations/$orgId/group/$groupId" params={{ orgId, groupId: "new" }}>
                <Button size="sm">
                  <Plus className="mr-1 h-3 w-3" />
                  グループ追加
                </Button>
              </Link>
            )}
            {leadGroups.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                代表を務めるグループはまだありません。
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
