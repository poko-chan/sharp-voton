import { createFileRoute, Link } from "@tanstack/react-router";
import { useOrg, ORG_APPS } from "@/lib/org-apps";
import { OrgPosts } from "@/components/org/OrgPosts";
import { OrgCalendar } from "@/components/org/OrgCalendar";
import { OrgChat } from "@/components/org/OrgChat";
import { OrgNotifications } from "@/components/org/OrgNotifications";

export const Route = createFileRoute("/_authenticated/organizations/$orgId/app/$appKey")({
  component: AppPage,
});

function AppPage() {
  const { orgId, appKey } = Route.useParams();
  const ctx = useOrg(orgId);
  if (ctx.loading) return <div className="p-6 text-sm text-muted-foreground">読み込み中…</div>;
  if (!ctx.myRole && !ctx.canAdmin)
    return <div className="p-6 text-sm text-muted-foreground">この組織に参加していません。</div>;

  const meta = ORG_APPS.find((a) => a.key === appKey);
  const back = (
    <Link to="/organizations/$orgId" params={{ orgId }} className="text-sm underline text-muted-foreground">
      ← 組織ホームへ
    </Link>
  );
  if (!meta)
    return (
      <div className="p-6 space-y-2 text-sm text-muted-foreground">
        <div>このアプリは現在リニューアル準備中です。</div>
        {back}
      </div>
    );
  if (!ctx.appEnabled(appKey))
    return (
      <div className="p-6 space-y-2 text-sm text-muted-foreground">
        <div>このアプリは組織の管理者によって無効化されています。</div>
        {back}
      </div>
    );

  const props = { orgId, ctx } as any;
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      {back}
      <h1 className="text-xl font-bold">
        {ctx.appLabel(appKey)}
        <span className="text-xs font-normal text-muted-foreground ml-2">{meta.desc}</span>
      </h1>
      {appKey === "posts" && <OrgPosts {...props} />}
      {appKey === "calendar" && <OrgCalendar {...props} />}
      {appKey === "chat" && <OrgChat {...props} />}
      {appKey === "notifications" && <OrgNotifications {...props} />}
    </div>
  );
}
