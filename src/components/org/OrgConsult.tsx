import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Send, ShieldAlert } from "lucide-react";
import { INCIDENT_CATEGORIES } from "@/lib/org-school";

export function OrgConsult({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const staff = ctx.isStaff;
  const [rows, setRows] = useState<any[]>([]);
  const [category, setCategory] = useState("bullying");
  const [body, setBody] = useState("");
  const [anon, setAnon] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await (supabase as any)
      .from("org_incidents")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200);
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
  }, [orgId]);

  const submit = async () => {
    if (!body.trim()) return toast.error("内容を入力してください");
    setBusy(true);
    const { error } = await (supabase as any).from("org_incidents").insert({
      organization_id: orgId,
      reporter_id: anon ? null : (user?.id ?? null),
      category,
      body: body.trim(),
      anonymous: anon,
      status: "open",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setBody("");
    load();
    toast.success("送信しました。先生が確認します。");
  };

  const handle = async (id: string, status: string) => {
    const { error } = await (supabase as any)
      .from("org_incidents")
      .update({ status, handled_by: user?.id ?? null, staff_reply: reply[id] ?? null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-2">
        <div className="font-bold text-sm flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          相談・報告する
        </div>
        <div className="flex flex-wrap gap-1">
          {INCIDENT_CATEGORIES.map((c) => (
            <Button
              key={c.key}
              size="sm"
              variant={category === c.key ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </Button>
          ))}
        </div>
        <Textarea
          rows={4}
          placeholder="困っていること、気になることを書いてください。"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex items-center gap-2 text-xs">
          <Switch checked={anon} onCheckedChange={setAnon} />
          匿名で送る（名前は先生にも表示されません）
          <Button size="sm" className="ml-auto" disabled={busy} onClick={submit}>
            <Send className="h-3.5 w-3.5 mr-1" />
            送信
          </Button>
        </div>
      </Card>

      {staff && (
        <div className="space-y-2">
          <div className="font-bold text-sm">届いた相談</div>
          {rows.length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground">まだありません。</Card>
          )}
          {rows.map((r) => (
            <Card key={r.id} className="p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-1.5 rounded bg-muted">
                  {INCIDENT_CATEGORIES.find((c) => c.key === r.category)?.label}
                </span>
                <span>{r.anonymous ? "匿名" : "記名"}</span>
                <span className="text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("ja-JP")}
                </span>
                <span className="ml-auto px-1.5 rounded bg-muted">
                  {r.status === "open" ? "未対応" : r.status === "in_progress" ? "対応中" : "完了"}
                </span>
              </div>
              <div className="text-sm whitespace-pre-wrap">{r.body}</div>
              {r.staff_reply && (
                <div className="text-xs text-muted-foreground">対応メモ: {r.staff_reply}</div>
              )}
              <div className="flex flex-wrap gap-2">
                <Textarea
                  rows={1}
                  className="flex-1 min-w-[200px]"
                  placeholder="対応メモ"
                  value={reply[r.id] ?? ""}
                  onChange={(e) => setReply((s) => ({ ...s, [r.id]: e.target.value }))}
                />
                <Button size="sm" variant="outline" onClick={() => handle(r.id, "in_progress")}>
                  対応中
                </Button>
                <Button size="sm" onClick={() => handle(r.id, "closed")}>
                  完了
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
