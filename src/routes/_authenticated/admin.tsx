import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListUsers, adminCreateUser, adminUpdateUser, adminDeleteUser,
  adminSetRole, adminImpersonate, adminUpdateMaintenance, adminEnsurePokochan,
} from "@/lib/admin.functions";
import { adminListFeedback, adminUpdateFeedback, adminDeleteFeedback, getThreadMessages, postThreadMessage } from "@/lib/feedback.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SERVICES } from "@/lib/restriction-context";

const TAGS = [
  { value: "update", label: "アップデート", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  { value: "bug", label: "バグ", className: "bg-red-500/15 text-red-600 border-red-500/30" },
  { value: "maintenance", label: "メンテナンス", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  { value: "other", label: "その他", className: "bg-muted text-muted-foreground border-border" },
];
const tagMeta = (v: string) => TAGS.find((t) => t.value === v) ?? TAGS[3];
import { Shield, Trash2, Pencil, LogIn, Plus, Wrench, Megaphone, Send, ShoppingBag, Building2, Ticket, Coins, Save } from "lucide-react";
import { Ban, AlertOctagon, HelpCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: (s: Record<string, unknown>) => ({ tab: (s.tab as string) || "users" }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/admin" });
  useEffect(() => { if (!loading && !isAdmin) navigate({ to: "/dashboard" }); }, [isAdmin, loading]);
  if (!isAdmin) return null;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-7 w-7" />
        <h1 className="text-3xl font-bold">管理者ダッシュボード</h1>
      </div>
      <Tabs value={search.tab} onValueChange={(v) => navigate({ to: "/admin", search: { tab: v } as any })}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="users">ユーザー管理</TabsTrigger>
          <TabsTrigger value="maintenance">メンテナンス</TabsTrigger>
          <TabsTrigger value="restrictions" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-600">利用停止</TabsTrigger>
          <TabsTrigger value="shop"><ShoppingBag className="h-3 w-3 mr-1" />ショップ</TabsTrigger>
          <TabsTrigger value="redemptions"><Ticket className="h-3 w-3 mr-1" />引換</TabsTrigger>
          <TabsTrigger value="orgs"><Building2 className="h-3 w-3 mr-1" />組織</TabsTrigger>
          <TabsTrigger value="faq" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600">FAQ</TabsTrigger>
          <TabsTrigger value="nav">サイドバー設定</TabsTrigger>
          <TabsTrigger value="version">バージョン</TabsTrigger>
          <TabsTrigger value="announcements">お知らせ</TabsTrigger>
          <TabsTrigger value="feedback">フィードバック</TabsTrigger>
          <TabsTrigger value="coingrant"><Coins className="h-3 w-3 mr-1" />コイン一括配布</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="maintenance"><MaintenanceTab /></TabsContent>
        <TabsContent value="restrictions"><RestrictionsHub /></TabsContent>
        <TabsContent value="shop"><ShopAdminTab /></TabsContent>
        <TabsContent value="redemptions"><RedemptionsTab /></TabsContent>
        <TabsContent value="orgs"><OrgsAdminTab /></TabsContent>
        <TabsContent value="faq"><FaqTab /></TabsContent>
        <TabsContent value="nav"><NavConfigTab /></TabsContent>
        <TabsContent value="version"><VersionTab /></TabsContent>
        <TabsContent value="announcements"><AnnouncementsTab /></TabsContent>
        <TabsContent value="feedback"><FeedbackTab /></TabsContent>
        <TabsContent value="coingrant"><CoinGrantAllTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function CoinGrantAllTab() {
  const [amount, setAmount] = useState<number>(100);
  const [reason, setReason] = useState<string>("管理者からのプレゼント");
  const [busy, setBusy] = useState(false);
  const grant = async () => {
    if (!confirm(`全ユーザーに ${amount} コインを配布します。よろしいですか？`)) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("admin_grant_coins_to_all", { _amount: amount, _reason: reason });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${data ?? 0} 人に配布しました`);
  };
  return (
    <Card className="p-6 max-w-xl space-y-3">
      <div className="flex items-center gap-2 font-bold"><Coins className="h-5 w-5 text-amber-500" />全ユーザーへコイン一括配布</div>
      <div className="text-xs text-muted-foreground">保護者アカウント以外のすべてのユーザーに、同じ金額を一度に付与します。</div>
      <div>
        <Label>金額（負数で回収も可）</Label>
        <Input type="number" value={amount} onChange={(e) => setAmount(parseInt(e.target.value) || 0)} />
      </div>
      <div>
        <Label>理由・メッセージ</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例: イベント報酬" />
      </div>
      <Button onClick={grant} disabled={busy || !amount}><Coins className="h-4 w-4 mr-1" />配布する</Button>
    </Card>
  );
}

const NAV_KEYS: Array<{ key: string; defaultLabel: string }> = [
  { key: "/dashboard", defaultLabel: "ダッシュボード / ホーム" },
  { key: "/today", defaultLabel: "今日" },
  { key: "/study", defaultLabel: "勉強" },
  { key: "/timer", defaultLabel: "タイマー" },
  { key: "/calendar", defaultLabel: "カレンダー" },
  { key: "/goals", defaultLabel: "目標" },
  { key: "/habits", defaultLabel: "習慣" },
  { key: "/streak", defaultLabel: "連続" },
  { key: "/flashcards", defaultLabel: "暗記" },
  { key: "/ocr", defaultLabel: "OCR" },
  { key: "/friends", defaultLabel: "フレンド" },
  { key: "/rooms", defaultLabel: "勉強ルーム" },
  { key: "/polls", defaultLabel: "投票" },
  { key: "/questions", defaultLabel: "問題" },
  { key: "/practice", defaultLabel: "演習" },
  { key: "/tutor", defaultLabel: "AIチューター" },
  { key: "/coach", defaultLabel: "AIコーチ" },
  { key: "/micro", defaultLabel: "マイクロ学習" },
  { key: "/listen", defaultLabel: "リスニング" },
  { key: "/classroom", defaultLabel: "教室" },
  { key: "/chat", defaultLabel: "チャット" },
  { key: "/classchat", defaultLabel: "クラスチャット" },
  { key: "/notes", defaultLabel: "ノート" },
  { key: "/announcements", defaultLabel: "お知らせ" },
  { key: "/missions", defaultLabel: "ミッション" },
  { key: "/leaderboard", defaultLabel: "ランキング" },
  { key: "/settings", defaultLabel: "設定" },
];

function NavConfigTab() {
  const [rows, setRows] = useState<Record<string, any>>({});
  const load = async () => {
    const { data } = await supabase.from("admin_nav_config").select("*");
    const m: Record<string, any> = {};
    for (const r of data ?? []) m[(r as any).key] = r;
    setRows(m);
  };
  useEffect(() => { load(); }, []);
  const save = async (key: string, patch: any) => {
    const current = rows[key] ?? { key, label: null, icon_url: null, visible: true, in_quickbar: false, order_idx: 100 };
    const next = { ...current, ...patch, key };
    setRows((s) => ({ ...s, [key]: next }));
    const { error } = await supabase.from("admin_nav_config").upsert(next, { onConflict: "key" });
    if (error) toast.error(error.message);
  };
  return (
    <div className="mt-4 space-y-2">
      <p className="text-sm text-muted-foreground">表示/非表示・名前・アイコン画像URL・並び順・クイックバー登録を編集できます。</p>
      <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground px-2">
        <div className="col-span-3">項目</div>
        <div className="col-span-3">表示名</div>
        <div className="col-span-3">アイコンURL</div>
        <div className="col-span-1">並び</div>
        <div className="col-span-1 text-center">表示</div>
        <div className="col-span-1 text-center">Quick</div>
      </div>
      {NAV_KEYS.map((n) => {
        const r = rows[n.key] ?? {};
        return (
          <div key={n.key} className="grid grid-cols-12 gap-2 items-center bg-card border rounded p-2">
            <div className="col-span-3 text-sm">
              <div className="font-medium truncate">{n.defaultLabel}</div>
              <code className="text-[10px] text-muted-foreground">{n.key}</code>
            </div>
            <div className="col-span-3"><Input defaultValue={r.label ?? ""} placeholder={n.defaultLabel} onBlur={(e) => save(n.key, { label: e.target.value || null })} className="h-8" /></div>
            <div className="col-span-3"><Input defaultValue={r.icon_url ?? ""} placeholder="https://..." onBlur={(e) => save(n.key, { icon_url: e.target.value || null })} className="h-8" /></div>
            <div className="col-span-1"><Input type="number" defaultValue={r.order_idx ?? 100} onBlur={(e) => save(n.key, { order_idx: parseInt(e.target.value, 10) || 100 })} className="h-8" /></div>
            <div className="col-span-1 flex justify-center"><Switch checked={r.visible !== false} onCheckedChange={(v) => save(n.key, { visible: v })} /></div>
            <div className="col-span-1 flex justify-center"><Switch checked={!!r.in_quickbar} onCheckedChange={(v) => save(n.key, { in_quickbar: v })} /></div>
          </div>
        );
      })}
    </div>
  );
}

function UsersTab() {
  return <UsersTabImpl />;
}
function RestrictionsHub() {
  const [inner, setInner] = useState<"global" | "user">("global");
  return (
    <div className="mt-4 space-y-4">
      <Tabs value={inner} onValueChange={(v) => setInner(v as any)}>
        <TabsList>
          <TabsTrigger value="global" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-600">全体停止</TabsTrigger>
          <TabsTrigger value="user" className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600">ユーザー別</TabsTrigger>
        </TabsList>
        <TabsContent value="global"><ServiceStopTab /></TabsContent>
        <TabsContent value="user"><UserRestrictionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
function UsersTabImpl() {
  const list = useServerFn(adminListUsers);
  const create = useServerFn(adminCreateUser);
  const update = useServerFn(adminUpdateUser);
  const del = useServerFn(adminDeleteUser);
  const setRole = useServerFn(adminSetRole);
  const impersonate = useServerFn(adminImpersonate);
  const ensure = useServerFn(adminEnsurePokochan);

  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", username: "", displayName: "", isAdmin: false });

  const reload = async () => { try { setUsers(await list()); } catch (e: any) { toast.error(e.message); } };
  useEffect(() => { reload(); }, []);

  const seed = async () => {
    try { await ensure(); toast.success("ぽこちゃん管理者を作成/確認しました"); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  const submitNew = async () => {
    try { await create({ data: form }); toast.success("作成しました"); setOpen(false); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  const [imp, setImp] = useState<{ open: boolean; userId: string; loading: boolean; status: string }>({ open: false, userId: "", loading: false, status: "" });

  const startImpersonate = (userId: string) => {
    setImp({ open: true, userId, loading: false, status: "" });
  };

  const confirmImpersonate = async () => {
    setImp((s) => ({ ...s, loading: true, status: "セッションを準備中..." }));
    try {
      const r = await impersonate({ data: { userId: imp.userId } });
      if (r.actionLink) {
        setImp((s) => ({ ...s, status: "ログアウト中..." }));
        await supabase.auth.signOut();
        setImp((s) => ({ ...s, status: "切り替えています..." }));
        await new Promise((res) => setTimeout(res, 600));
        window.location.href = r.actionLink;
      }
    } catch (e: any) {
      toast.error(e.message);
      setImp((s) => ({ ...s, loading: false, status: "" }));
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> 新規ユーザー</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>新規ユーザー</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <div><Label>メール</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>パスワード</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div><Label>ユーザー名</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
              <div><Label>表示名</Label><Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></div>
              <label className="flex items-center gap-2"><Switch checked={form.isAdmin} onCheckedChange={(v) => setForm({ ...form, isAdmin: v })} />管理者にする</label>
              <Button onClick={submitNew} className="w-full">作成</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="outline" onClick={seed}>初期管理者(pokochan)を作成</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="p-3">ユーザー</th><th className="p-3">メール</th><th className="p-3">権限</th><th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} user={u} onChange={reload}
                update={update} del={del} setRole={setRole} doImpersonate={startImpersonate} />
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={imp.open} onOpenChange={(o) => !imp.loading && setImp({ ...imp, open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>ユーザーとしてログイン</DialogTitle></DialogHeader>
          {imp.loading ? (
            <div className="py-6 text-center space-y-2">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-muted-foreground">{imp.status}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">選択したユーザーとしてログインします。パスワード不要で切り替えます。</p>
              <Button onClick={confirmImpersonate} className="w-full"><LogIn className="h-4 w-4 mr-2" />ログイン実行</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserRow({ user, onChange, update, del, setRole, doImpersonate }: any) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ username: user.username ?? "", displayName: user.display_name ?? "", email: user.email ?? "", password: "" });
  const save = async () => {
    try {
      const payload: any = { userId: user.id, username: form.username, displayName: form.displayName, email: form.email };
      if (form.password) payload.password = form.password;
      await update({ data: payload }); toast.success("更新しました"); setEdit(false); onChange();
    } catch (e: any) { toast.error(e.message); }
  };
  const remove = async () => {
    if (!confirm(`${user.username} を削除しますか？`)) return;
    try { await del({ data: { userId: user.id } }); toast.success("削除しました"); onChange(); }
    catch (e: any) { toast.error(e.message); }
  };
  const changeRole = async (makeAdmin: boolean) => {
    if (makeAdmin === !!user.isAdmin) return;
    const label = makeAdmin ? "管理者" : "一般";
    if (!confirm(`${user.username} を「${label}」に変更しますか？`)) return;
    try { await setRole({ data: { userId: user.id, makeAdmin } }); toast.success(`${label}に変更しました`); onChange(); }
    catch (e: any) { toast.error(e.message); }
  };

  const isPoko = user.username === "pokochan";
  const isMcjp = typeof user.username === "string" && user.username.toLowerCase().startsWith("mcjp_");
  const locked = isPoko || isMcjp;

  return (
    <tr className="border-t">
      <td className="p-3">
        {edit ? (
          <div className="space-y-1">
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="username" />
            <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="display name" />
          </div>
        ) : (
          <div>
            <div className="font-medium">{user.display_name ?? user.username}{isPoko && <span className="ml-2 text-xs text-muted-foreground">(保護)</span>}</div>
            <div className="text-xs text-muted-foreground">@{user.username}</div>
          </div>
        )}
      </td>
      <td className="p-3">
        {edit ? (
          <div className="space-y-1">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input type="password" placeholder="新パスワード(任意)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
        ) : user.email}
      </td>
      <td className="p-3">
        {locked ? (
          <span className="px-2 py-1 rounded text-xs bg-warning/20 text-warning-foreground inline-flex items-center gap-1"><Shield className="h-3 w-3" />{isMcjp ? "MCJP固定" : "管理者(固定)"}</span>
        ) : (
          <Select value={user.isAdmin ? "admin" : "user"} onValueChange={(v) => changeRole(v === "admin")}>
            <SelectTrigger className={`h-8 w-32 ${user.isAdmin ? "border-amber-500/40 bg-amber-500/10" : ""}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">一般ユーザー</SelectItem>
              <SelectItem value="admin">管理者</SelectItem>
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="p-3 space-x-1 whitespace-nowrap">
        {locked ? (
          <span className="text-xs text-muted-foreground">操作不可</span>
        ) : edit ? (
          <>
            <Button size="sm" onClick={save}>保存</Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>キャンセル</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setEdit(true)}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="outline" onClick={() => doImpersonate(user.id)}><LogIn className="h-3.5 w-3.5" /></Button>
            <UserCoinXpPopover userId={user.id} />
            <Button size="sm" variant="destructive" onClick={remove}><Trash2 className="h-3.5 w-3.5" /></Button>
          </>
        )}
      </td>
    </tr>
  );
}

function MaintenanceTab() {
  const update = useServerFn(adminUpdateMaintenance);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [until, setUntil] = useState("");

  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        setEnabled(!!data.maintenance_mode);
        setMessage(data.maintenance_message ?? "");
        setUntil(data.maintenance_until ? new Date(data.maintenance_until).toISOString().slice(0, 16) : "");
      }
    });
  }, []);

  const save = async () => {
    try {
      await update({ data: {
        enabled, message,
        until: until ? new Date(until).toISOString() : null,
      }});
      toast.success("保存しました");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card className="p-6 mt-4 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2"><Wrench className="h-5 w-5" /><h3 className="font-semibold">メンテナンスモード</h3></div>
      <p className="text-sm text-muted-foreground">
        メンテナンスを有効にすると、一般ユーザーはページ遷移・リロード時に自動ログアウトされ、ログイン画面も封鎖されます。
        管理者のみ右下「管理」ボタンからログイン可能です。
      </p>
      <label className="flex items-center gap-2"><Switch checked={enabled} onCheckedChange={setEnabled} />メンテナンス中にする</label>
      <div><Label>内容</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="システム改善のため..." /></div>
      <div><Label>終了予定時刻</Label><Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} /></div>
      <Button onClick={save}>保存</Button>
    </Card>
  );
}

function VersionTab() {
  const update = useServerFn(adminUpdateMaintenance);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [until, setUntil] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        setEnabled(!!data.maintenance_mode);
        setMessage(data.maintenance_message ?? "");
        setUntil(data.maintenance_until ?? null);
        setAppVersion((data as any).app_version ?? "v1.0.0");
      }
    });
  }, []);

  const save = async () => {
    try {
      await update({ data: { enabled, message, until, appVersion } });
      toast.success("保存しました");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card className="p-6 mt-4 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2"><Wrench className="h-5 w-5" /><h3 className="font-semibold">アプリバージョン</h3></div>
      <div>
        <Label>バージョン</Label>
        <Input value={appVersion} onChange={(e) => setAppVersion(e.target.value)} placeholder="v1.0.0" />
        <p className="text-xs text-muted-foreground mt-1">サイドバーに表示されます。</p>
      </div>
      <Button onClick={save}>保存</Button>
    </Card>
  );
}

function AnnouncementsTab() {
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

function FeedbackTab() {
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

function AdminThreadDialog({ feedbackId }: { feedbackId: string }) {
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


function ServiceStopTab() {
  const [rows, setRows] = useState<Record<string, { restricted: boolean; message: string; restricted_until: string | null }>>({});
  const load = async () => {
    const { data } = await supabase.from("service_restrictions").select("*");
    const map: Record<string, any> = {};
    (data ?? []).forEach((r) => { map[r.service_key] = { restricted: !!r.restricted, message: r.message ?? "", restricted_until: r.restricted_until }; });
    setRows(map);
  };
  useEffect(() => { load(); }, []);
  const save = async (key: string, patch: Partial<{ restricted: boolean; message: string; restricted_until: string | null }>) => {
    const cur = rows[key] ?? { restricted: false, message: "", restricted_until: null };
    const next = { ...cur, ...patch };
    const { error } = await supabase.from("service_restrictions").upsert({
      service_key: key,
      restricted: next.restricted,
      message: next.message || null,
      restricted_until: next.restricted_until,
    });
    if (error) toast.error(error.message); else { setRows((p) => ({ ...p, [key]: next })); }
  };
  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4 max-w-3xl space-y-2 border-red-500/30">
        <div className="flex items-center gap-2 text-red-600"><Ban className="h-5 w-5" /><h3 className="font-semibold">サービス別 利用停止（全ユーザー）</h3></div>
        <p className="text-sm text-muted-foreground">特定のサービス（タイマー・AI家庭教師・Voton Classroom など）を全ユーザーに対して停止します。該当ページに入ると赤いオーバーレイが表示されます。</p>
      </Card>
      <Card className="p-0 overflow-hidden max-w-5xl">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr className="text-left">
            <th className="p-3">サービス</th><th className="p-3">停止</th><th className="p-3">メッセージ</th><th className="p-3">解除予定</th>
          </tr></thead>
          <tbody>
            {SERVICES.map((s) => {
              const r = rows[s.key] ?? { restricted: false, message: "", restricted_until: null };
              return (
                <tr key={s.key} className="border-t align-top">
                  <td className="p-3 font-medium">{s.label}<div className="text-xs text-muted-foreground">{s.key}</div></td>
                  <td className="p-3"><Switch checked={r.restricted} onCheckedChange={(v) => save(s.key, { restricted: v })} /></td>
                  <td className="p-3"><Textarea rows={2} defaultValue={r.message} onBlur={(e) => save(s.key, { message: e.target.value })} placeholder="メンテナンス中です…" /></td>
                  <td className="p-3"><Input type="datetime-local" defaultValue={r.restricted_until ? new Date(r.restricted_until).toISOString().slice(0, 16) : ""} onBlur={(e) => save(s.key, { restricted_until: e.target.value ? new Date(e.target.value).toISOString() : null })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function UserRestrictionsTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [restrictions, setRestrictions] = useState<Record<string, Record<string, any>>>({});
  const [filter, setFilter] = useState("");
  const [selectedService, setSelectedService] = useState<string>(SERVICES[0].key);

  const load = async () => {
    const { data: profiles } = await supabase.from("profiles").select("id, username, display_name, email").order("display_name");
    setUsers(profiles ?? []);
    const { data: rs } = await supabase.from("user_service_restrictions").select("*");
    const map: Record<string, Record<string, any>> = {};
    (rs ?? []).forEach((r) => {
      if (!map[r.user_id]) map[r.user_id] = {};
      map[r.user_id][r.service_key] = r;
    });
    setRestrictions(map);
  };
  useEffect(() => { load(); }, []);

  const save = async (userId: string, patch: Partial<{ restricted: boolean; message: string; restricted_until: string | null }>) => {
    const cur = restrictions[userId]?.[selectedService] ?? { restricted: true, message: "", restricted_until: null };
    const next = { ...cur, ...patch };
    const { error } = await supabase.from("user_service_restrictions").upsert({
      user_id: userId,
      service_key: selectedService,
      restricted: next.restricted,
      message: next.message || null,
      restricted_until: next.restricted_until,
    }, { onConflict: "user_id,service_key" });
    if (error) toast.error(error.message); else load();
  };

  const filtered = users.filter((u) => {
    const q = filter.toLowerCase();
    return !q || (u.username ?? "").toLowerCase().includes(q) || (u.display_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4 max-w-3xl space-y-2 border-blue-500/30">
        <div className="flex items-center gap-2 text-blue-600"><AlertOctagon className="h-5 w-5" /><h3 className="font-semibold">サービス別 個別制限</h3></div>
        <p className="text-sm text-muted-foreground">特定のユーザー × 特定のサービスへのアクセスを制限します。</p>
        <div className="flex gap-2 flex-wrap items-center">
          <Label className="text-xs">対象サービス</Label>
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SERVICES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="ユーザー名・メールで検索" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        </div>
      </Card>
      <Card className="p-0 overflow-hidden max-w-4xl">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr className="text-left">
            <th className="p-3">ユーザー</th><th className="p-3">制限</th><th className="p-3">メッセージ</th><th className="p-3">解除予定</th>
          </tr></thead>
          <tbody>
            {filtered.map((u) => {
              const r = restrictions[u.id]?.[selectedService];
              const restricted = !!r?.restricted;
              return (
                <tr key={u.id + selectedService} className="border-t align-top">
                  <td className="p-3"><div className="font-medium">{u.display_name ?? u.username}</div><div className="text-xs text-muted-foreground">@{u.username}</div></td>
                  <td className="p-3"><Switch checked={restricted} onCheckedChange={(v) => save(u.id, { restricted: v })} /></td>
                  <td className="p-3"><Textarea rows={2} defaultValue={r?.message ?? ""} onBlur={(e) => save(u.id, { message: e.target.value })} placeholder="制限の理由…" /></td>
                  <td className="p-3"><Input type="datetime-local" defaultValue={r?.restricted_until ? new Date(r.restricted_until).toISOString().slice(0, 16) : ""} onBlur={(e) => save(u.id, { restricted_until: e.target.value ? new Date(e.target.value).toISOString() : null })} /></td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground text-sm">ユーザーがいません</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function FaqTab() {
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
function UserCoinXpPopover({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [xp, setXp] = useState<number>(0);
  const [coins, setCoins] = useState<number>(0);
  const [grantAmt, setGrantAmt] = useState<number>(100);
  const [grantMsg, setGrantMsg] = useState<string>("");

  const load = async () => {
    const [{ data: x }, { data: c }] = await Promise.all([
      (supabase as any).from("makron_xp").select("xp").eq("user_id", userId).maybeSingle(),
      supabase.from("user_coins").select("balance").eq("user_id", userId).maybeSingle(),
    ]);
    setXp(x?.xp ?? 0); setCoins(c?.balance ?? 0);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" title="XP / コイン編集"><Coins className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>XP / コイン編集</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>XP (絶対値で上書き)</Label>
            <div className="flex gap-2">
              <Input type="number" value={xp} onChange={(e) => setXp(Number(e.target.value) || 0)} />
              <Button onClick={async () => {
                const { error } = await (supabase as any).rpc("admin_set_user_xp", { _user_id: userId, _xp: xp });
                if (error) return toast.error(error.message);
                toast.success("XPを更新しました");
              }}><Save className="h-4 w-4" /></Button>
            </div>
          </div>
          <div>
            <Label>コイン残高 (絶対値で上書き)</Label>
            <div className="flex gap-2">
              <Input type="number" value={coins} onChange={(e) => setCoins(Number(e.target.value) || 0)} />
              <Button onClick={async () => {
                const { error } = await (supabase as any).rpc("admin_set_user_coins", { _user_id: userId, _balance: coins });
                if (error) return toast.error(error.message);
                toast.success("コインを更新しました");
              }}><Save className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="border-t pt-3 space-y-2">
            <Label>コインを贈呈 (加算 / メッセージ付き通知)</Label>
            <Input type="number" placeholder="金額" value={grantAmt} onChange={(e) => setGrantAmt(Number(e.target.value) || 0)} />
            <Input placeholder="メッセージ" value={grantMsg} onChange={(e) => setGrantMsg(e.target.value)} />
            <Button className="w-full" onClick={async () => {
              const { error } = await (supabase as any).rpc("admin_grant_coins", { _user_id: userId, _amount: grantAmt, _message: grantMsg });
              if (error) return toast.error(error.message);
              toast.success("コインを贈呈しました"); load(); setGrantMsg("");
            }}><Coins className="h-4 w-4 mr-1" />贈呈</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ========== Shop admin ==========
function ShopAdminTab() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const blank = () => ({ id: null, code: "", name: "", description: "", price: 100, category: "decor", payload: {}, is_active: true, consumable: false, auto_grant: true, sort_order: 100 });
  const load = async () => {
    const { data } = await (supabase as any).from("coin_shop_items").select("*").order("sort_order").order("created_at");
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!editing.code.trim() || !editing.name.trim()) return toast.error("コードと名前は必須");
    const { error } = await (supabase as any).rpc("admin_upsert_shop_item", {
      _id: editing.id, _code: editing.code, _name: editing.name, _description: editing.description || null,
      _price: Number(editing.price) || 0, _category: editing.category, _payload: editing.payload ?? {},
      _is_active: editing.is_active, _consumable: editing.consumable, _auto_grant: editing.auto_grant,
      _sort_order: Number(editing.sort_order) || 100,
    });
    if (error) return toast.error(error.message);
    toast.success("保存しました"); setEditing(null); load();
  };
  const del = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    const { error } = await (supabase as any).from("coin_shop_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  return (
    <div className="space-y-3 mt-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">アイテムの金額編集・非表示・カスタム商品（LINEポイント交換など）の追加ができます。</p>
        <Button onClick={() => setEditing(blank())}><Plus className="h-4 w-4 mr-1" />新規アイテム</Button>
      </div>
      {editing && (
        <Card className="p-4 space-y-2 border-primary/40">
          <div className="font-bold">{editing.id ? "編集" : "新規追加"}</div>
          <div className="grid md:grid-cols-2 gap-2">
            <div><Label>コード (一意・英数)</Label><Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></div>
            <div><Label>名前</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>説明</Label><Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div><Label>金額 (コイン)</Label><Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
            <div><Label>カテゴリ</Label>
              <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    { v: "frame", l: "フレーム" }, { v: "theme", l: "テーマ" }, { v: "title", l: "称号" },
                    { v: "decor", l: "デコ" }, { v: "hint", l: "ヒント券" }, { v: "revive", l: "復活" },
                    { v: "chest", l: "宝箱" }, { v: "boost", l: "ブースト" }, { v: "scratch", l: "計算用紙" },
                    { v: "emoji", l: "絵文字" }, { v: "redeem", l: "引換 (LINEポイント等)" }, { v: "other", l: "その他" },
                  ].map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>並び順</Label><Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></div>
            <label className="flex items-center gap-2"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />表示する</label>
            <label className="flex items-center gap-2"><Switch checked={editing.consumable} onCheckedChange={(v) => setEditing({ ...editing, consumable: v })} />消耗品（複数購入可）</label>
            <label className="flex items-center gap-2 md:col-span-2"><Switch checked={editing.auto_grant} onCheckedChange={(v) => setEditing({ ...editing, auto_grant: v })} />自動付与（OFF = 引き換え式：購入時に管理者へ通知。LINEポイント等の手動対応用）</label>
          </div>
          <div className="flex gap-2"><Button onClick={save}><Save className="h-4 w-4 mr-1" />保存</Button><Button variant="ghost" onClick={() => setEditing(null)}>キャンセル</Button></div>
        </Card>
      )}
      <Card className="divide-y">
        {items.map((it) => (
          <div key={it.id} className="p-3 flex items-center gap-2 text-sm">
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2">{it.name}
                {!it.is_active && <span className="text-[10px] px-1.5 rounded bg-muted">非表示</span>}
                {!it.auto_grant && <span className="text-[10px] px-1.5 rounded bg-violet-500/15 text-violet-600">引換</span>}
                {it.is_custom && <span className="text-[10px] px-1.5 rounded bg-amber-500/15 text-amber-600">カスタム</span>}
              </div>
              <div className="text-xs text-muted-foreground">{it.code} ・ {it.category} ・ {it.price}コイン</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing(it)}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(it.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
        {items.length === 0 && <div className="p-6 text-sm text-center text-muted-foreground">アイテムはありません</div>}
      </Card>
    </div>
  );
}

// ========== Redemption requests ==========
function RedemptionsTab() {
  const [list, setList] = useState<any[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const load = async () => {
    const { data } = await (supabase as any).from("coin_redemption_requests")
      .select("*, profile:profiles!coin_redemption_requests_user_id_fkey(username, display_name)")
      .order("created_at", { ascending: false }).limit(100);
    setList(data ?? []);
  };
  useEffect(() => { load(); }, []);
  const act = async (id: string, approve: boolean) => {
    const { error } = await (supabase as any).rpc("admin_fulfill_redemption", { _req_id: id, _approve: approve, _note: note[id] ?? null });
    if (error) return toast.error(error.message);
    toast.success(approve ? "完了処理しました" : "却下＆返金しました"); load();
  };
  return (
    <div className="space-y-3 mt-4">
      <p className="text-sm text-muted-foreground">引き換え式アイテムの購入リクエスト。LINEポイントの送付などを行ったら「完了」、対応不可なら「却下＆返金」。</p>
      {list.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">リクエストはありません</Card>}
      {list.map((r: any) => (
        <Card key={r.id} className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className={`text-[10px] px-2 py-0.5 rounded ${r.status==='pending'?'bg-amber-500/15 text-amber-600':r.status==='fulfilled'?'bg-success/15 text-success':'bg-destructive/15 text-destructive'}`}>{r.status}</span>
            <span className="font-bold">{r.item_name}</span>
            <span className="text-xs text-muted-foreground">{r.price_paid}コイン</span>
            <span className="text-xs text-muted-foreground ml-auto">{new Date(r.created_at).toLocaleString("ja-JP")}</span>
          </div>
          <div className="text-xs">購入者: {r.profile?.display_name ?? r.profile?.username ?? r.user_id.slice(0,8)}</div>
          {r.payload && Object.keys(r.payload).length > 0 && <div className="text-[10px] text-muted-foreground bg-muted p-2 rounded">{JSON.stringify(r.payload)}</div>}
          {r.status === 'pending' && (
            <div className="flex gap-2 items-center">
              <Input placeholder="管理者メモ（任意）" value={note[r.id] ?? ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} className="flex-1" />
              <Button size="sm" onClick={() => act(r.id, true)}>完了</Button>
              <Button size="sm" variant="outline" onClick={() => act(r.id, false)}>却下&返金</Button>
            </div>
          )}
          {r.admin_note && <div className="text-[10px] text-muted-foreground">メモ: {r.admin_note}</div>}
        </Card>
      ))}
    </div>
  );
}

// ========== Organizations admin ==========
function OrgsAdminTab() {
  const [pending, setPending] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const load = async () => {
    const { data: p } = await (supabase as any).from("organizations")
      .select("*, profile:profiles!organizations_created_by_fkey(username, display_name)")
      .eq("status", "pending").order("created_at", { ascending: false });
    setPending(p ?? []);
    const { data: a } = await (supabase as any).from("organizations").select("*").order("created_at", { ascending: false }).limit(50);
    setOrgs(a ?? []);
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!name.trim()) return;
    const { error } = await (supabase as any).from("organizations").insert({ name, description: desc || null, status: "approved" });
    if (error) return toast.error(error.message);
    setName(""); setDesc(""); toast.success("組織を作成しました"); load();
  };
  const review = async (id: string, approve: boolean) => {
    const { error } = await (supabase as any).rpc("admin_review_organization", { _org_id: id, _approve: approve });
    if (error) return toast.error(error.message);
    toast.success(approve ? "承認しました" : "却下しました"); load();
  };
  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4 space-y-2">
        <div className="font-bold flex items-center gap-1"><Plus className="h-4 w-4" />新規組織を作成（管理者のみ）</div>
        <Input placeholder="組織名" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea rows={2} placeholder="説明" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Button onClick={create}>作成</Button>
      </Card>
      {pending.length > 0 && (
        <Card className="p-3 space-y-2">
          <div className="font-bold">審査待ち ({pending.length})</div>
          {pending.map((o: any) => (
            <div key={o.id} className="flex items-center gap-2 border rounded p-2 text-sm">
              <div className="flex-1">
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-muted-foreground">{o.description} ・ 申請者 {o.profile?.display_name ?? o.profile?.username}</div>
              </div>
              <Button size="sm" onClick={() => review(o.id, true)}>承認</Button>
              <Button size="sm" variant="outline" onClick={() => review(o.id, false)}>却下</Button>
            </div>
          ))}
        </Card>
      )}
      <Card className="p-3 space-y-2">
        <div className="font-bold">既存組織</div>
        {orgs.map((o: any) => (
          <div key={o.id} className="flex items-center gap-2 border rounded p-2 text-sm">
            <div className="flex-1">
              <div className="font-medium">{o.name} <span className="text-[10px] px-1.5 rounded bg-muted ml-1">{o.status}</span></div>
              <div className="text-xs text-muted-foreground">{o.description}</div>
            </div>
            <a href={`/organizations/${o.id}`} className="text-sm underline">管理 →</a>
          </div>
        ))}
      </Card>
    </div>
  );
}
