import { createFileRoute, Link } from "@tanstack/react-router";
import { OrgManage } from "@/components/org/OrgManage";
import { OrgAppSettings } from "@/components/org/OrgAppSettings";
import { OrgProfileFields } from "@/components/org/OrgProfileFields";
import { OrgRoster } from "@/components/org/OrgRoster";
import { useOrg } from "@/lib/org-apps";
import { OrgRoles } from "@/components/org/OrgRoles";

export const Route = createFileRoute("/_authenticated/organizations/$orgId/manage/$section")({
  component: ManagePage,
});

function ManagePage() {
  const { orgId, section } = Route.useParams();
  const { isStaff, loading, canManage } = useOrg(orgId);
  const canAdmin = canManage(section);
  if (loading) return <div className="p-6 text-sm text-muted-foreground">読み込み中…</div>;
  if (section === "roster") {
    return isStaff ? (
      <OrgRoster orgId={orgId} />
    ) : (
      <div className="p-6 text-sm text-muted-foreground space-y-2">
        <div>名簿は教師以上のみ編集できます。</div>
        <Link to="/organizations/$orgId" params={{ orgId }} className="underline">
          ← 組織ホームへ
        </Link>
      </div>
    );
  }
  if (!canAdmin)
    return (
      <div className="p-6 text-sm text-muted-foreground space-y-2">
        <div>この管理メニューを使う権限がありません。</div>
        <Link to="/organizations/$orgId" params={{ orgId }} className="underline">
          ← 組織ホームへ
        </Link>
      </div>
    );
  if (section === "roles") return <OrgRoles orgId={orgId} />;
  if (section === "apps") return <OrgAppSettings orgId={orgId} />;
  if (section === "profile-fields") return <OrgProfileFields orgId={orgId} />;
  return <OrgManage orgId={orgId} defaultTab={section} />;
}
