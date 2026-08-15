import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, CalendarDays, ChevronLeft, ChevronRight, MapPin, List, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { OrgScopePicker } from "./OrgScopePicker";

const WD = ["日", "月", "火", "水", "木", "金", "土"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const COLORS = ["#7B6CFF", "#34D7B5", "#38bdf8", "#fb923c", "#f472b6", "#a78bfa"];
const colorOf = (id: string | null) => id ? COLORS[Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length] : "#7B6CFF";

export function OrgCalendar({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [mode, setMode] = useState<"month" | "list">("month");
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState<string>(ymd(new Date()));
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

  const byDay = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const e of visible) (m[ymd(new Date(e.starts_at))] ??= []).push(e);
    return m;
  }, [visible]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startIdx = first.getDay();
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < startIdx; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor]);

  const todayKey = ymd(new Date());
  const dayEvents = byDay[selected] ?? [];

  const EventRow = ({ e }: { e: any }) => (
    <Card className="p-3 flex flex-wrap items-start gap-3">
      <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colorOf(e.group_id) }} />
      <div className="flex-1 min-w-[180px]">
        <div className="font-medium">{e.title}
          {e.group_id && <span className="text-[10px] ml-2 px-1.5 rounded bg-sky-500/15 text-sky-600">{gname(e.group_id)}</span>}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {new Date(e.starts_at).toLocaleString("ja-JP")}{e.ends_at && ` 〜 ${new Date(e.ends_at).toLocaleString("ja-JP")}`}
        </div>
        {e.location && <div className="text-[11px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</div>}
        {e.description && <div className="text-xs mt-1 whitespace-pre-wrap">{e.description}</div>}
      </div>
      {(e.created_by === user?.id || ctx.canAdmin) && (
        <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
          await (supabase as any).from("org_calendar_events").delete().eq("id", e.id); load();
        }}><Trash2 className="h-4 w-4" /></Button>
      )}
    </Card>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <OrgScopePicker groups={[{ id: "all", name: "すべて" }, ...ctx.groups]} value={filter} onChange={setFilter} orgLabel="組織カレンダー" />
        <div className="flex rounded-md border overflow-hidden">
          <button className={`px-2.5 py-1.5 text-xs flex items-center gap-1 ${mode === "month" ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setMode("month")}><LayoutGrid className="h-3.5 w-3.5" />月</button>
          <button className={`px-2.5 py-1.5 text-xs flex items-center gap-1 ${mode === "list" ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setMode("list")}><List className="h-3.5 w-3.5" />一覧</button>
        </div>
        {!creating && <Button className="ml-auto" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />予定を追加</Button>}
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

      {mode === "month" ? (
        <div className="grid lg:grid-cols-[1fr_300px] gap-4">
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <Button size="sm" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <div className="font-bold">{cursor.getFullYear()}年 {cursor.getMonth() + 1}月</div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); setSelected(todayKey); }}>今日</Button>
                <Button size="sm" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground mb-1">
              {WD.map((w, i) => <div key={w} className={i === 0 ? "text-rose-500" : i === 6 ? "text-sky-500" : ""}>{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {cells.map((d, i) => {
                const key = d ? ymd(d) : `x${i}`;
                const evs = d ? (byDay[key] ?? []) : [];
                return (
                  <button key={key} disabled={!d} onClick={() => d && setSelected(key)}
                    className={`min-h-[86px] bg-card p-1.5 text-left align-top transition
                      ${!d ? "opacity-40" : "hover:bg-muted/60"} ${selected === key ? "ring-2 ring-inset ring-primary" : ""}`}>
                    {d && (
                      <>
                        <div className={`text-xs mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full
                          ${key === todayKey ? "bg-primary text-primary-foreground font-bold" : i % 7 === 0 ? "text-rose-500" : i % 7 === 6 ? "text-sky-500" : ""}`}>{d.getDate()}</div>
                        <div className="space-y-0.5">
                          {evs.slice(0, 3).map((e: any) => (
                            <div key={e.id} className="truncate text-[10px] rounded px-1 py-0.5 text-white" style={{ background: colorOf(e.group_id) }}>{e.title}</div>
                          ))}
                          {evs.length > 3 && <div className="text-[10px] text-muted-foreground">+{evs.length - 3}件</div>}
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
          <div className="space-y-2">
            <div className="text-sm font-bold flex items-center gap-1"><CalendarDays className="h-4 w-4 text-primary" />{selected.replace(/-/g, "/")} の予定</div>
            {dayEvents.length === 0 && <Card className="p-6 text-xs text-muted-foreground text-center">予定はありません</Card>}
            {dayEvents.map((e: any) => <EventRow key={e.id} e={e} />)}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.length === 0 && <Card className="p-6 text-sm text-muted-foreground">予定はありません</Card>}
          {visible.map((e) => <EventRow key={e.id} e={e} />)}
        </div>
      )}
    </div>
  );
}
