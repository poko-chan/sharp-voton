import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Eye, Download, Plus, Check } from "lucide-react";
import { GUIDANCE_CATEGORIES, WATCH_KINDS, downloadCsv } from "@/lib/org-school";

export function OrgMonitor({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const staff = ctx.isStaff;
  const [rows, setRows] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState({ category: "general", body: "" });
  const [flagDraft, setFlagDraft] = useState({ kind: "study", detail: "" });

  const load = async () => {
    const [{ data: ov, error }, { data: f }, { data: n }] = await Promise.all([
      (supabase as any).rpc("org_monitor_overview", { _org: orgId }),
      (supabase as any)
        .from("org_watch_flags")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("org_guidance_notes")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    if (error) toast.error(error.message);
    setRows(ov ?? []);
    setFlags(f ?? []);
    setNotes(n ?? []);
  };
  useEffect(() => {
    if (staff) load();
  }, [orgId, staff]);

  const list = useMemo(
    () => rows.filter((r) => !q.trim() || (r.display_name ?? "").includes(q.trim())),
    [rows, q],
  );
  const selRow = rows.find((r) => r.user_id === sel);

  const addNote = async () => {
    if (!sel || !noteDraft.body.trim()) return toast.error("内容を入力してください");
    const { error } = await (supabase as any).from("org_guidance_notes").insert({
      organization_id: orgId,
      student_id: sel,
      category: noteDraft.category,
      body: noteDraft.body.trim(),
      author_id: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setNoteDraft({ ...noteDraft, body: "" });
    load();
  };

  const addFlag = async () => {
    if (!sel) return;
    const { error } = await (supabase as any).from("org_watch_flags").insert({
      organization_id: orgId,
      student_id: sel,
      kind: flagDraft.kind,
      severity: 2,
      detail: flagDraft.detail || null,
      resolved: false,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setFlagDraft({ ...flagDraft, detail: "" });
    load();
  };

  const resolveFlag = async (id: string) => {
    const { error } = await (supabase as any)
      .from("org_watch_flags")
      .update({ resolved: true })
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  if (!staff)
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        見守り一覧は先生・管理者のみ利用できます。
      </Card>
    );

  return (
    <div className="space-y-4">
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Eye className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold">見守り一覧</span>
        <Input
          className="h-9 w-40 ml-auto"
          placeholder="名前で検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadCsv("monitor.csv", [
              [
                "名前",
                "7日の学習分",
                "30日の学習分",
                "最終学習日",
                "欠席30日",
                "遅刻等30日",
                "未対応の気づき",
              ],
              ...list.map((r) => [
                r.display_name,
                r.minutes_7d,
                r.minutes_30d,
                r.last_studied ?? "",
                r.absents_30d,
                r.lates_30d,
                r.open_flags,
              ]),
            ])
          }
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          CSV
        </Button>
      </Card>

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left p-2">名前</th>
              <th className="p-2">7日</th>
              <th className="p-2">30日</th>
              <th className="p-2">最終学習</th>
              <th className="p-2">欠席</th>
              <th className="p-2">遅刻等</th>
              <th className="p-2">保健</th>
              <th className="p-2">気づき</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const stale =
                !r.last_studied || (Date.now() - new Date(r.last_studied).getTime()) / 86400000 > 7;
              return (
                <tr
                  key={r.user_id}
                  className={`border-t cursor-pointer hover:bg-muted/50 ${sel === r.user_id ? "bg-muted" : ""}`}
                  onClick={() => setSel(r.user_id)}
                >
                  <td className="p-2 font-medium">{r.display_name}</td>
                  <td className={`p-2 text-center ${stale ? "text-destructive font-bold" : ""}`}>
                    {r.minutes_7d}分
                  </td>
                  <td className="p-2 text-center">{r.minutes_30d}分</td>
                  <td className="p-2 text-center">{r.last_studied ?? "—"}</td>
                  <td className="p-2 text-center">{r.absents_30d}</td>
                  <td className="p-2 text-center">{r.lates_30d}</td>
                  <td className="p-2 text-center">{r.health_30d}</td>
                  <td className="p-2 text-center">
                    {r.open_flags > 0 ? (
                      <span className="px-1.5 rounded bg-amber-500/20 text-amber-600">
                        {r.open_flags}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">メンバーがいません。</Card>
        )}
      </div>

      {selRow && (
        <Card className="p-4 space-y-3">
          <div className="font-bold text-sm">{selRow.display_name} さんの記録</div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">気づきメモ（先生のみ）</div>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={flagDraft.kind}
                onChange={(e) => setFlagDraft({ ...flagDraft, kind: e.target.value })}
              >
                {WATCH_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </select>
              <Input
                className="h-9 flex-1 min-w-[160px]"
                placeholder="詳細"
                value={flagDraft.detail}
                onChange={(e) => setFlagDraft({ ...flagDraft, detail: e.target.value })}
              />
              <Button size="sm" onClick={addFlag}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                追加
              </Button>
            </div>
            {flags
              .filter((f) => f.student_id === sel)
              .map((f) => (
                <div key={f.id} className="text-xs flex items-center gap-2 border-b py-1">
                  <span>{WATCH_KINDS.find((k) => k.key === f.kind)?.label}</span>
                  <span className="text-muted-foreground flex-1 truncate">{f.detail}</span>
                  {f.resolved ? (
                    <span className="text-emerald-600">対応済み</span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => resolveFlag(f.id)}>
                      <Check className="h-3 w-3 mr-1" />
                      対応済みに
                    </Button>
                  )}
                </div>
              ))}
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">指導記録（先生のみ）</div>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={noteDraft.category}
                onChange={(e) => setNoteDraft({ ...noteDraft, category: e.target.value })}
              >
                {GUIDANCE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Textarea
                rows={2}
                className="flex-1 min-w-[200px]"
                placeholder="記録内容"
                value={noteDraft.body}
                onChange={(e) => setNoteDraft({ ...noteDraft, body: e.target.value })}
              />
              <Button size="sm" onClick={addNote}>
                保存
              </Button>
            </div>
            {notes
              .filter((n) => n.student_id === sel)
              .map((n) => (
                <div key={n.id} className="text-xs border-b py-1">
                  <span className="px-1.5 rounded bg-muted mr-2">
                    {GUIDANCE_CATEGORIES.find((c) => c.key === n.category)?.label}
                  </span>
                  {n.body}
                  <span className="text-muted-foreground ml-2">
                    {new Date(n.created_at).toLocaleDateString("ja-JP")}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
