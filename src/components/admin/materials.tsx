import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, BookOpen, Pencil } from "lucide-react";
import { toast } from "sonner";

export function MaterialsReviewTab() {
  const [pendingMaterials, setPendingMaterials] = useState<any[]>([]);
  const [pendingEdits, setPendingEdits] = useState<any[]>([]);
  const [materialsById, setMaterialsById] = useState<Record<string, any>>({});

  const load = async () => {
    const { data: pm } = await (supabase as any).from("materials")
      .select("*, profile:profiles!materials_created_by_fkey(username, display_name)")
      .eq("status", "pending").order("created_at", { ascending: false });
    setPendingMaterials(pm ?? []);

    const { data: pe } = await (supabase as any).from("material_edits")
      .select("*, profile:profiles!material_edits_proposer_fkey(username, display_name)")
      .eq("status", "pending").order("created_at", { ascending: false });
    setPendingEdits(pe ?? []);

    const ids = [...new Set((pe ?? []).map((e: any) => e.material_id))];
    if (ids.length) {
      const { data: ms } = await (supabase as any).from("materials").select("*").in("id", ids);
      const map: Record<string, any> = {};
      (ms ?? []).forEach((m: any) => { map[m.id] = m; });
      setMaterialsById(map);
    }
  };
  useEffect(() => { load(); }, []);

  const reviewMaterial = async (id: string, approve: boolean) => {
    const { error } = await (supabase as any).rpc("admin_review_material", { _id: id, _approve: approve });
    if (error) return toast.error(error.message);
    toast.success(approve ? "承認しました" : "却下しました"); load();
  };

  const reviewEdit = async (id: string, approve: boolean) => {
    const { error } = await (supabase as any).rpc("admin_review_material_edit", { _id: id, _approve: approve, _note: null });
    if (error) return toast.error(error.message);
    toast.success(approve ? "編集を反映しました" : "却下しました"); load();
  };

  return (
    <div className="space-y-6 mt-4">
      <div>
        <div className="font-bold flex items-center gap-2 mb-2"><BookOpen className="h-4 w-4" />新規教材の承認 ({pendingMaterials.length})</div>
        {pendingMaterials.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">審査待ちの教材はありません</Card>}
        <div className="space-y-2">
          {pendingMaterials.map((m: any) => (
            <Card key={m.id} className="p-3 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2">
                  {m.title}
                  <Badge className="text-[10px] bg-amber-500">非公式</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {m.subject} ・ {m.publisher} ・ 投稿者: {m.profile?.display_name ?? m.profile?.username ?? "不明"}
                </div>
              </div>
              <Button size="sm" onClick={() => reviewMaterial(m.id, true)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />承認</Button>
              <Button size="sm" variant="outline" onClick={() => reviewMaterial(m.id, false)}><XCircle className="h-3.5 w-3.5 mr-1" />却下</Button>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <div className="font-bold flex items-center gap-2 mb-2"><Pencil className="h-4 w-4" />編集申請の承認 ({pendingEdits.length})</div>
        {pendingEdits.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">審査待ちの編集申請はありません</Card>}
        <div className="space-y-2">
          {pendingEdits.map((e: any) => {
            const current = materialsById[e.material_id];
            const patch = (e.patch ?? {}) as Record<string, any>;
            return (
              <Card key={e.id} className="p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{current?.title ?? e.material_id}</div>
                  <div className="text-xs text-muted-foreground">申請者: {e.profile?.display_name ?? e.profile?.username ?? "不明"}</div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 bg-muted/40 rounded p-2">
                  {Object.entries(patch).map(([k, v]) => (
                    <div key={k} className="text-xs">
                      <div className="text-muted-foreground">{k}</div>
                      <div className="line-through text-muted-foreground/70 break-words">{String(current?.[k] ?? "（空）")}</div>
                      <div className="font-medium break-words">→ {String(v)}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => reviewEdit(e.id, true)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />承認して反映</Button>
                  <Button size="sm" variant="outline" onClick={() => reviewEdit(e.id, false)}><XCircle className="h-3.5 w-3.5 mr-1" />却下</Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
