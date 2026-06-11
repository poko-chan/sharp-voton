import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MakronShell } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    (async () => {
      const { data: u } = await (supabase as any).from("makron_units").select("*").eq("id", unitId).maybeSingle();
      setUnit(u);
      const { data: qs } = await (supabase as any).from("makron_questions").select("id, prompt, type, points").eq("unit_id", unitId).neq("is_active", false).order("order_idx").order("created_at");
      setQuestions(qs ?? []);
    })();
  }, [unitId]);

  const start = async () => {
    if (!user) return;
    if (questions.length === 0) return toast.error("問題がありません");
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
            <div className="font-bold text-lg flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" />{questions.length} 問</div>
            <div className="text-xs text-muted-foreground mt-1">満点: {questions.reduce((s, q) => s + (q.points ?? 10), 0)} 点</div>
          </div>
          <Button size="lg" onClick={start} disabled={loading || questions.length === 0}>
            <Play className="h-5 w-5 mr-1" />演習を開始
          </Button>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-2">問題プレビュー</div>
          <ol className="text-sm space-y-1 list-decimal pl-5">
            {questions.map((q) => (
              <li key={q.id} className="truncate"><span className="text-[10px] text-muted-foreground mr-1">[{q.type}]</span>{q.prompt}</li>
            ))}
          </ol>
        </Card>
      </div>
    </MakronShell>
  );
}