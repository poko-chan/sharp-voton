import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { OrgScopePicker } from "./OrgScopePicker";

export function OrgCalendar({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [scope, setScope] = useState("org");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [place, setPlace] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = async () => {
    const { data, error } = await (supabase as any).from("org_calendar_events").select("*")
      .eq("organization_id", orgId).order("starts_at");
    if (error) return toast.error(error.message);
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [orgId]);

  const create = async () => {
    if (!title.trim() || !start) return toast.error("タイトルと開始日時を入力してください");
    const { error } = await (supabase as any).from("org_calendar_events").insert({
      organization_id: orgId, group_id: scope === "org" ? null : scope,
      title: title.trim(), description: desc || null, location: place || null,
      starts_at: new Date(start).toISOString(), ends_at: end ? new Date(end).toISOString() : null,
      created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    await (supabase as any).rpc("org_notify_members", {
      _org: orgId, _group: scope === "org" ? null : scope, _app: "calendar", _title: `予定: ${title.trim()}`, _body: new Date(start).toLocaleString("ja-JP"),
    });
    toast.success("予定を追加しました");
    setCreating(false); setTitle(""); setDesc(""); setPlace(""); setStart(""); setEnd(""); load();
  };

  const visible = rows.filter((r) => filter === "all" || (filter === "org" ? !r.group_id : r.group_id === filter));
  const gname = (id: string) => ctx.groups.find((g: any) => g.id === id)?.name ?? "グループ";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <OrgScopePicker groups={[{ id: "all", name: "すべて" }, ...ctx.groups]} value={filter} onChange={setFilter} orgLabel="組織カレンダー" />
        {!creating && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />予定を追加</Button>}
      </div>

      {creating && (
        <Card className="p-4 space-y-2">
          <OrgScopePicker groups={ctx.groups} value={scope} onChange={setScope} orgLabel="組織全体（教師以上）" />
          <Input placeholder="予定名" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-56" />
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="w-56" />
            <Input placeholder="場所（任意）" value={place} onChange={(e) => setPlace(e.target.value)} className="flex-1 min-w-[160px]" />
          </div>
          <Textarea rows={2} placeholder="説明（任意）" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="flex gap-2"><Button onClick={create}>追加</Button><Button variant="ghost" onClick={() => setCreating(false)}>やめる</Button></div>
        </Card>
      )}

      {visible.length === 0 && <Card className="p-6 text-sm text-muted-foreground">予定はありません</Card>}
      {visible.map((e) => (
        <Card key={e.id} className="p-3 flex flex-wrap items-center gap-3">
          <CalendarDays className="h-4 w-4 text-primary" />
          <div className="flex-1 min-w-[180px]">
            <div className="font-medium">{e.title}
              {e.group_id && <span className="text-[10px] ml-2 px-1.5 rounded bg-sky-500/15 text-sky-600">{gname(e.group_id)}</span>}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {new Date(e.starts_at).toLocaleString("ja-JP")}{e.ends_at && ` 〜 ${new Date(e.ends_at).toLocaleString("ja-JP")}`}
              {e.location && ` ・ ${e.location}`}
            </div>
            {e.description && <div className="text-xs mt-1">{e.description}</div>}
          </div>
          {(e.created_by === user?.id || ctx.canAdmin) && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
              await (supabase as any).from("org_calendar_events").delete().eq("id", e.id); load();
            }}><Trash2 className="h-4 w-4" /></Button>
          )}
        </Card>
      ))}
    </div>
  );
}
