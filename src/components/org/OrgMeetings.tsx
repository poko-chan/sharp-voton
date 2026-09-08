import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { loadMembers, type Member } from "@/lib/org-school";

const KINDS = [
  { key: "parent", label: "三者・保護者面談" },
  { key: "career", label: "進路面談" },
  { key: "study", label: "学習相談" },
  { key: "other", label: "その他" },
];

export function OrgMeetings({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const staff = ctx.isStaff;
  const [rows, setRows] = useState<any[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [draft, setDraft] = useState({
    student_id: "",
    start_at: "",
    duration_min: 20,
    place: "",
    kind: "parent",
    note: "",
  });

  const load = async () => {
    const { data } = await (supabase as any)
      .from("org_meetings")
      .select("*")
      .eq("organization_id", orgId)
      .order("start_at", { ascending: true })
      .limit(200);
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
    if (staff) loadMembers(orgId).then(setMembers);
  }, [orgId, staff]);

  const nameOfId = (id: string) => members.find((m) => m.user_id === id)?.name ?? "生徒";

  const add = async () => {
    if (!draft.student_id || !draft.start_at) return toast.error("生徒と日時を入力してください");
    const { error } = await (supabase as any).from("org_meetings").insert({
      organization_id: orgId,
      student_id: draft.student_id,
      staff_id: user?.id ?? null,
      start_at: new Date(draft.start_at).toISOString(),
      duration_min: draft.duration_min,
      place: draft.place || null,
      kind: draft.kind,
      status: "scheduled",
      note: draft.note || null,
    });
    if (error) return toast.error(error.message);
    setDraft({ ...draft, start_at: "", note: "" });
    load();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any).from("org_meetings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("org_meetings").delete().eq("id", id);
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
            className="h-9 w-52"
            type="datetime-local"
            value={draft.start_at}
            onChange={(e) => setDraft({ ...draft, start_at: e.target.value })}
          />
          <Input
            className="h-9 w-20"
            type="number"
            value={draft.duration_min}
            onChange={(e) => setDraft({ ...draft, duration_min: Number(e.target.value) })}
          />
          <Input
            className="h-9 w-28"
            placeholder="場所"
            value={draft.place}
            onChange={(e) => setDraft({ ...draft, place: e.target.value })}
          />
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
          >
            {KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
          <Textarea
            className="w-full"
            rows={2}
            placeholder="メモ（生徒にも表示されます）"
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
          <Button size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            予定を追加
          </Button>
        </Card>
      )}

      {rows.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">面談の予定はありません。</Card>
      )}
      {rows.map((r) => (
        <Card key={r.id} className="p-3 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">
              {new Date(r.start_at).toLocaleString("ja-JP", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="text-xs text-muted-foreground">{r.duration_min}分</span>
            {staff && <span className="text-xs">{nameOfId(r.student_id)}</span>}
            <span className="text-xs px-1.5 rounded bg-muted">
              {KINDS.find((k) => k.key === r.kind)?.label}
            </span>
            <span className="text-xs">{r.place}</span>
            <span className="text-xs ml-auto px-1.5 rounded bg-muted">
              {r.status === "scheduled" ? "予定" : r.status === "done" ? "完了" : "中止"}
            </span>
            {staff && (
              <>
                <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "done")}>
                  完了
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
          {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
        </Card>
      ))}
    </div>
  );
}
