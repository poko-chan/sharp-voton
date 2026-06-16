import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserCog, Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

const KEY = "lovable.linkedAccounts.v1";

type Linked = {
  user_id: string;
  email: string;
  label: string;
  kind: "admin" | "study" | "other";
  access_token: string;
  refresh_token: string;
};

function readList(): Linked[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function writeList(list: Linked[]) { localStorage.setItem(KEY, JSON.stringify(list)); }

export function AccountSwitcher() {
  const [list, setList] = useState<Linked[]>([]);
  const [me, setMe] = useState<{ id?: string; email?: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"admin"|"study"|"other">("study");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setList(readList());
    supabase.auth.getUser().then(({ data }) => setMe({ id: data.user?.id, email: data.user?.email ?? undefined }));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setMe({ id: s?.user?.id, email: s?.user?.email ?? undefined });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const captureCurrent = async (lbl: string, k: "admin"|"study"|"other") => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    const item: Linked = {
      user_id: data.session.user.id,
      email: data.session.user.email ?? "",
      label: lbl || data.session.user.email || "アカウント",
      kind: k,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    };
    const next = [...readList().filter((x) => x.user_id !== item.user_id), item];
    writeList(next); setList(next);
    return item;
  };

  const switchTo = async (l: Linked) => {
    setBusy(true);
    // Save current session first
    const { data } = await supabase.auth.getSession();
    if (data.session && data.session.user.id !== l.user_id) {
      const next = readList().map((x) => x.user_id === data.session!.user.id
        ? { ...x, access_token: data.session!.access_token, refresh_token: data.session!.refresh_token }
        : x);
      writeList(next);
    }
    const { error } = await supabase.auth.setSession({ access_token: l.access_token, refresh_token: l.refresh_token });
    setBusy(false);
    if (error) {
      toast.error("セッションが期限切れです。リンクから再ログインしてください");
      removeLink(l.user_id);
      return;
    }
    toast.success(`${l.label} に切り替えました`);
    setOpen(false);
    setTimeout(() => window.location.reload(), 200);
  };

  const removeLink = (uid: string) => {
    const next = readList().filter((x) => x.user_id !== uid);
    writeList(next); setList(next);
  };

  const linkNew = async () => {
    if (!email || !password) return toast.error("メールとパスワードを入力");
    setBusy(true);
    // 1. Save current session
    const current = await captureCurrent(me?.email ?? "現アカウント", "admin");
    if (!current) { setBusy(false); return toast.error("現在のセッションが取得できません"); }
    // 2. Sign in to the other account
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      setBusy(false);
      // restore previous
      await supabase.auth.setSession({ access_token: current.access_token, refresh_token: current.refresh_token });
      return toast.error(error?.message ?? "ログイン失敗");
    }
    // 3. Save new
    const newItem: Linked = {
      user_id: data.session.user.id,
      email: data.session.user.email ?? email,
      label: label || email,
      kind,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    };
    const merged = [...readList().filter((x) => x.user_id !== newItem.user_id), newItem];
    writeList(merged); setList(merged);
    setBusy(false); setLinkOpen(false);
    setEmail(""); setPassword(""); setLabel("");
    toast.success(`${newItem.label} をリンクしました`);
    setTimeout(() => window.location.reload(), 200);
  };

  // Auto-capture current session into list on mount if not present (so user always sees themselves in list)
  useEffect(() => {
    if (!me?.id) return;
    if (!list.find((x) => x.user_id === me.id)) {
      captureCurrent(me.email ?? "現アカウント", "admin").then(() => setList(readList()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <UserCog className="h-4 w-4" />
          <span className="text-xs hidden sm:inline">{me?.email ?? "アカウント"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <div className="text-[10px] uppercase text-muted-foreground px-2 py-1">リンク済みアカウント</div>
        {list.length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground">まだリンクなし</div>}
        {list.map((l) => (
          <div key={l.user_id} className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent ${l.user_id === me?.id ? "bg-primary/10" : ""}`}>
            <Avatar className="h-7 w-7"><AvatarFallback>{l.kind === "admin" ? "管" : l.kind === "study" ? "勉" : "他"}</AvatarFallback></Avatar>
            <button className="flex-1 min-w-0 text-left" disabled={busy} onClick={() => l.user_id !== me?.id && switchTo(l)}>
              <div className="text-sm truncate">{l.label}</div>
              <div className="text-[10px] text-muted-foreground truncate">{l.email}</div>
            </button>
            {l.user_id === me?.id ? <Check className="h-4 w-4 text-success" />
              : <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); removeLink(l.user_id); }}><Trash2 className="h-3 w-3" /></Button>}
          </div>
        ))}
        <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full mt-2"><Plus className="h-3 w-3 mr-1" />別アカウントをリンク</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>アカウントをリンク</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Input placeholder="表示名（例：勉強用）" value={label} onChange={(e) => setLabel(e.target.value)} />
              <Input placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input type="password" placeholder="パスワード" value={password} onChange={(e) => setPassword(e.target.value)} />
              <div className="flex gap-2">
                {(["admin","study","other"] as const).map((k) => (
                  <Button key={k} type="button" size="sm" variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)} className="flex-1">
                    {k === "admin" ? "管理用" : k === "study" ? "勉強用" : "その他"}
                  </Button>
                ))}
              </div>
              <Button onClick={linkNew} disabled={busy} className="w-full">リンクして切替</Button>
              <div className="text-[10px] text-muted-foreground">リンクするとそのアカウントに即切替されます。トークンはこの端末にのみ保存されます。</div>
            </div>
          </DialogContent>
        </Dialog>
      </PopoverContent>
    </Popover>
  );
}