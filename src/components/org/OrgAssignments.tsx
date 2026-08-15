import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, Trash2, BarChart3, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { jstFormat } from "@/lib/date";
import { ROLE_LABEL } from "@/lib/org-roles";

type Props = {
  orgId: string;
  canAdmin: boolean;
  packs: any[];
  members: any[];
};

export function OrgAssignments({ orgId, canAdmin, packs, members }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [packId, setPackId] = useState("");
  const [due, setDue] = useState("");
  const [required, setRequired] = useState(true);
  const [assignAll, setAssignAll] = useState(true);
  const [targets, setTargets] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [progress, setProgress] = useState<Record<string, any[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await (supabase as any).from("org_pack_assignments")
      .select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [orgId]);

  const packTitle = (id: string) => packs.find((p) => p.id === id)?.title ?? "問題集";

  const create = async () => {
    if (!title.trim() || !packId) return toast.error("タイトルと問題集を選んでください");
    const { data, error } = await (supabase as any).from("org_pack_assignments").insert({
      organization_id: orgId, pack_id: packId, title: title.trim(),
      due_at: due ? new Date(due).toISOString() : null,
      required, assign_all: assignAll, instructions: instructions || null,
    }).select("id").single();
    if (error) return toast.error(error.message);
    if (!assignAll && targets.length) {
      const { error: e2 } = await (supabase as any).from("org_assignment_targets")
        .insert(targets.map((u) => ({ assignment_id: data.id, user_id: u })));
      if (e2) toast.error(e2.message);
    }
    toast.success("課題を配布しました");
    setCreating(false); setTitle(""); setPackId(""); setDue(""); setInstructions(""); setTargets([]); setAssignAll(true);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("org_pack_assignments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const showProgress = async (id: string) => {
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    if (progress[id]) return;
    const { data, error } = await (supabase as any).rpc("org_assignment_progress", { _assignment: id });
    if (error) return toast.error(error.message);
    setProgress((p) => ({ ...p, [id]: data ?? [] }));
  };

  return (
    <div className="space-y-3">
      {canAdmin && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-bold flex items-center gap-1"><ClipboardList className="h-4 w-4" />課題を配布</div>
            <Button size="sm" variant={creating ? "ghost" : "default"} onClick={() => setCreating(!creating)}>
              {creating ? "キャンセル" : <><Plus className="h-3 w-3 mr-1" />新しい課題</>}
            </Button>
          </div>
          {creating && (
            <div className="space-y-2">
              <Input placeholder="課題タイトル（例: 今週の英単語）" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Select value={packId} onValueChange={setPackId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="組織の問題集を選択" /></SelectTrigger>
                <SelectContent>{packs.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs flex items-center gap-2">期限
                  <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="h-9 w-56" />
                </label>
                <label className="text-xs flex items-center gap-2"><Switch checked={required} onCheckedChange={setRequired} />必須</label>
                <label className="text-xs flex items-center gap-2"><Switch checked={assignAll} onCheckedChange={setAssignAll} />全メンバーに配布</label>
              </div>
              {!assignAll && (
                <div className="max-h-44 overflow-auto border rounded p-2 space-y-1">
                  {members.map((m: any) => (
                    <label key={m.user_id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={targets.includes(m.user_id)}
                        onChange={(e) => setTargets((t) => e.target.checked ? [...t, m.user_id] : t.filter((x) => x !== m.user_id))} />
                      {m.profile?.display_name ?? m.profile?.username ?? m.user_id.slice(0, 8)}
                      <span className="text-[10px] px-1.5 rounded bg-muted">{ROLE_LABEL[m.role] ?? m.role}</span>
                    </label>
                  ))}
                </div>
              )}
              <Textarea placeholder="指示・メモ（任意）" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} />
              <Button onClick={create}>配布する</Button>
            </div>
          )}
        </Card>
      )}

      {rows.length === 0 && <Card className="p-6 text-sm text-muted-foreground">課題はまだありません</Card>}

      {rows.map((a: any) => {
        const overdue = a.due_at && new Date(a.due_at).getTime() < Date.now();
        return (
          <Card key={a.id} className="p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[180px]">
                <div className="font-medium flex items-center gap-2">
                  {a.title}
                  {a.required && <span className="text-[10px] px-1.5 rounded bg-primary/15 text-primary">必須</span>}
                  {!a.assign_all && <span className="text-[10px] px-1.5 rounded bg-muted">指名</span>}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  {packTitle(a.pack_id)}
                  {a.due_at && (
                    <span className={overdue ? "text-destructive" : ""}>
                      <CalendarClock className="h-3 w-3 inline mx-1" />{jstFormat(a.due_at)}まで
                    </span>
                  )}
                </div>
                {a.instructions && <div className="text-xs mt-1 whitespace-pre-wrap">{a.instructions}</div>}
              </div>
              <Link to="/makron/pack/$packId" params={{ packId: a.pack_id }} className="text-xs underline">取り組む →</Link>
              {canAdmin && (
                <>
                  <Button size="sm" variant="outline" onClick={() => showProgress(a.id)}><BarChart3 className="h-3 w-3 mr-1" />進捗</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                </>
              )}
            </div>
            {canAdmin && openId === a.id && (
              <div className="border-t pt-2 space-y-1">
                {(progress[a.id] ?? []).map((p: any) => (
                  <div key={p.user_id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex-1 min-w-[120px]">{p.display_name ?? p.username ?? p.user_id.slice(0, 8)}</span>
                    <span className={p.done ? "text-emerald-600" : "text-muted-foreground"}>{p.done ? "完了" : "未着手"}</span>
                    <span>最高 {p.best_score ?? 0}%</span>
                    <span className="text-muted-foreground">{p.attempts ?? 0}回 / {p.last_at ? jstFormat(p.last_at) : "—"}</span>
                  </div>
                ))}
                {(progress[a.id] ?? []).length === 0 && <div className="text-xs text-muted-foreground">対象者がいません</div>}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
