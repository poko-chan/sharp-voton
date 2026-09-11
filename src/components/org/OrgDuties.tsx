import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ListChecks, Trash2 } from "lucide-react";
import { loadMembers, type Member } from "@/lib/org-school";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function OrgDuties({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const staff = ctx.isStaff;
  const [rows, setRows] = useState<any[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [draft, setDraft] = useState({ title: "", assignee_id: "", weekday: "1", date: "", note: "" });

  const load = async () => {
    const { data } = await (supabase as any)
      .from("org_duties")
      .select("*")
      .eq("organization_id", orgId)
      .order("weekday", { ascending: true })
      .limit(400);
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
    loadMembers(orgId).then(setMembers);
  }, [orgId]);

  const nameOfId = (id: string | null) =>
    id ? (members.find((m) => m.user_id === id)?.name ?? "メンバー") : "未割当";

  const add = async () => {
    if (!draft.title.trim()) return toast.error("当番名を入力してください");
    const { error } = await (supabase as any).from("org_duties").insert({
      organization_id: orgId,
      title: draft.title.trim(),
      assignee_id: draft.assignee_id || null,
      weekday: draft.date ? null : Number(draft.weekday),
      date: draft.date || null,
      note: draft.note || null,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setDraft({ title: "", assignee_id: "", weekday: draft.weekday, date: "", note: "" });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("org_duties").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const todayWd = new Date().getDay();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todays = rows.filter((r) => r.date === todayStr || (!r.date && r.weekday === todayWd));

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="h-4 w-4" /> きょうの当番
        </div>
        {todays.length === 0 && (
          <div className="text-sm text-muted-foreground">きょうの当番はありません。</div>
        )}
        {todays.map((r) => (
          <div key={r.id} className="rounded-lg border p-2 text-sm">
            <span className="font-medium">{r.title}</span> ・ {nameOfId(r.assignee_id)}
            {r.note && <span className="text-muted-foreground"> ・ {r.note}</span>}
          </div>
        ))}
      </Card>

      {staff && (
        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold">当番を追加</div>
          <div className="grid gap-2 sm:grid-cols-5">
            <Input
              placeholder="当番名（例: 黒板）"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={draft.assignee_id}
              onChange={(e) => setDraft({ ...draft, assignee_id: e.target.value })}
            >
              <option value="">担当者（任意）</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={draft.weekday}
              disabled={!!draft.date}
              onChange={(e) => setDraft({ ...draft, weekday: e.target.value })}
            >
              {WEEKDAYS.map((w, i) => (
                <option key={w} value={i}>
                  毎週{w}曜
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
            <Input
              placeholder="メモ"
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </div>
          <Button size="sm" onClick={add}>
            追加
          </Button>
        </Card>
      )}

      <Card className="p-4 space-y-2">
        <div className="text-sm font-semibold">当番表</div>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
            <div>
              <div className="font-medium">{r.title}</div>
              <div className="text-xs text-muted-foreground">
                {r.date ? r.date : `毎週${WEEKDAYS[r.weekday ?? 0]}曜`} ・ {nameOfId(r.assignee_id)}
                {r.note ? ` ・ ${r.note}` : ""}
              </div>
            </div>
            {staff && (
              <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <div className="text-sm text-muted-foreground">まだ当番がありません。</div>
        )}
      </Card>
    </div>
  );
}
