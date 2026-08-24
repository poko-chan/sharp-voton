import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListUsers, adminCreateUser, adminUpdateUser, adminDeleteUser, adminSetRole, adminImpersonate, adminEnsurePokochan, adminSetUserSuspended } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Shield, Trash2, Pencil, LogIn, Plus, Coins, Save, Ban, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export function UsersTab() {
  return <UsersTabImpl />;
}

export function UsersTabImpl() {
  const list = useServerFn(adminListUsers);
  const create = useServerFn(adminCreateUser);
  const update = useServerFn(adminUpdateUser);
  const del = useServerFn(adminDeleteUser);
  const setRole = useServerFn(adminSetRole);
  const setSuspended = useServerFn(adminSetUserSuspended);
  const impersonate = useServerFn(adminImpersonate);
  const ensure = useServerFn(adminEnsurePokochan);

  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", username: "", displayName: "", isAdmin: false });

  const reload = async () => {
    try {
      const r = await list({ data: { search: search || undefined, page, pageSize } });
      setUsers(r.users); setTotal(r.total);
    } catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { reload(); }, [page, search]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(0); setSearch(searchInput.trim()); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const toggleSuspend = async (u: any) => {
    const next = !u.isSuspended;
    if (!confirm(`${u.username} を${next ? "利用停止" : "利用停止解除"}にしますか？`)) return;
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isSuspended: next } : x)));
    try {
      await setSuspended({ data: { userId: u.id, suspended: next } });
      toast.success(next ? "利用停止にしました" : "利用停止を解除しました");
    } catch (e: any) {
      toast.error(e.message);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isSuspended: !next } : x)));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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

      <div className="flex gap-2 items-center">
        <Input placeholder="ユーザー名・表示名・メールで検索…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="max-w-sm" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">{total.toLocaleString()} 人</span>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="p-3">ユーザー</th><th className="p-3">メール</th><th className="p-3">権限</th><th className="p-3">状態</th><th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} user={u} onChange={reload}
                update={update} del={del} setRole={setRole} doImpersonate={startImpersonate} toggleSuspend={toggleSuspend} />
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-center gap-3">
        <Button size="sm" variant="outline" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
        <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

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

export function UserRow({ user, onChange, update, del, setRole, doImpersonate, toggleSuspend }: any) {
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
      <td className="p-3">
        {user.isSuspended ? (
          <span className="px-2 py-1 rounded text-xs bg-destructive/15 text-destructive inline-flex items-center gap-1"><Ban className="h-3 w-3" />利用停止中</span>
        ) : (
          <span className="text-xs text-muted-foreground">通常</span>
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
            <Button size="sm" variant={user.isSuspended ? "outline" : "destructive"} onClick={() => toggleSuspend(user)}>
              <Ban className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="destructive" onClick={remove}><Trash2 className="h-3.5 w-3.5" /></Button>
          </>
        )}
      </td>
    </tr>
  );
}


export function UserCoinXpPopover({ userId }: { userId: string }) {
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
