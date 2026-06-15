import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MakronShell } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Play, ListChecks } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/makron/unit/$unitId")({ component: UnitPage });

function UnitPage() {
  const { unitId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [unit, setUnit] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [includePending, setIncludePending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await (supabase as any).from("makron_units").select("*").eq("id", unitId).maybeSingle();
      setUnit(u);
      let q = (supabase as any).from("makron_questions")
        .select("id, prompt, type, points, status, created_by")
        .eq("unit_id", unitId).neq("is_active", false)
        .order("status").order("order_idx").order("created_at");
      if (!includePending) q = q.eq("status", "approved");
      const { data: qs } = await q;
      setQuestions(qs ?? []);
    })();
  }, [unitId, includePending]);

  const start = async () => {
    if (!user) return;
    const approved = questions.filter((q) => q.status === "approved");
    if (approved.length === 0) return toast.error("公式問題がありません（演習は公式問題のみ）");
    setLoading(true);
    const { data, error } = await (supabase as any).from("makron_sessions").insert({ user_id: user.id, unit_id: unitId }).select().single();
    setLoading(false);
    if (error) return toast.error(error.message);
    nav({ to: "/makron/session/$sessionId", params: { sessionId: data.id } });
  };

  return (
    <MakronShell back="/makron" title={unit?.title ?? "単元"} subtitle={[unit?.subject, unit?.field, unit?.unit].filter(Boolean).join(" / ")}>
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        {unit?.description && <Card className="p-4 text-sm whitespace-pre-wrap">{unit.description}</Card>}
        <Card className="p-5 flex items-center justify-between">
          <div>
            <div className="font-bold text-lg flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              公式 {questions.filter((q) => q.status === "approved").length} 問
              {includePending && <span className="text-xs text-amber-600">（申請中 {questions.filter((q) => q.status === "pending").length} 問）</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-1">満点: {questions.reduce((s, q) => s + (q.points ?? 10), 0)} 点</div>
          </div>
          <Button size="lg" onClick={start} disabled={loading || questions.filter((q) => q.status === "approved").length === 0}>
            <Play className="h-5 w-5 mr-1" />演習を開始
          </Button>
        </Card>
        <Card className="p-3 flex items-center gap-2 text-sm">
          <Switch checked={includePending} onCheckedChange={setIncludePending} />
          <span>申請中の問題も表示（デフォルトは公式のみ・演習対象は公式問題のみ）</span>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-2">問題プレビュー</div>
          <ol className="text-sm space-y-1 list-decimal pl-5">
            {questions.map((q) => (
              <li key={q.id} className="truncate">
                <span className={`text-[10px] mr-1 px-1 rounded ${q.status === 'approved' ? 'bg-success/15 text-success' : 'bg-amber-500/15 text-amber-600'}`}>
                  {q.status === 'approved' ? '公式' : '申請中'}
                </span>
                <span className="text-[10px] text-muted-foreground mr-1">[{q.type}]</span>{q.prompt}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </MakronShell>
  );
}