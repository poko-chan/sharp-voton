import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { NotebookPen, Plus, Trash2, Users, Search, Inbox, Archive } from "lucide-react";
import { COVER_COLORS, PAPER_COLORS, PAPER_TYPES, type Notebook, type PaperType } from "@/lib/notebooks";
import { fetchPublicProfiles } from "@/lib/public-profiles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notebooks/")({
  head: () => ({
    meta: [
      { title: "ノート｜Study#" },
      { name: "description", content: "教科ごとに手書きノートを作成・共有できるノート機能。" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: NotebooksPage,
});

type Subject = { id: string; name: string; sort_order: number };
type ShareRow = {
  id: string; notebook_id: string; owner_id: string; user_id: string;
  can_edit: boolean; status: string;
};

function NotebooksPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [invites, setInvites] = useState<(ShareRow & { title?: string; from?: string })[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [filter, setFilter] = useState<string | "all">("all");
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // 新規ノート設定
  const [title, setTitle] = useState("");
  const [cover, setCover] = useState(COVER_COLORS[0]);
  const [paper, setPaper] = useState<PaperType>("ruled");
  const [paperColor, setPaperColor] = useState(PAPER_COLORS[0].key);
  const [newSubject, setNewSubject] = useState<string>("");

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: subs }, { data: nbs }, { data: sh }] = await Promise.all([
      supabase.from("notebook_subjects").select("id,name,sort_order").eq("user_id", user.id).order("sort_order").order("created_at"),
      supabase.from("notebooks").select("*").order("updated_at", { ascending: false }),
      supabase.from("notebook_shares").select("*").eq("user_id", user.id).eq("status", "pending"),
    ]);
    setSubjects((subs as Subject[]) ?? []);
    setNotebooks((nbs as unknown as Notebook[]) ?? []);
    const rows = (sh as unknown as ShareRow[]) ?? [];
    if (rows.length) {
      const profs = await fetchPublicProfiles(rows.map((r) => r.owner_id));
      const { data: titles } = await supabase.from("notebooks").select("id,title").in("id", rows.map((r) => r.notebook_id));
      setInvites(rows.map((r) => ({
        ...r,
        title: (titles as any[])?.find((t) => t.id === r.notebook_id)?.title,
        from: profs.find((p) => p.id === r.owner_id)?.username ?? "ユーザー",
      })));
    } else setInvites([]);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const addSubject = async () => {
    if (!user || !subjectName.trim()) return;
    const { error } = await supabase.from("notebook_subjects").insert({
      user_id: user.id, name: subjectName.trim(), sort_order: subjects.length,
    });
    if (error) return toast.error(error.message);
    setSubjectName("");
    load();
  };

  const removeSubject = async (id: string) => {
    if (!confirm("この教科を削除しますか？（ノートは残ります）")) return;
    await supabase.from("notebook_subjects").delete().eq("id", id);
    load();
  };

  const createNotebook = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notebooks")
      .insert({
        owner_id: user.id,
        title: title.trim() || "新しいノート",
        cover_color: cover,
        paper_type: paper,
        paper_color: paperColor,
        subject_id: newSubject || null,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    await supabase.from("notebook_pages").insert({ notebook_id: (data as any).id, page_index: 0 });
    setTitle("");
    toast.success("ノートを作成しました");
    load();
  };

  const removeNotebook = async (id: string) => {
    if (!confirm("このノートを削除しますか？（元に戻せません）")) return;
    const { error } = await supabase.from("notebooks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const respond = async (id: string, accept: boolean) => {
    const { error } = await supabase.from("notebook_shares").update({ status: accept ? "accepted" : "rejected" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(accept ? "共有を承認しました" : "共有を拒否しました");
    load();
  };

  const visible = notebooks.filter((n) =>
    (showArchived ? n.archived : !n.archived) &&
    (filter === "all" || n.subject_id === filter) &&
    (!q || n.title.toLowerCase().includes(q.toLowerCase())));

  const mine = visible.filter((n) => n.owner_id === user?.id);
  const shared = visible.filter((n) => n.owner_id !== user?.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-3">
        <NotebookPen className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">ノート</h1>
      </div>

      {invites.length > 0 && (
        <Card className="space-y-2 border-primary/40 p-4">
          <h2 className="flex items-center gap-2 font-semibold"><Inbox className="h-4 w-4" />共有の招待</h2>
          {invites.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm">
              <span className="flex-1">
                <b>@{i.from}</b> さんから「{i.title}」の{i.can_edit ? "編集" : "閲覧"}共有
              </span>
              <Button size="sm" onClick={() => respond(i.id, true)}>承認</Button>
              <Button size="sm" variant="outline" onClick={() => respond(i.id, false)}>拒否</Button>
            </div>
          ))}
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <Card className="h-fit space-y-3 p-4">
          <h2 className="font-semibold">教科</h2>
          <div className="flex gap-1.5">
            <Input placeholder="教科名" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubject()} />
            <Button size="icon" onClick={addSubject}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => setFilter("all")}
              className={cn("w-full rounded px-2 py-1.5 text-left text-sm", filter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >すべて</button>
            {subjects.map((s) => (
              <div key={s.id} className="flex items-center gap-1">
                <button
                  onClick={() => setFilter(s.id)}
                  className={cn("flex-1 rounded px-2 py-1.5 text-left text-sm", filter === s.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                >{s.name}</button>
                <button onClick={() => removeSubject(s.id)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="教科を削除">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {subjects.length === 0 && <p className="text-xs text-muted-foreground">まず教科を追加してください</p>}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="space-y-3 p-4">
            <h2 className="font-semibold">新しいノートを作る</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="ノート名（例: 数学I ノート1）" value={title} onChange={(e) => setTitle(e.target.value)} />
              <select
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">教科なし</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">表紙の色</p>
              <div className="flex flex-wrap gap-2">
                {COVER_COLORS.map((c) => (
                  <button key={c} onClick={() => setCover(c)} aria-label={`表紙 ${c}`}
                    className={cn("h-8 w-8 rounded-md border-2", cover === c ? "scale-110 border-foreground" : "border-transparent")}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">紙の形式</p>
              <div className="flex flex-wrap gap-2">
                {PAPER_TYPES.map((p) => (
                  <button key={p.key} onClick={() => setPaper(p.key)}
                    className={cn("rounded-md border px-3 py-1.5 text-xs", paper === p.key ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted")}
                    title={p.note}>{p.label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">紙の色</p>
              <div className="flex flex-wrap gap-2">
                {PAPER_COLORS.map((p) => (
                  <button key={p.key} onClick={() => setPaperColor(p.key)}
                    className={cn("rounded-md border-2 px-3 py-1.5 text-xs", paperColor === p.key ? "border-foreground" : "border-border")}
                    style={{ background: p.key, color: "#111" }}>{p.label}</button>
                ))}
              </div>
            </div>
            <Button onClick={createNotebook}><Plus className="mr-1 h-4 w-4" />ノートを作成</Button>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="ノートを検索" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Button variant={showArchived ? "default" : "outline"} size="sm" onClick={() => setShowArchived((v) => !v)}>
              <Archive className="mr-1 h-4 w-4" />{showArchived ? "アーカイブ表示中" : "アーカイブ"}
            </Button>
          </div>

          <Section title="自分のノート" notebooks={mine} subjects={subjects} onDelete={removeNotebook} />
          <Section title="共有されたノート" notebooks={shared} subjects={subjects} shared />
        </div>
      </div>
    </div>
  );
}

function Section({
  title, notebooks, subjects, onDelete, shared,
}: {
  title: string;
  notebooks: Notebook[];
  subjects: Subject[];
  onDelete?: (id: string) => void;
  shared?: boolean;
}) {
  if (notebooks.length === 0 && shared) return null;
  return (
    <div className="space-y-2">
      <h2 className="font-semibold">{title}</h2>
      {notebooks.length === 0 && <p className="text-sm text-muted-foreground">まだノートがありません。</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {notebooks.map((n) => (
          <div key={n.id} className="group relative">
            <Link to="/notebooks/$id" params={{ id: n.id }} className="block">
              <div
                className="relative aspect-[3/4] overflow-hidden rounded-lg shadow-md transition group-hover:-translate-y-1 group-hover:shadow-xl"
                style={{ background: n.cover_color }}
              >
                <div className="absolute inset-y-0 left-0 w-4 bg-black/25" />
                <div className="absolute inset-x-0 bottom-0 space-y-1 bg-black/30 p-3 text-white backdrop-blur-sm">
                  <p className="line-clamp-2 text-sm font-bold">{n.title}</p>
                  <div className="flex items-center gap-1 text-[11px] opacity-90">
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {subjects.find((s) => s.id === n.subject_id)?.name ?? "教科なし"}
                    </Badge>
                    {shared && <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />共有</span>}
                  </div>
                </div>
              </div>
            </Link>
            {onDelete && (
              <button
                onClick={() => onDelete(n.id)}
                className="absolute right-2 top-2 rounded-md bg-black/40 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="ノートを削除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
