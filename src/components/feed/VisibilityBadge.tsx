import { Globe, Users, Lock } from "lucide-react";

export function VisibilityBadge({ visibility, isOrg }: { visibility: string; isOrg?: boolean }) {
  if (isOrg) return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground"><Users className="h-3 w-3" />組織限定</span>;
  if (visibility === "followers") return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground"><Users className="h-3 w-3" />フォロワー限定</span>;
  if (visibility === "private") return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground"><Lock className="h-3 w-3" />自分のみ</span>;
  return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground"><Globe className="h-3 w-3" />全体公開</span>;
}
