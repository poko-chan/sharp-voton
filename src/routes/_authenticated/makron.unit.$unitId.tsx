import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MakronShell } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Play, ListChecks, Plus, Package, Crown, Settings, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/makron/unit/$unitId")({ component: UnitPage });

function UnitPage() {
  const { unitId } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const nav = useNavigate();
  const [unit, setUnit] = useState<any>(null);
  const [packs, setPacks] = useState<any[]>([]);
  const [includePending, setIncludePending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pTitle, setPTitle] = useState("");
  const [pDesc, setPDesc] = useState("");

  const load = async () => {
    const { data: u } = await (supabase as any).from("makron_units").select("*").eq("id", unitId).maybeSingle();
    setUnit(u);
    const { data: ps } = await (supabase as any).from("makron_packs")
      .select("*, qcount:makron_questions(count)")
      .eq("unit_id", unitId).eq("is_active", true)
      .order("is_official", { ascending: false }).order("order_idx").order("created_at");
    setPacks(ps ?? []);
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
      unit_id: unitId, title: pTitle.trim(), description: pDesc.trim() || null,
    } as any);
    if (error) return toast.error(error.message);
    setPTitle(""); setPDesc(""); setCreating(false);
    toast.success(isAdmin ? "パックを作成しました（公式）" : "パックを申請しました（管理者承認後に公開）");
    load();
  };

  const visible = packs.filter((p) => includePending || p.status === "approved");

  return (
    <MakronShell back="/makron" title={unit?.title ?? "単元"} subtitle={[unit?.subject, unit?.field, unit?.unit].filter(Boolean).join(" / ")}>
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        {unit?.description && <Card className="p-4 text-sm whitespace-pre-wrap">{unit.description}</Card>}
        <Card className="p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={includePending} onCheckedChange={setIncludePending} />
            <span>申請中パックも表示</span>
          </div>
          <div className="ml-auto">
            <Button size="sm" onClick={() => setCreating((v) => !v)}>
              <Plus className="h-4 w-4 mr-1" />問題パックを作成
            </Button>
          </div>
        </Card>

        {creating && (
          <Card className="p-4 space-y-2 border-primary/40">
            <div className="font-bold flex items-center gap-1"><Package className="h-4 w-4" />新しい問題パック</div>
            <Input placeholder="パック名 (例: 分類導入 基礎)" value={pTitle} onChange={(e) => setPTitle(e.target.value)} />
            <Textarea rows={2} placeholder="説明 (任意)" value={pDesc} onChange={(e) => setPDesc(e.target.value)} />
            <div className="text-[11px] text-muted-foreground">
              {isAdmin ? "管理者作成は自動で「公式」になります。" : "一般作成は「申請中」となり、管理者承認後に公式問題として公開されます。"}
              作成後にパック画面から問題追加・設定変更ができます。
            </div>
            <div className="flex gap-2">
              <Button onClick={createPack} disabled={!pTitle.trim()}>作成</Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>キャンセル</Button>
            </div>
          </Card>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          {visible.map((p) => {
            const isOwner = p.created_by === user?.id || isAdmin;
            const qCount = p.qcount?.[0]?.count ?? 0;
            return (
              <Card key={p.id} className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <div className="font-bold flex-1 truncate">{p.title}</div>
                  {p.is_official ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success flex items-center gap-0.5"><Crown className="h-3 w-3" />公式</span>
                  ) : p.status === "pending" ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600">申請中</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">非公式</span>
                  )}
                </div>
                {p.description && <div className="text-xs text-muted-foreground line-clamp-2">{p.description}</div>}
                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3">
                  <span><ListChecks className="h-3 w-3 inline mr-0.5" />{qCount}問</span>
                  {p.shuffle && <span>シャッフル</span>}
                  {p.question_limit && <span>{p.question_limit}問出題</span>}
                  {p.max_attempts && <span>最大{p.max_attempts}回</span>}
                  {!p.is_official && <span className="text-amber-600">報酬なし</span>}
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
      </div>
    </MakronShell>
  );
}