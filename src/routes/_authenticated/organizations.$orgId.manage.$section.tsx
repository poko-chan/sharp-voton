import { createFileRoute, Link } from "@tanstack/react-router";
import { OrgManage } from "@/components/org/OrgManage";
import { OrgAppSettings } from "@/components/org/OrgAppSettings";
import { useOrg } from "@/lib/org-apps";

export const Route = createFileRoute("/_authenticated/organizations/$orgId/manage/$section")({ component: ManagePage });

function ManagePage() {
  const { orgId, section } = Route.useParams();
  const { canAdmin, loading } = useOrg(orgId);
  if (loading) return <div className="p-6 text-sm text-muted-foreground">読み込み中…</div>;
  if (!canAdmin) return (
    <div className="p-6 text-sm text-muted-foreground space-y-2">
      <div>管理メニューは共同管理者以上のみ利用できます。</div>
      <Link to="/organizations/$orgId" params={{ orgId }} className="underline">← 組織ホームへ</Link>
    </div>
  );
  if (section === "apps") return <OrgAppSettings orgId={orgId} />;
  return <OrgManage orgId={orgId} defaultTab={section} />;
}
