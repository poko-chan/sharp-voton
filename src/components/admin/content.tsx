import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Pencil, Plus, Megaphone, Send, HelpCircle } from "lucide-react";
import { toast } from "sonner";

export const TAGS = [
  { value: "update", label: "アップデート", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  { value: "bug", label: "バグ", className: "bg-red-500/15 text-red-600 border-red-500/30" },
  { value: "maintenance", label: "メンテナンス", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  { value: "other", label: "その他", className: "bg-muted text-muted-foreground border-border" },
];
const tagMeta = (v: string) => TAGS.find((t) => t.value === v) ?? TAGS[3];

export function AnnouncementsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("update");
  const [showOnLogin, setShowOnLogin] = useState(false);
  const [publishAt, setPublishAt] = useState(() => {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, body, publish_at, created_at, tag, show_on_login")
      .order("publish_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems(data ?? []);
  };
  useEffect(() => { reload(); }, []);

  const send = async () => {
    if (!title.trim() || !body.trim()) return toast.error("タイトルと本文を入力してください");
    setBusy(true);
    try {
      const iso = new Date(publishAt).toISOString();
      const { error } = await supabase.from("announcements").insert({
        title: title.trim(), body: body.trim(), publish_at: iso, tag, show_on_login: showOnLogin,
      } as any);
      if (error) throw error;
      toast.success("お知らせを送信しました");
      setTitle(""); setBody(""); setShowOnLogin(false);
      reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("削除しました"); reload(); }
  };

  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ title: "", body: "", tag: "update", publishAt: "", showOnLogin: false });
  const openEdit = (a: any) => {
    const d = new Date(a.publish_at); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setEditForm({ title: a.title, body: a.body, tag: a.tag ?? "other", publishAt: d.toISOString().slice(0, 16), showOnLogin: !!a.show_on_login });
    setEditing(a);
  };
  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.title.trim() || !editForm.body.trim()) return toast.error("タイトルと本文を入力してください");
    try {
      const { error } = await supabase.from("announcements").update({
        title: editForm.title.trim(),
        body: editForm.body.trim(),
        tag: editForm.tag,
        publish_at: new Date(editForm.publishAt).toISOString(),
        show_on_login: editForm.showOnLogin,
      } as any).eq("id", editing.id);
      if (error) throw error;
      toast.success("更新しました");
      setEditing(null);
      reload();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-6 space-y-3 max-w-2xl">
        <div className="flex items-center gap-2"><Megaphone className="h-5 w-5" /><h3 className="font-semibold">お知らせを送信</h3></div>
        <div><Label>タイトル</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></div>
        <div>
          <Label>タグ</Label>
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TAGS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>本文</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={5000} /></div>
        <div><Label>送信日時</Label><Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} /></div>
        <p className="text-xs text-muted-foreground">未来の日時を指定すると、その時刻以降にユーザーから見えるようになります。</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showOnLogin} onChange={(e) => setShowOnLogin(e.target.checked)} />
          ログイン画面にも表示する（未ログインのユーザーにも見えます）
        </label>
        <Button onClick={send} disabled={busy}><Send className="h-4 w-4 mr-2" />送信</Button>
      </Card>

      <Card className="p-0 overflow-hidden max-w-3xl">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr className="text-left">
            <th className="p-3">タイトル</th><th className="p-3">公開日時</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t align-top">
                <td className="p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${tagMeta(a.tag).className}`}>{tagMeta(a.tag).label}</span>
                    <span className="font-medium">{a.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 max-w-md">{a.body}</div>
                </td>
                <td className="p-3 whitespace-nowrap text-xs">{new Date(a.publish_at).toLocaleString("ja-JP")}</td>
                <td className="p-3 space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground text-sm">お知らせはまだありません</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>お知らせを編集</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>タイトル</Label><Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} maxLength={200} /></div>
            <div>
              <Label>タグ</Label>
              <Select value={editForm.tag} onValueChange={(v) => setEditForm({ ...editForm, tag: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAGS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>本文</Label><Textarea value={editForm.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} rows={5} maxLength={5000} /></div>
            <div><Label>公開日時</Label><Input type="datetime-local" value={editForm.publishAt} onChange={(e) => setEditForm({ ...editForm, publishAt: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editForm.showOnLogin} onChange={(e) => setEditForm({ ...editForm, showOnLogin: e.target.checked })} />
              ログイン画面にも表示する
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>キャンセル</Button>
            <Button onClick={saveEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


export function FaqTab() {
  const [items, setItems] = useState<any[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const load = async () => {
    const { data } = await supabase.from("faq_entries").select("*").order("order_index");
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!question.trim() || !answer.trim()) return toast.error("質問と回答を入力");
    const { error } = await supabase.from("faq_entries").insert({
      question: question.trim(),
      answer: answer.trim(),
      order_index: items.length,
      published: true,
    });
    if (error) toast.error(error.message); else { setQuestion(""); setAnswer(""); toast.success("追加しました"); load(); }
  };
  const save = async (id: string, patch: any) => {
    const { error } = await supabase.from("faq_entries").update(patch).eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const remove = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    const { error } = await supabase.from("faq_entries").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const move = async (id: string, dir: -1 | 1) => {
    const i = items.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    await supabase.from("faq_entries").update({ order_index: items[j].order_index }).eq("id", items[i].id);
    await supabase.from("faq_entries").update({ order_index: items[i].order_index }).eq("id", items[j].id);
    load();
  };

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-6 max-w-2xl space-y-3 border-emerald-500/30">
        <div className="flex items-center gap-2 text-emerald-600"><HelpCircle className="h-5 w-5" /><h3 className="font-semibold">FAQ を追加</h3></div>
        <p className="text-xs text-muted-foreground">ログイン画面の「ヘルプ」ボタンから誰でも閲覧できます。</p>
        <div><Label>質問</Label><Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="ログインできない時は？" /></div>
        <div><Label>回答</Label><Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} placeholder="まずブラウザを最新にして…" /></div>
        <Button onClick={add} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-1" />追加</Button>
      </Card>
      <Card className="p-0 overflow-hidden max-w-3xl">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr className="text-left">
            <th className="p-3">質問/回答</th><th className="p-3">公開</th><th className="p-3">並び</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.id} className="border-t align-top">
                <td className="p-3 space-y-1">
                  <Input defaultValue={f.question} onBlur={(e) => save(f.id, { question: e.target.value })} />
                  <Textarea rows={3} defaultValue={f.answer} onBlur={(e) => save(f.id, { answer: e.target.value })} />
                </td>
                <td className="p-3"><Switch checked={f.published} onCheckedChange={(v) => save(f.id, { published: v })} /></td>
                <td className="p-3 space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => move(f.id, -1)}>↑</Button>
                  <Button size="sm" variant="outline" onClick={() => move(f.id, 1)}>↓</Button>
                </td>
                <td className="p-3"><Button size="sm" variant="destructive" onClick={() => remove(f.id)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground text-sm">まだ FAQ がありません</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ========== XP/Coin grant popover for user row ==========

export function LoginBoardsTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [overlayOn, setOverlayOn] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "user">("all");
  const [targetUser, setTargetUser] = useState<string>("");

  const load = async () => {
    const { data } = await (supabase as any)
      .from("login_boards").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    const { data: u } = await (supabase as any).from("profiles").select("id,username").limit(200);
    setUsers(u ?? []);
    const { data: s } = await (supabase as any).from("app_settings").select("login_overlay_enabled").limit(1).maybeSingle();
    setOverlayOn(s?.login_overlay_enabled ?? true);
  };
  useEffect(() => { load(); }, []);

  const toggleOverlay = async (v: boolean) => {
    setOverlayOn(v);
    await (supabase as any).from("app_settings").update({ login_overlay_enabled: v }).neq("id", -1);
    toast.success(v ? "ログイン演出をONにしました" : "ログイン演出をOFFにしました（以後/updatesで閲覧）");
  };

  const create = async () => {
    if (!title.trim() || !body.trim()) return toast.error("タイトル・本文を入力");
    if (audience === "user" && !targetUser) return toast.error("対象ユーザーを選択");
    const { error } = await (supabase as any).from("login_boards").insert({
      title, body, audience,
      target_user_id: audience === "user" ? targetUser : null,
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    setTitle(""); setBody(""); setAudience("all"); setTargetUser("");
    toast.success("掲示板を投稿しました"); load();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await (supabase as any).from("login_boards").update({ active }).eq("id", id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await (supabase as any).from("login_boards").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4 pt-4">
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold">ログイン演出（毎ログイン時のWelcome＋掲示板）</div>
            <div className="text-xs text-muted-foreground">OFFにすると以降ログインしたユーザーには出ません。<a className="underline" href="/updates">/updates</a> から詳細閲覧可能。</div>
          </div>
          <Switch checked={overlayOn} onCheckedChange={toggleOverlay} />
        </div>
      </Card>
      <Card className="p-4 space-y-3">
        <div className="font-bold">新規投稿</div>
        <Input placeholder="タイトル" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea rows={5} placeholder="本文（マークダウン不要）" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex gap-2 items-center">
          <Select value={audience} onValueChange={(v: any) => setAudience(v)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全体</SelectItem>
              <SelectItem value="user">個別</SelectItem>
            </SelectContent>
          </Select>
          {audience === "user" && (
            <Select value={targetUser} onValueChange={setTargetUser}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="ユーザーを選択" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.username || u.id.slice(0, 8)}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button onClick={create}>投稿</Button>
        </div>
      </Card>
      <Card className="p-3 space-y-2">
        <div className="font-bold">既存投稿</div>
        {items.length === 0 && <div className="text-xs text-muted-foreground">まだありません</div>}
        {items.map((b) => (
          <div key={b.id} className="border rounded p-3 text-sm space-y-1">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <div className="font-semibold">{b.title} <span className="text-[10px] px-1.5 rounded bg-muted ml-1">{b.audience === "all" ? "全体" : "個別"}</span></div>
                <div className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString("ja-JP")}</div>
                <div className="text-sm whitespace-pre-wrap mt-1">{b.body}</div>
              </div>
              <div className="flex items-center gap-1">
                <Switch checked={b.active} onCheckedChange={(v) => toggleActive(b.id, v)} />
                <Button size="sm" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

