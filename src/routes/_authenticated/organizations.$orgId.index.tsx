import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bell, Megaphone, ClipboardList, CalendarDays, IdCard, MessagesSquare, BookOpen, GraduationCap, ListChecks,
  Building2, ShieldAlert, Users, UserPlus, Clock, Ban, LayoutGrid, Settings, Plus, UserCog,
} from "lucide-react";
import { ORG_APPS, useOrg } from "@/lib/org-apps";
import { ROLE_LABEL } from "@/lib/org-roles";

export const Route = createFileRoute("/_authenticated/organizations/$orgId/")({ component: OrgHome });

const ICONS: Record<string, any> = { Bell, Megaphone, ClipboardList, CalendarDays, IdCard, MessagesSquare, BookOpen, GraduationCap };

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
];

function OrgHome() {
  const { orgId } = Route.useParams();
  const { org, myRole, canAdmin, isStaff, leadGroups, loading, appEnabled, appLabel } = useOrg(orgId);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">読み込み中…</div>;
  if (!myRole && !canAdmin) return (
    <div className="p-6 text-sm text-muted-foreground space-y-2">
      <div>この組織に参加していません。</div>
      <Link to="/organizations" className="underline">← 組織一覧へ戻る</Link>
    </div>
  );

  const apps = ORG_APPS.filter((a) => appEnabled(a.key));

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Link to="/organizations" className="text-sm underline text-muted-foreground">← 組織一覧へ</Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" />{org?.name}</h1>
        <span className="text-xs px-2 py-0.5 rounded bg-muted">{ROLE_LABEL[myRole ?? ""] ?? "運営"}</span>
        <Link to="/organizations/$orgId/profile" params={{ orgId }} className="text-xs underline text-muted-foreground ml-auto">組織内プロフィールを編集</Link>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-muted-foreground">アプリ</h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
          {apps.map((a) => {
            const Icon = ICONS[a.icon] ?? LayoutGrid;
            return (
              <Link key={a.key} to="/organizations/$orgId/app/$appKey" params={{ orgId, appKey: a.key }}>
                <Card className="p-4 h-full hover:border-primary transition-colors">
                  <Icon className="h-6 w-6 mb-2" style={{ color: a.color }} />
                  <div className="font-bold text-sm">{appLabel(a.key)}</div>
                  <div className="text-[11px] text-muted-foreground">{a.desc}</div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {canAdmin && (
        <section className="rounded-xl border-2 border-destructive/60 bg-destructive/5 p-4 space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-1 text-destructive"><ShieldAlert className="h-4 w-4" />管理メニュー</h2>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
            {MANAGE_ITEMS.map((m) => (
              <Link key={m.section} to="/organizations/$orgId/manage/$section" params={{ orgId, section: m.section }}>
                <Card className="p-3 flex items-center gap-2 text-sm hover:border-destructive transition-colors">
                  <m.icon className="h-4 w-4 text-destructive" />{m.label}
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(isStaff || leadGroups.length > 0) && (
        <section className="rounded-xl border-2 border-sky-500/60 bg-sky-500/5 p-4 space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-1 text-sky-600"><Users className="h-4 w-4" />グループ管理メニュー</h2>
          <div className="flex flex-wrap gap-2">
            {leadGroups.map((g: any) => (
              <Link key={g.id} to="/organizations/$orgId/group/$groupId" params={{ orgId, groupId: g.id }}>
                <Button variant="outline" size="sm" className="border-sky-500/60" style={{ borderLeft: `4px solid ${g.color}` }}>{g.name}</Button>
              </Link>
            ))}
            {isStaff && (
              <Link to="/organizations/$orgId/group/$groupId" params={{ orgId, groupId: "new" }}>
                <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white"><Plus className="h-3 w-3 mr-1" />グループ追加</Button>
              </Link>
            )}
          </div>
          {leadGroups.length === 0 && <p className="text-[11px] text-muted-foreground">代表を務めるグループはまだありません。</p>}
        </section>
      )}
    </div>
  );
}
