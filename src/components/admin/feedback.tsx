import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListFeedback, adminUpdateFeedback, adminDeleteFeedback, getThreadMessages, postThreadMessage } from "@/lib/feedback.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Send } from "lucide-react";
import { toast } from "sonner";

export function FeedbackTab() {
  const list = useServerFn(adminListFeedback);
  const upd = useServerFn(adminUpdateFeedback);
  const del = useServerFn(adminDeleteFeedback);
  const [items, setItems] = useState<any[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [catFilter, setCatFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const reload = async () => { try { setItems(await list()); } catch (e: any) { toast.error(e.message); } };
  useEffect(() => { reload(); }, []);
  const save = async (id: string, status?: string) => {
    try {
      await upd({ data: { id, status: status as any, adminReply: reply[id] ?? undefined } });
      toast.success("保存しました。送信者に通知が届きます。"); reload();
    } catch (e: any) { toast.error(e.message); }
  };
  const remove = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    try { await del({ data: { id } }); toast.success("削除しました"); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  const CAT_META: Record<string, { label: string; type: "action" | "review" }> = {
    bug: { label: "🐛 バグ", type: "action" },
    feature: { label: "💡 要望", type: "action" },
    question: { label: "❓ 質問", type: "action" },
    praise: { label: "🎉 感想", type: "review" },
    other: { label: "📝 その他", type: "action" },
  };
  const STATUS_META: Record<string, { label: string; cls: string }> = {
    open: { label: "未対応", cls: "bg-amber-500/15 text-amber-700" },
    in_progress: { label: "対応中", cls: "bg-blue-500/15 text-blue-700" },
    resolved: { label: "解決済み", cls: "bg-green-500/15 text-green-700" },
    wontfix: { label: "対応しない", cls: "bg-muted text-muted-foreground" },
  };

  const filtered = items.filter((f) => {
    if (catFilter !== "all" && f.category !== catFilter) return false;
    if (statusFilter === "active" && (f.status === "resolved" || f.status === "wontfix")) return false;
    if (statusFilter === "resolved" && f.status !== "resolved") return false;
    if (statusFilter === "review" && CAT_META[f.category]?.type !== "review") return false;
    return true;
  });

  return (
    <div className="space-y-3 mt-4 max-w-3xl">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">カテゴリ:</span>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {Object.entries(CAT_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">フォルダ:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">📥 受信箱 (未解決)</SelectItem>
              <SelectItem value="resolved">✅ 解決済み</SelectItem>
              <SelectItem value="review">👀 閲覧用 (感想等)</SelectItem>
              <SelectItem value="all">📚 すべて</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-muted-foreground ml-auto">{filtered.length}/{items.length} 件</span>
        <Button size="sm" variant="outline" onClick={async () => {
          const lines = filtered.map((f, i) =>
            `## ${i + 1}. [${(CAT_META[f.category] ?? CAT_META.other).label}] (${f.status})\n` +
            `route: ${f.route ?? "-"}\n` +
            `created: ${new Date(f.created_at).toLocaleString("ja-JP")}\n` +
            `body:\n${f.body}\n` +
            (f.admin_reply ? `admin_reply:\n${f.admin_reply}\n` : ""),
          ).join("\n---\n\n");
          const prompt =
            "以下は Lovable アプリのユーザーフィードバック一覧です。" +
            "重複や類似要望を統合し、優先度（高/中/低）と推定工数、対応案を表形式で整理してください。" +
            "最後に「すぐ修正すべきバグ」「機能要望ロードマップ案」を分けてまとめてください。\n\n" + lines;
          try { await navigator.clipboard.writeText(prompt); toast.success(`${filtered.length}件をAI用プロンプトとしてコピーしました`); }
          catch { toast.error("コピーに失敗しました"); }
        }}>📋 AIプロンプトとしてコピー</Button>
      </div>

      {filtered.map((f) => {
        const cat = CAT_META[f.category] ?? CAT_META.other;
        const st = STATUS_META[f.status] ?? STATUS_META.open;
        const isReview = cat.type === "review";
        return (
          <Card key={f.id} className="p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2 py-0.5 rounded bg-muted">{cat.label}</span>
              <span className={`px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
              <span className="text-muted-foreground">{new Date(f.created_at).toLocaleString("ja-JP")}</span>
              {f.email && <span className="text-muted-foreground">📧 {f.email}</span>}
              {f.route && <span className="text-muted-foreground truncate max-w-[200px]">📍 {f.route}</span>}
              {f.user_notified_at && <span className="text-[10px] text-emerald-600">🔔 通知済</span>}
            </div>
            <div className="text-sm whitespace-pre-wrap">{f.body}</div>
            {!isReview && (
              <>
                <Textarea placeholder="管理者返信メモ（保存すると送信者に通知）" rows={2}
                  defaultValue={f.admin_reply ?? ""}
                  onChange={(e) => setReply((r) => ({ ...r, [f.id]: e.target.value }))} />
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={() => save(f.id, "in_progress")}>対応中にして通知</Button>
                  <Button size="sm" variant="outline" onClick={() => save(f.id, "resolved")}>解決にして通知</Button>
                  <Button size="sm" variant="ghost" onClick={() => save(f.id)}>返信のみ保存</Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(f.id)} className="ml-auto"><Trash2 className="h-3 w-3" /></Button>
                </div>
              </>
            )}
            {isReview && (
              <div className="flex gap-2 justify-end">
                <AdminThreadDialog feedbackId={f.id} />
                <Button size="sm" variant="destructive" onClick={() => remove(f.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            )}
            {!isReview && (
              <div className="flex justify-end -mt-1">
                <AdminThreadDialog feedbackId={f.id} />
              </div>
            )}
          </Card>
        );
      })}
      {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-6">該当するフィードバックはありません</p>}
    </div>
  );
}

export function AdminThreadDialog({ feedbackId }: { feedbackId: string }) {
  const [open, setOpen] = useState(false);
  const get = useServerFn(getThreadMessages);
  const post = useServerFn(postThreadMessage);
  const [data, setData] = useState<any>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try { setData(await get({ data: { feedbackId } })); } catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { if (open) load(); }, [open]);
  const send = async () => {
    if (text.trim().length < 1) return;
    setBusy(true);
    try {
      await post({ data: { feedbackId, body: text.trim() } });
      setText(""); await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary"><Send className="h-3 w-3 mr-1" />チャット</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-sm">ユーザーとのチャット</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto p-4 space-y-2 bg-muted/20">
          {(data?.messages ?? []).map((m: any) => (
            <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${m.sender_role === "admin" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border rounded-bl-sm"}`}>
                <div className="text-[10px] font-semibold opacity-70 mb-1">{m.sender_role === "admin" ? "🛡 管理者(あなた)" : "👤 ユーザー"}</div>
                {m.body}
                <div className="text-[9px] opacity-60 mt-1">{new Date(m.created_at).toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            </div>
          ))}
          {data && data.messages.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">まだメッセージはありません</p>}
        </div>
        <div className="p-2 border-t bg-background flex gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="管理者として返信…" className="resize-none min-h-[40px] max-h-32" />
          <Button onClick={send} disabled={busy || text.trim().length < 1} size="icon"><Send className="h-4 w-4" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


