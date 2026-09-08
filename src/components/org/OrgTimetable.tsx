import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, Download } from "lucide-react";
import { DAYS, downloadCsv } from "@/lib/org-school";

const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export function OrgTimetable({ orgId, ctx }: { orgId: string; ctx: any }) {
  const staff = ctx.isStaff;
  const [rows, setRows] = useState<any[]>([]);
  const [groupId, setGroupId] = useState<string>("all");
  const [draft, setDraft] = useState({
    day_of_week: 1,
    period: 1,
    subject: "",
    room: "",
    teacher_name: "",
  });

  const load = async () => {
    const { data } = await (supabase as any)
      .from("org_timetable")
      .select("*")
      .eq("organization_id", orgId);
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
  }, [orgId]);

  const shown = rows.filter((r) => groupId === "all" || r.group_id === groupId);
  const cell = (d: number, p: number) => shown.find((r) => r.day_of_week === d && r.period === p);

  const add = async () => {
    if (!draft.subject.trim()) return toast.error("科目を入力してください");
    const { error } = await (supabase as any).from("org_timetable").insert({
      organization_id: orgId,
      group_id: groupId === "all" ? null : groupId,
      day_of_week: draft.day_of_week,
      period: draft.period,
      subject: draft.subject.trim(),
      room: draft.room || null,
      teacher_name: draft.teacher_name || null,
    });
    if (error) return toast.error(error.message);
    setDraft({ ...draft, subject: "", room: "" });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("org_timetable").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={groupId === "all" ? "default" : "outline"}
          onClick={() => setGroupId("all")}
        >
          組織全体
        </Button>
        {ctx.groups.map((g: any) => (
          <Button
            key={g.id}
            size="sm"
            variant={groupId === g.id ? "default" : "outline"}
            onClick={() => setGroupId(g.id)}
          >
            {g.name}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() =>
            downloadCsv("timetable.csv", [
              ["曜日", "時限", "科目", "教室", "担当"],
              ...shown.map((r) => [
                DAYS[r.day_of_week],
                r.period,
                r.subject,
                r.room ?? "",
                r.teacher_name ?? "",
              ]),
            ])
          }
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          CSV
        </Button>
      </Card>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[560px]">
          <thead>
            <tr>
              <th className="border p-1 w-12">時限</th>
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <th key={d} className="border p-1">
                  {DAYS[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p}>
                <td className="border p-1 text-center font-bold">{p}</td>
                {[1, 2, 3, 4, 5, 6].map((d) => {
                  const c = cell(d, p);
                  return (
                    <td key={d} className="border p-1 align-top h-12">
                      {c ? (
                        <div className="group">
                          <div className="font-medium">{c.subject}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {c.room} {c.teacher_name}
                          </div>
                          {staff && (
                            <button
                              className="text-[10px] text-destructive underline"
                              onClick={() => remove(c.id)}
                            >
                              削除
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {staff && (
        <Card className="p-3 flex flex-wrap items-end gap-2">
          <div>
            <div className="text-[11px] text-muted-foreground">曜日</div>
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={draft.day_of_week}
              onChange={(e) => setDraft({ ...draft, day_of_week: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>
                  {DAYS[d]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">時限</div>
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={draft.period}
              onChange={(e) => setDraft({ ...draft, period: Number(e.target.value) })}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <Input
            className="h-9 w-32"
            placeholder="科目"
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
          />
          <Input
            className="h-9 w-24"
            placeholder="教室"
            value={draft.room}
            onChange={(e) => setDraft({ ...draft, room: e.target.value })}
          />
          <Input
            className="h-9 w-28"
            placeholder="担当"
            value={draft.teacher_name}
            onChange={(e) => setDraft({ ...draft, teacher_name: e.target.value })}
          />
          <Button size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            追加
          </Button>
        </Card>
      )}
      {!staff && (
        <p className="text-[11px] text-muted-foreground">
          <Trash2 className="inline h-3 w-3 mr-1" />
          時間割の編集は先生のみが行えます。
        </p>
      )}
    </div>
  );
}
