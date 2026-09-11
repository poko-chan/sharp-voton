import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { NotebookPen, Trash2 } from "lucide-react";
import { loadMembers, type Member } from "@/lib/org-school";

const WEATHER = ["晴れ", "くもり", "雨", "雪"];

export function OrgJournal({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const staff = ctx.isStaff;
  const [rows, setRows] = useState<any[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({
    date: new Date().toISOString().slice(0, 10),
    weather: "晴れ",
    present_count: "",
    absent_count: "",
    lessons: "",
    reflection: "",
  });

  const load = async () => {
    const { data } = await (supabase as any)
      .from("org_journals")
      .select("*")
      .eq("organization_id", orgId)
      .order("date", { ascending: false })
      .limit(120);
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
    loadMembers(orgId).then(setMembers);
  }, [orgId]);

  const nameOfId = (id: string) => members.find((m) => m.user_id === id)?.name ?? "メンバー";

  const save = async () => {
    if (!draft.lessons.trim() && !draft.reflection.trim())
      return toast.error("授業の内容か所感を入力してください");
    const { error } = await (supabase as any).from("org_journals").insert({
      organization_id: orgId,
      date: draft.date,
      weather: draft.weather,
      present_count: draft.present_count ? Number(draft.present_count) : null,
      absent_count: draft.absent_count ? Number(draft.absent_count) : null,
      lessons: draft.lessons || null,
      reflection: draft.reflection || null,
      author_id: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("日誌を提出しました");
    setDraft({ ...draft, lessons: "", reflection: "", present_count: "", absent_count: "" });
    load();
  };

  const saveComment = async (id: string) => {
    const { error } = await (supabase as any)
      .from("org_journals")
      .update({ teacher_comment: comment[id] ?? "" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("コメントを保存しました");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("org_journals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <NotebookPen className="h-4 w-4" /> きょうの日誌
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <Input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={draft.weather}
            onChange={(e) => setDraft({ ...draft, weather: e.target.value })}
          >
            {WEATHER.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
          <Input
            type="number"
            placeholder="出席人数"
            value={draft.present_count}
            onChange={(e) => setDraft({ ...draft, present_count: e.target.value })}
          />
          <Input
            type="number"
            placeholder="欠席人数"
            value={draft.absent_count}
            onChange={(e) => setDraft({ ...draft, absent_count: e.target.value })}
          />
        </div>
        <Textarea
          placeholder="授業の内容"
          value={draft.lessons}
          onChange={(e) => setDraft({ ...draft, lessons: e.target.value })}
        />
        <Textarea
          placeholder="today の所感・連絡事項"
          value={draft.reflection}
          onChange={(e) => setDraft({ ...draft, reflection: e.target.value })}
        />
        <Button size="sm" onClick={save}>
          提出
        </Button>
      </Card>

      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.id} className="p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                {r.date} ・ {r.weather ?? "-"} ・ 日直 {nameOfId(r.author_id)}
              </div>
              {(staff || r.author_id === user?.id) && (
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              出席 {r.present_count ?? "-"} / 欠席 {r.absent_count ?? "-"}
            </div>
            {r.lessons && <div className="whitespace-pre-wrap">{r.lessons}</div>}
            {r.reflection && (
              <div className="whitespace-pre-wrap text-muted-foreground">{r.reflection}</div>
            )}
            {r.teacher_comment && (
              <div className="rounded-lg bg-muted p-2 text-xs">先生より: {r.teacher_comment}</div>
            )}
            {staff && (
              <div className="flex gap-2">
                <Input
                  placeholder="先生コメント"
                  value={comment[r.id] ?? r.teacher_comment ?? ""}
                  onChange={(e) => setComment({ ...comment, [r.id]: e.target.value })}
                />
                <Button size="sm" variant="outline" onClick={() => saveComment(r.id)}>
                  保存
                </Button>
              </div>
            )}
          </Card>
        ))}
        {rows.length === 0 && (
          <div className="text-sm text-muted-foreground">まだ日誌がありません。</div>
        )}
      </div>
    </div>
  );
}
