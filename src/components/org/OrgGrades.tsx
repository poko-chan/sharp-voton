import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Download, Trash2 } from "lucide-react";
import { downloadCsv, loadMembers, type Member } from "@/lib/org-school";

export function OrgGrades({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const staff = ctx.isStaff;
  const [rows, setRows] = useState<any[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [term, setTerm] = useState("");
  const [draft, setDraft] = useState({ student_id: "", subject: "", score: "", comment: "" });

  const load = async () => {
    const { data } = await (supabase as any)
      .from("org_grades")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(500);
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
    if (staff) loadMembers(orgId).then(setMembers);
  }, [orgId, staff]);

  const nameOfId = (id: string) => members.find((m) => m.user_id === id)?.name ?? "生徒";
  const terms = useMemo(
    () => Array.from(new Set(rows.map((r) => r.term).filter(Boolean))) as string[],
    [rows],
  );
  const shown = rows.filter((r) => !term || r.term === term);

  const add = async () => {
    if (!draft.student_id || !draft.subject.trim())
      return toast.error("生徒と科目を選んでください");
    const { error } = await (supabase as any).from("org_grades").insert({
      organization_id: orgId,
      student_id: draft.student_id,
      term: term || "未設定",
      subject: draft.subject.trim(),
      score: draft.score ? Number(draft.score) : null,
      comment: draft.comment || null,
      published: false,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setDraft({ ...draft, subject: "", score: "", comment: "" });
    load();
  };

  const publish = async (id: string, v: boolean) => {
    const { error } = await (supabase as any)
      .from("org_grades")
      .update({ published: v })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.map((x) => (x.id === id ? { ...x, published: v } : x)));
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("org_grades").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Input
          className="h-9 w-40"
          placeholder="学期・テスト名"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        {terms.map((t) => (
          <Button key={t} size="sm" variant="outline" onClick={() => setTerm(t)}>
            {t}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() =>
            downloadCsv("grades.csv", [
              ["生徒", "学期", "科目", "点数", "コメント", "公開"],
              ...shown.map((r) => [
                staff ? nameOfId(r.student_id) : "自分",
                r.term,
                r.subject,
                r.score ?? "",
                r.comment ?? "",
                r.published ? "公開" : "非公開",
              ]),
            ])
          }
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          CSV
        </Button>
      </Card>

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
            className="h-9 w-28"
            placeholder="科目"
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
          />
          <Input
            className="h-9 w-20"
            type="number"
            placeholder="点数"
            value={draft.score}
            onChange={(e) => setDraft({ ...draft, score: e.target.value })}
          />
          <Input
            className="h-9 w-48"
            placeholder="コメント"
            value={draft.comment}
            onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
          />
          <Button size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            登録
          </Button>
        </Card>
      )}

      {shown.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">
          {staff ? "まだ成績が登録されていません。" : "公開された成績はまだありません。"}
        </Card>
      )}
      {shown.map((r) => (
        <Card key={r.id} className="p-3 flex flex-wrap items-center gap-3 text-sm">
          {staff && <span className="w-32 truncate">{nameOfId(r.student_id)}</span>}
          <span className="text-xs text-muted-foreground">{r.term}</span>
          <span className="font-medium">{r.subject}</span>
          <span className="font-bold">{r.score ?? "—"}</span>
          <span className="text-xs text-muted-foreground flex-1 truncate">{r.comment}</span>
          {staff && (
            <>
              <span className="text-[11px]">{r.published ? "公開中" : "非公開"}</span>
              <Switch checked={!!r.published} onCheckedChange={(v) => publish(r.id, v)} />
              <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}
