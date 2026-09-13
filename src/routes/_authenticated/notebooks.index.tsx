import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  NotebookPen,
  Plus,
  Trash2,
  Users,
  Search,
  Inbox,
  Archive,
  ChevronDown,
  ArrowRight,
  Clock3,
  BookOpen,
} from "lucide-react";
import {
  COVER_COLORS,
  PAPER_COLORS,
  PAPER_TYPES,
  type Notebook,
  type PaperType,
} from "@/lib/notebooks";
import { fetchPublicProfiles } from "@/lib/public-profiles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notebooks/")({
  head: () => ({
    meta: [
      { title: "Voton Cnote｜Study#" },
      { name: "description", content: "教科ごとに手書きノートを作成・共有できるノート機能。" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: NotebooksPage,
});

type Subject = { id: string; name: string; sort_order: number };
type ShareRow = {
  id: string;
  notebook_id: string;
  owner_id: string;
  user_id: string;
  can_edit: boolean;
  status: string;
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
  const [showCreate, setShowCreate] = useState(false);

  // 新規ノート設定
  const [title, setTitle] = useState("");
  const [cover, setCover] = useState(COVER_COLORS[0]);
  const [paper, setPaper] = useState<PaperType>("ruled");
  const [paperColor, setPaperColor] = useState(PAPER_COLORS[0].key);
  const [newSubject, setNewSubject] = useState<string>("");

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: subs }, { data: nbs }, { data: sh }] = await Promise.all([
      supabase
        .from("notebook_subjects")
        .select("id,name,sort_order")
        .eq("user_id", user.id)
        .order("sort_order")
        .order("created_at"),
      supabase.from("notebooks").select("*").order("updated_at", { ascending: false }),
      supabase.from("notebook_shares").select("*").eq("user_id", user.id).eq("status", "pending"),
    ]);
    setSubjects((subs as Subject[]) ?? []);
    setNotebooks((nbs as unknown as Notebook[]) ?? []);
    const rows = (sh as unknown as ShareRow[]) ?? [];
    if (rows.length) {
      const profs = await fetchPublicProfiles(rows.map((r) => r.owner_id));
      const { data: titles } = await supabase
        .from("notebooks")
        .select("id,title")
        .in(
          "id",
          rows.map((r) => r.notebook_id),
        );
      setInvites(
        rows.map((r) => ({
          ...r,
          title: (titles as any[])?.find((t) => t.id === r.notebook_id)?.title,
          from: profs.find((p) => p.id === r.owner_id)?.username ?? "ユーザー",
        })),
      );
    } else setInvites([]);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const addSubject = async () => {
    if (!user || !subjectName.trim()) return;
    const { error } = await supabase.from("notebook_subjects").insert({
      user_id: user.id,
      name: subjectName.trim(),
      sort_order: subjects.length,
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
    await supabase
      .from("notebook_pages")
      .insert({ notebook_id: (data as any).id, page_index: 0, title: "ページ 1" });
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
    const { error } = await supabase
      .from("notebook_shares")
      .update({ status: accept ? "accepted" : "rejected" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(accept ? "共有を承認しました" : "共有を拒否しました");
    load();
  };

  const visible = notebooks.filter(
    (n) =>
      (showArchived ? n.archived : !n.archived) &&
      (filter === "all" || n.subject_id === filter) &&
      (!q || n.title.toLowerCase().includes(q.toLowerCase())),
  );

  const mine = visible.filter((n) => n.owner_id === user?.id);
  const shared = visible.filter((n) => n.owner_id !== user?.id);
  const latest = [...visible].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )[0];

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <NotebookPen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Your study desk
            </p>
            <h1 className="text-3xl font-bold tracking-tight">Cnote</h1>
          </div>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)} variant="default" className="h-11 px-5">
          <Plus className="mr-1 h-4 w-4" />
          ノートを作る
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">すべてのノート</span>
            <BookOpen className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {notebooks.filter((n) => !n.archived).length}
            <span className="ml-1 text-sm font-normal text-muted-foreground">冊</span>
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">教科</span>
            <span className="text-xs">整理の軸</span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {subjects.length}
            <span className="ml-1 text-sm font-normal text-muted-foreground">教科</span>
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">共有の招待</span>
            <Inbox className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {invites.length}
            <span className="ml-1 text-sm font-normal text-muted-foreground">件</span>
          </p>
        </div>
      </div>

      {latest && (
        <Link to="/notebooks/$id" params={{ id: latest.id }} className="group block">
          <div className="relative overflow-hidden rounded-2xl border bg-foreground p-5 text-background shadow-xl transition group-hover:-translate-y-0.5 group-hover:shadow-2xl md:p-7">
            <div
              className="absolute right-0 top-0 h-full w-1/3 opacity-20"
              style={{
                background: latest.cover_color,
                clipPath: "polygon(35% 0, 100% 0, 100% 100%, 0 100%)",
              }}
            />
            <div className="relative flex flex-wrap items-end justify-between gap-5">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-medium text-background/60">
                  <Clock3 className="h-3.5 w-3.5" />
                  最近ひらいたノート
                </div>
                <h2 className="max-w-xl text-2xl font-bold tracking-tight md:text-3xl">
                  {latest.title}
                </h2>
                <p className="mt-2 text-sm text-background/65">
                  続きを書く ·{" "}
                  {subjects.find((s) => s.id === latest.subject_id)?.name ?? "教科なし"}
                </p>
              </div>
              <span className="flex items-center gap-2 text-sm font-semibold">
                ノートを開く <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </div>
          </div>
        </Link>
      )}

      {invites.length > 0 && (
        <Card className="space-y-2 border-primary/40 p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Inbox className="h-4 w-4" />
            共有の招待
          </h2>
          {invites.map((i) => (
            <div
              key={i.id}
              className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm"
            >
              <span className="flex-1">
                <b>@{i.from}</b> さんから「{i.title}」の{i.can_edit ? "編集" : "閲覧"}共有
              </span>
              <Button size="sm" onClick={() => respond(i.id, true)}>
                承認
              </Button>
              <Button size="sm" variant="outline" onClick={() => respond(i.id, false)}>
                拒否
              </Button>
            </div>
          ))}
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <Card className="h-fit space-y-3 p-4">
          <h2 className="font-semibold">教科</h2>
          <div className="flex gap-1.5">
            <Input
              placeholder="教科名"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSubject()}
            />
            <Button size="icon" onClick={addSubject}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "w-full rounded px-2 py-1.5 text-left text-sm",
                filter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              すべて
            </button>
            {subjects.map((s) => (
              <div key={s.id} className="flex items-center gap-1">
                <button
                  onClick={() => setFilter(s.id)}
                  className={cn(
                    "flex-1 rounded px-2 py-1.5 text-left text-sm",
                    filter === s.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {s.name}
                </button>
                <button
                  onClick={() => removeSubject(s.id)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                  aria-label="教科を削除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {subjects.length === 0 && (
              <p className="text-xs text-muted-foreground">まず教科を追加してください</p>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="space-y-3 border-primary/15 p-4 shadow-[0_18px_45px_-35px_color-mix(in_oklab,var(--primary)_60%,transparent)]">
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="flex w-full items-center justify-between text-left font-semibold"
              aria-expanded={showCreate}
            >
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                新しいノートを作る
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  showCreate && "rotate-180",
                )}
              />
            </button>
            {showCreate && (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="ノート名（例: 数学I ノート1）"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">教科なし</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">表紙の色</p>
                  <div className="flex flex-wrap gap-2">
                    {COVER_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCover(c)}
                        aria-label={`表紙 ${c}`}
                        className={cn(
                          "h-8 w-8 rounded-md border-2",
                          cover === c ? "scale-110 border-foreground" : "border-transparent",
                        )}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">紙の形式</p>
                  <div className="flex flex-wrap gap-2">
                    {PAPER_TYPES.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setPaper(p.key)}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-xs",
                          paper === p.key
                            ? "border-primary bg-primary/10 font-semibold"
                            : "hover:bg-muted",
                        )}
                        title={p.note}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">紙の色</p>
                  <div className="flex flex-wrap gap-2">
                    {PAPER_COLORS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setPaperColor(p.key)}
                        className={cn(
                          "rounded-md border-2 px-3 py-1.5 text-xs",
                          paperColor === p.key ? "border-foreground" : "border-border",
                        )}
                        style={{ background: p.key, color: "#111" }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={createNotebook}>
                  <Plus className="mr-1 h-4 w-4" />
                  ノートを作成
                </Button>
              </div>
            )}
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="ノートを検索"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">{visible.length}件</span>
            <Button
              variant={showArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchived((v) => !v)}
            >
              <Archive className="mr-1 h-4 w-4" />
              {showArchived ? "アーカイブ表示中" : "アーカイブ"}
            </Button>
          </div>

          <Section
            title="自分のノート"
            notebooks={mine}
            subjects={subjects}
            onDelete={removeNotebook}
          />
          <Section title="共有されたノート" notebooks={shared} subjects={subjects} shared />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  notebooks,
  subjects,
  onDelete,
  shared,
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
      {notebooks.length === 0 && (
        <p className="text-sm text-muted-foreground">まだノートがありません。</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {notebooks.map((n) => (
          <div key={n.id} className="group relative">
            <Link to="/notebooks/$id" params={{ id: n.id }} className="block">
              <div
                className="relative aspect-[3/4] overflow-hidden rounded-lg shadow-md transition group-hover:-translate-y-1 group-hover:shadow-xl"
                aria-label={`${n.title}を開く`}
                style={{ background: n.cover_color }}
              >
                <div className="absolute inset-y-0 left-0 w-4 bg-black/25" />
                <div className="absolute inset-x-0 bottom-0 space-y-1 bg-black/30 p-3 text-white backdrop-blur-sm">
                  <p className="line-clamp-2 text-sm font-bold">{n.title}</p>
                  <div className="flex items-center gap-1 text-[11px] opacity-90">
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {subjects.find((s) => s.id === n.subject_id)?.name ?? "教科なし"}
                    </Badge>
                    {shared && (
                      <span className="flex items-center gap-0.5">
                        <Users className="h-3 w-3" />
                        共有
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
            {onDelete && (
              <button
                onClick={() => onDelete(n.id)}
                className="absolute right-2 top-2 rounded-md bg-black/40 p-1.5 text-white opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100"
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
