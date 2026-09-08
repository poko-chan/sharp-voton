import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, HeartPulse, Trash2 } from "lucide-react";
import { loadMembers, type Member } from "@/lib/org-school";

export function OrgHealth({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const staff = ctx.isStaff;
  const [rows, setRows] = useState<any[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [draft, setDraft] = useState({
    student_id: "",
    symptom: "",
    action: "",
    temperature: "",
  });

  const load = async () => {
    const { data } = await (supabase as any)
      .from("org_health_visits")
      .select("*")
      .eq("organization_id", orgId)
      .order("visited_at", { ascending: false })
      .limit(200);
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
    if (staff) loadMembers(orgId).then(setMembers);
  }, [orgId, staff]);

  const nameOfId = (id: string) => members.find((m) => m.user_id === id)?.name ?? "生徒";

  const add = async () => {
    if (!draft.student_id || !draft.symptom.trim())
      return toast.error("生徒と症状を入力してください");
    const { error } = await (supabase as any).from("org_health_visits").insert({
      organization_id: orgId,
      student_id: draft.student_id,
      visited_at: new Date().toISOString(),
      symptom: draft.symptom.trim(),
      action: draft.action || null,
      temperature: draft.temperature ? Number(draft.temperature) : null,
      recorded_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setDraft({ student_id: "", symptom: "", action: "", temperature: "" });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("org_health_visits").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      {staff && (
        <Card className="p-3 flex flex-wrap items-end gap-2">
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={draft.student_id}
            onChange={(e) => setDraft({ ...draft, student_id: e.target.value })}
          >
            <option value="">生徒を選ぶ</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>
          <Input
            className="h-9 w-32"
            placeholder="症状"
            value={draft.symptom}
            onChange={(e) => setDraft({ ...draft, symptom: e.target.value })}
          />
          <Input
            className="h-9 w-24"
            type="number"
            step="0.1"
            placeholder="体温"
            value={draft.temperature}
            onChange={(e) => setDraft({ ...draft, temperature: e.target.value })}
          />
          <Textarea
            className="w-full"
            rows={2}
            placeholder="対応（休養・保護者連絡・早退など）"
            value={draft.action}
            onChange={(e) => setDraft({ ...draft, action: e.target.value })}
          />
          <Button size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            記録する
          </Button>
        </Card>
      )}

      {rows.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">記録はまだありません。</Card>
      )}
      {rows.map((r) => (
        <Card key={r.id} className="p-3 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <HeartPulse className="h-4 w-4 text-rose-500" />
            <span className="text-xs text-muted-foreground">
              {new Date(r.visited_at).toLocaleString("ja-JP")}
            </span>
            {staff && <span className="text-xs">{nameOfId(r.student_id)}</span>}
            <span className="font-medium">{r.symptom}</span>
            {r.temperature != null && <span className="text-xs">{r.temperature}℃</span>}
            {staff && (
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => remove(r.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {r.action && <div className="text-xs text-muted-foreground">{r.action}</div>}
        </Card>
      ))}
    </div>
  );
}
