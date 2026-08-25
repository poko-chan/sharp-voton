import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MakronShell } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Play, ListChecks, Plus, Package, Settings, BarChart3, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AiPackImportDialog } from "@/components/makron/AiPackImportDialog";
import { fetchPackCounts } from "@/lib/makron-questions";

export const Route = createFileRoute("/_authenticated/makron/unit/$unitId")({ component: UnitPage });

function UnitPage() {
  const { unitId } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const nav = useNavigate();
  const [unit, setUnit] = useState<any>(null);
  const [packs, setPacks] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);
  const [pTitle, setPTitle] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [aiOpen, setAiOpen] = useState(false);

  const load = async () => {
    const { data: u } = await (supabase as any).from("makron_units").select("*").eq("id", unitId).maybeSingle();
    setUnit(u);
    const { data: ps } = await (supabase as any).from("makron_packs")
      .select("*")
      .eq("unit_id", unitId).eq("is_active", true)
      .order("order_idx").order("created_at");
    setPacks(ps ?? []);
    setCounts(await fetchPackCounts((ps ?? []).map((x: any) => x.id)));
  };
  useEffect(() => { load(); }, [unitId]);

  const startPack = async (packId: string) => {
    const { data, error } = await (supabase as any).rpc("makron_start_pack_session", { _pack_id: packId });
    if (error) return toast.error(error.message);
    nav({ to: "/makron/session/$sessionId", params: { sessionId: data } });
  };

  const createPack = async () => {
    if (!user || !pTitle.trim()) return;
    const { error } = await (supabase as any).from("makron_packs").insert({
      unit_id: unitId, title: pTitle.trim(), description: pDesc.trim() || null, created_by: user.id,
    } as any);
    if (error) return toast.error(error.message);
    setPTitle(""); setPDesc(""); setCreating(false);
    toast.success("パックを作成しました");
    load();
  };

  const visible = packs;

  return (
    <MakronShell back="/makron/units" title={unit?.title ?? "単元"} subtitle={[unit?.subject, unit?.field, unit?.unit].filter(Boolean).join(" / ")}>
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        {unit?.description && <Card className="p-4 text-sm whitespace-pre-wrap">{unit.description}</Card>}
        {isAdmin && (
          <Card className="p-3 flex flex-wrap items-center gap-3">
            <div className="ml-auto">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAiOpen(true)}>
                  <Sparkles className="h-4 w-4 mr-1" />AI で一括作成
                </Button>
                <Button size="sm" onClick={() => setCreating((v) => !v)}>
                  <Plus className="h-4 w-4 mr-1" />問題パックを作成
                </Button>
              </div>
            </div>
          </Card>
        )}

        {isAdmin && creating && (
          <Card className="p-4 space-y-2 border-primary/40">
            <div className="font-bold flex items-center gap-1"><Package className="h-4 w-4" />新しい問題パック</div>
            <Input placeholder="パック名 (例: 分類導入 基礎)" value={pTitle} onChange={(e) => setPTitle(e.target.value)} />
            <Textarea rows={2} placeholder="説明 (任意)" value={pDesc} onChange={(e) => setPDesc(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={createPack} disabled={!pTitle.trim()}>作成</Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>キャンセル</Button>
            </div>
          </Card>
        )}


        <div className="grid sm:grid-cols-2 gap-3">
          {visible.map((p) => {
            const isOwner = isAdmin;
            const qCount = counts[p.id] ?? 0;
            return (
              <Card key={p.id} className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <div className="font-bold flex-1 truncate">{p.title}</div>
                  {p.grade && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{p.grade}</span>}
                </div>
                {p.description && <div className="text-xs text-muted-foreground line-clamp-2">{p.description}</div>}
                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3">
                  <span><ListChecks className="h-3 w-3 inline mr-0.5" />{qCount}問</span>
                  {p.shuffle && <span>シャッフル</span>}
                  {p.question_limit && <span>{p.question_limit}問出題</span>}
                  {p.max_attempts && <span>最大{p.max_attempts}回</span>}
                </div>
                <div className="flex gap-1 pt-1">
                  <Button size="sm" className="flex-1" onClick={() => startPack(p.id)} disabled={qCount === 0}>
                    <Play className="h-4 w-4 mr-1" />演習開始
                  </Button>
                  {isOwner && (
                    <>
                      <Link to="/makron/pack/$packId" params={{ packId: p.id }}>
                        <Button size="sm" variant="outline" title="編集・設定"><Settings className="h-4 w-4" /></Button>
                      </Link>
                      <Link to="/makron/pack/$packId/dashboard" params={{ packId: p.id }}>
                        <Button size="sm" variant="outline" title="ダッシュボード"><BarChart3 className="h-4 w-4" /></Button>
                      </Link>
                    </>
                  )}
                </div>
              </Card>
            );
          })}

          {visible.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground col-span-full">
              この単元にはまだ問題パックがありません。上の「問題パックを作成」から追加してください。
            </Card>
          )}
        </div>
        <AiPackImportDialog
          open={aiOpen}
          onOpenChange={setAiOpen}
          mode="new"
          unit={unit ? { id: unitId, title: unit.title, subject: unit.subject, field: unit.field, unit: unit.unit } : null}
          onDone={load}
        />
      </div>
    </MakronShell>
  );
}