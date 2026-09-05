import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Plus, Share2, Save, Trash2, Archive, Settings2,
} from "lucide-react";
import { NoteCanvas } from "@/components/notebook/NoteCanvas";
import { NoteShell } from "@/components/notebook/NoteShell";
import {
  PAPER_COLORS, PAPER_TYPES, type Notebook, type NotePage, type PaperType,
  type Stroke, type TextBox,
} from "@/lib/notebooks";
import { fetchPublicProfiles, searchPublicProfiles, type PublicProfile } from "@/lib/public-profiles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notebooks/$id")({
  head: () => ({
    meta: [
      { title: "ノートを書く｜Voton Cnote" },
      { name: "description", content: "手書きとテキストで書けるノートエディタ。" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: NotebookEditor,
});

type ShareRow = { id: string; user_id: string; can_edit: boolean; status: string };

function NotebookEditor() {
  const { id } = useParams({ from: "/_authenticated/notebooks/$id" });
  const { user } = useAuth();
  const [nb, setNb] = useState<Notebook | null>(null);
  const [pages, setPages] = useState<NotePage[]>([]);
  const [idx, setIdx] = useState(0);
  const [shares, setShares] = useState<(ShareRow & { profile?: PublicProfile })[]>([]);
  const [username, setUsername] = useState("");
  const [canEditShare, setCanEditShare] = useState(true);
  const [saving, setSaving] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const { data: n, error } = await supabase.from("notebooks").select("*").eq("id", id).maybeSingle();
    if (error || !n) { setLoading(false); return; }
    setNb(n as unknown as Notebook);
    const { data: ps } = await supabase
      .from("notebook_pages").select("*").eq("notebook_id", id).order("page_index");
    let list = ((ps as any[]) ?? []).map((p) => ({
      id: p.id, page_index: p.page_index,
      strokes: (p.strokes ?? []) as Stroke[], texts: (p.texts ?? []) as TextBox[],
    })) as NotePage[];
    if (list.length === 0) {
      const { data: created } = await supabase.from("notebook_pages").insert({ notebook_id: id, page_index: 0 }).select().single();
      if (created) list = [{ id: (created as any).id, page_index: 0, strokes: [], texts: [] }];
    }
    setPages(list);
    const { data: sh } = await supabase.from("notebook_shares").select("*").eq("notebook_id", id);
    const rows = (sh as unknown as ShareRow[]) ?? [];
    const profs = rows.length ? await fetchPublicProfiles(rows.map((r) => r.user_id)) : [];
    setShares(rows.map((r) => ({ ...r, profile: profs.find((p) => p.id === r.user_id) })));
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isOwner = nb?.owner_id === user?.id;
  const myShare = shares.find((s) => s.user_id === user?.id && s.status === "accepted");
  const readOnly = !isOwner && !(myShare?.can_edit ?? false);
  const page = pages[idx];

  const savePage = useCallback(async (p: NotePage) => {
    setSaving("saving");
    const { error } = await supabase
      .from("notebook_pages")
      .update({ strokes: p.strokes as any, texts: p.texts as any, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq("id", p.id);
    if (error) { setSaving("dirty"); toast.error("保存に失敗しました"); return; }
    await supabase.from("notebooks").update({ updated_at: new Date().toISOString() }).eq("id", id);
    setSaving("saved");
  }, [id, user?.id]);

  const onChange = (next: { strokes: Stroke[]; texts: TextBox[] }) => {
    if (!page) return;
    const updated = { ...page, ...next };
    setPages((prev) => prev.map((p) => (p.id === page.id ? updated : p)));
    setSaving("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => savePage(updated), 1200);
  };

  const addPage = async () => {
    const nextIdx = (pages.at(-1)?.page_index ?? -1) + 1;
    const { data, error } = await supabase.from("notebook_pages").insert({ notebook_id: id, page_index: nextIdx }).select().single();
    if (error) return toast.error(error.message);
    setPages((p) => [...p, { id: (data as any).id, page_index: nextIdx, strokes: [], texts: [] }]);
    setIdx(pages.length);
  };

  const deletePage = async () => {
    if (!page || pages.length <= 1) return toast.error("最後のページは削除できません");
    if (!confirm("このページを削除しますか？")) return;
    await supabase.from("notebook_pages").delete().eq("id", page.id);
    setPages((p) => p.filter((x) => x.id !== page.id));
    setIdx((i) => Math.max(0, i - 1));
  };

  const patchNotebook = async (patch: Partial<Notebook>) => {
    if (!nb) return;
    setNb({ ...nb, ...patch } as Notebook);
    const { error } = await supabase.from("notebooks").update(patch as any).eq("id", nb.id);
    if (error) toast.error(error.message);
  };

  const invite = async () => {
    if (!nb || !username.trim()) return;
    const found = await searchPublicProfiles(username.trim().replace(/^@/, ""));
    const target = found.find((p) => (p.username ?? "").toLowerCase() === username.trim().replace(/^@/, "").toLowerCase()) ?? found[0];
    if (!target) return toast.error("そのユーザー名は見つかりませんでした");
    if (target.id === user?.id) return toast.error("自分自身には共有できません");
    const { error } = await supabase.from("notebook_shares").insert({
      notebook_id: nb.id, owner_id: nb.owner_id, user_id: target.id, can_edit: canEditShare, status: "pending",
    });
    if (error) return toast.error(error.code === "23505" ? "すでに共有済みです" : error.message);
    toast.success(`@${target.username} に共有を申請しました（承認待ち）`);
    setUsername("");
    load();
  };

  const removeShare = async (sid: string) => {
    await supabase.from("notebook_shares").delete().eq("id", sid);
    load();
  };

  if (loading) return <div className="p-8 text-muted-foreground">読み込み中...</div>;
  if (!nb) {
    return (
      <div className="space-y-3 p-8">
        <p>ノートが見つからないか、閲覧権限がありません。</p>
        <Link to="/notebooks"><Button variant="outline"><ArrowLeft className="mr-1 h-4 w-4" />ノート一覧へ</Button></Link>
      </div>
    );
  }

  return (
    <NoteShell
      back="/notebooks"
      title={
        <span className="flex items-center gap-2">
          <span className="h-4 w-1.5 rounded" style={{ background: nb.cover_color }} />
          <Input
            value={nb.title}
            readOnly={readOnly}
            onChange={(e) => setNb({ ...nb, title: e.target.value })}
            onBlur={() => patchNotebook({ title: nb.title })}
            className="h-8 max-w-[220px] border-transparent bg-transparent px-1 font-semibold focus-visible:border-input"
          />
          <Badge variant="secondary" className="hidden sm:inline-flex">{PAPER_TYPES.find((p) => p.key === nb.paper_type)?.label}</Badge>
          {readOnly && <Badge>閲覧のみ</Badge>}
        </span>
      }
      subtitle={saving === "saving" ? "保存中..." : saving === "saved" ? "保存済み" : saving === "dirty" ? "未保存の変更" : `${idx + 1} / ${pages.length} ページ`}
      right={
        <div className="flex items-center gap-1">
          {!readOnly && page && (
            <Button size="sm" variant="outline" onClick={() => savePage(page)}><Save className="mr-1 h-4 w-4" />保存</Button>
          )}
          {isOwner && (
            <Button size="sm" variant="outline" onClick={() => setShowSettings((v) => !v)}>
              <Settings2 className="mr-1 h-4 w-4" />設定
            </Button>
          )}
        </div>
      }
    >
      <div className="relative flex h-full min-h-0 flex-col">
      {showSettings && isOwner && (
        <Card className="absolute right-2 top-2 z-20 max-h-[80%] w-[min(420px,92vw)] space-y-4 overflow-y-auto p-4 shadow-2xl">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">紙の形式</p>
            <div className="flex flex-wrap gap-2">
              {PAPER_TYPES.map((p) => (
                <button key={p.key} onClick={() => patchNotebook({ paper_type: p.key as PaperType })}
                  className={cn("rounded-md border px-3 py-1.5 text-xs", nb.paper_type === p.key ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted")}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">紙の色</p>
            <div className="flex flex-wrap gap-2">
              {PAPER_COLORS.map((p) => (
                <button key={p.key} onClick={() => patchNotebook({ paper_color: p.key })}
                  className={cn("rounded-md border-2 px-3 py-1.5 text-xs", nb.paper_color === p.key ? "border-foreground" : "border-border")}
                  style={{ background: p.key, color: "#111" }}>{p.label}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="flex items-center gap-1 text-sm font-semibold"><Share2 className="h-4 w-4" />ユーザー名で共有（承認制）</p>
            <div className="flex flex-wrap gap-2">
              <Input placeholder="@ユーザー名" value={username} onChange={(e) => setUsername(e.target.value)} className="max-w-xs" />
              <Button variant={canEditShare ? "default" : "outline"} size="sm" onClick={() => setCanEditShare((v) => !v)}>
                {canEditShare ? "編集可" : "閲覧のみ"}
              </Button>
              <Button size="sm" onClick={invite}>共有を申請</Button>
            </div>
            <div className="space-y-1">
              {shares.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded border p-2 text-sm">
                  <span className="flex-1">@{s.profile?.username ?? "ユーザー"}</span>
                  <Badge variant={s.status === "accepted" ? "default" : "secondary"}>
                    {s.status === "accepted" ? "承認済み" : s.status === "pending" ? "承認待ち" : "拒否"}
                  </Badge>
                  <Badge variant="outline">{s.can_edit ? "編集可" : "閲覧のみ"}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => removeShare(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {shares.length === 0 && <p className="text-xs text-muted-foreground">まだ共有していません。</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => patchNotebook({ archived: !nb.archived })}>
            <Archive className="mr-1 h-4 w-4" />{nb.archived ? "アーカイブを解除" : "アーカイブする"}
          </Button>
        </Card>
      )}

      <div className="min-h-0 flex-1">
        {page && (
          <NoteCanvas
          key={page.id}
          strokes={page.strokes}
          texts={page.texts}
          paper={nb.paper_type}
          paperColor={nb.paper_color}
          readOnly={readOnly}
            onChange={onChange}
            title={nb.title}
          />
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t bg-card/70 px-3 py-2">
        <Button variant="outline" size="sm" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
          <ChevronLeft className="h-4 w-4" />前
        </Button>
        <div className="flex flex-wrap gap-1">
          {pages.map((p, i) => (
            <button key={p.id} onClick={() => setIdx(i)}
              className={cn("h-8 w-8 rounded border text-xs", i === idx ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {i + 1}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setIdx((i) => Math.min(pages.length - 1, i + 1))} disabled={idx >= pages.length - 1}>
          次<ChevronRight className="h-4 w-4" />
        </Button>
        {!readOnly && <Button size="sm" onClick={addPage}><Plus className="mr-1 h-4 w-4" />ページ追加</Button>}
        {!readOnly && <Button size="sm" variant="ghost" className="text-destructive" onClick={deletePage}><Trash2 className="mr-1 h-4 w-4" />ページ削除</Button>}
      </div>
      </div>
    </NoteShell>
  );
}
