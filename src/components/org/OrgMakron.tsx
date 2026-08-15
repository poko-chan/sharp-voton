import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export function OrgMakron({ orgId }: { orgId: string; ctx: any }) {
  const [packs, setPacks] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: a }] = await Promise.all([
        (supabase as any).from("makron_packs").select("id, title, status").eq("organization_id", orgId).limit(100),
        (supabase as any).from("org_pack_assignments").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
      ]);
      setPacks(p ?? []); setAssignments(a ?? []);
    })();
  }, [orgId]);
  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-2">
        <div className="font-bold flex items-center gap-1"><BookOpen className="h-4 w-4" />組織専用の問題集</div>
        {packs.length === 0 && <div className="text-xs text-muted-foreground">まだありません</div>}
        {packs.map((p) => (
          <Link key={p.id} to="/makron/pack/$packId" params={{ packId: p.id }} className="block border rounded p-2 text-sm hover:border-primary">
            {p.title}
          </Link>
        ))}
      </Card>
      <Card className="p-4 space-y-2">
        <div className="font-bold">配布された課題</div>
        {assignments.length === 0 && <div className="text-xs text-muted-foreground">課題はありません</div>}
        {assignments.map((a) => (
          <Link key={a.id} to="/makron/pack/$packId" params={{ packId: a.pack_id }} className="block border rounded p-2 text-sm hover:border-primary">
            {a.title}
            <span className="text-[11px] text-muted-foreground ml-2">
              {a.due_at ? `期限 ${new Date(a.due_at).toLocaleString("ja-JP")}` : "期限なし"}{a.required ? " ・必須" : ""}
            </span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
