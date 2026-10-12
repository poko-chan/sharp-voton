import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Gift, Upload, Users, X } from "lucide-react";
import { BadgeIcon } from "@/components/profile/UserProfileDialog";
import { searchPublicProfiles, fetchPublicProfiles, type PublicProfile } from "@/lib/public-profiles";

const COLORS = ["#00C9B7", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#10B981", "#EC4899", "#64748B"];
const toLocal = (s: string | null) => (s ? new Date(s).toISOString().slice(0, 16) : "");
const fromLocal = (s: string) => (s ? new Date(s).toISOString() : null);

async function uploadImage(userId: string, f: File, prefix: string) {
  if (!f.type.startsWith("image/") || f.size > 5 * 1024 * 1024) throw new Error("5MB以下の画像を選んでください");
  const path = `${userId}/${prefix}-${Date.now()}.${f.name.split(".").pop() || "png"}`;
  const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
  if (error) throw error;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

type BadgeRow = {
  id?: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  image_url: string | null;
  available_from: string | null;
  available_until: string | null;
  how_to_earn: string | null;
  is_hidden: boolean;
  is_manual?: boolean;
};

const EMPTY: BadgeRow = {
  code: "",
  name: "",
  description: "",
  icon: "",
  color: COLORS[0],
  image_url: null,
  available_from: null,
  available_until: null,
  how_to_earn: "",
  is_hidden: false,
};

export function BadgesAdminTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BadgeRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [edit, setEdit] = useState<BadgeRow | null>(null);
  const [grant, setGrant] = useState<BadgeRow | null>(null);
  const [holders, setHolders] = useState<BadgeRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("badges").select("*").neq("code", "coin_1000").order("created_at", { ascending: false });
    setRows((data ?? []) as any);
    const { data: ub } = await supabase.from("user_badges").select("badge_code");
    const c: Record<string, number> = {};
    for (const r of ub ?? []) c[r.badge_code] = (c[r.badge_code] ?? 0) + 1;
    setCounts(c);
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!edit || !user) return;
    if (!edit.name.trim()) return toast.error("バッジ名を入力してください");
    const payload = {
      name: edit.name.trim(),
      description: edit.description || null,
      icon: edit.icon || null,
      color: edit.color,
      image_url: edit.image_url,
      available_from: edit.available_from,
      available_until: edit.available_until,
      how_to_earn: edit.how_to_earn || null,
      is_hidden: edit.is_hidden,
    };
    const { error } = edit.id
      ? await supabase.from("badges").update(payload).eq("id", edit.id)
      : await supabase.from("badges").insert({
          ...payload,
          code: `custom_${Date.now().toString(36)}`,
          rarity: "common",
          is_manual: true,
          created_by: user.id,
        });
    if (error) return toast.error(error.message);
    toast.success("保存しました");
    setEdit(null);
    load();
  };

  const remove = async (b: BadgeRow) => {
    if (!confirm(`「${b.name}」を削除しますか？付与済みの記録も消えます。`)) return;
    await supabase.from("user_badges").delete().eq("badge_code", b.code);
    const { error } = await supabase.from("badges").delete().eq("id", b.id!);
    if (error) return toast.error(error.message);
    load();
  };

  const period = (b: BadgeRow) => {
    const now = Date.now();
    if (b.available_until && new Date(b.available_until).getTime() < now) return "期間終了";
    if (b.available_from && new Date(b.available_from).getTime() > now) return "開始前";
    return b.available_from || b.available_until ? "受付中" : "期限なし";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">バッジ</h2>
          <p className="text-sm text-muted-foreground">作成したバッジをユーザーに付与できます。未獲得や期間終了のバッジはプロフィールで灰色になります。</p>
        </div>
        <Button onClick={() => setEdit({ ...EMPTY })}>
          <Plus className="h-4 w-4 mr-1" /> バッジを作成
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((b) => (
          <Card key={b.code} className="p-4 flex gap-3">
            <BadgeIcon b={b} size={52} />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="font-semibold truncate">{b.name}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{b.description}</div>
              <div className="text-xs">
                {period(b)}
                {b.available_until ? ` ・ ${new Date(b.available_until).toLocaleDateString("ja-JP")}まで` : ""}
                {" ・ "}
                {counts[b.code] ?? 0}人が獲得{b.is_hidden ? " ・ 未獲得者には非表示" : ""}
                {!b.is_manual ? " ・ 自動" : ""}
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                <Button size="sm" onClick={() => setGrant(b)}>
                  <Gift className="h-4 w-4 mr-1" /> バッジ付与
                </Button>
                <Button size="sm" variant="outline" onClick={() => setHolders(b)}>
                  <Users className="h-4 w-4 mr-1" /> 獲得者
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEdit({ ...b })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {b.is_manual && (
                  <Button size="sm" variant="ghost" onClick={() => remove(b)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "バッジを編集" : "バッジを作成"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <BadgeIcon b={edit} size={64} />
                <div className="space-y-1">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f || !user) return;
                      try {
                        setEdit({ ...edit, image_url: await uploadImage(user.id, f, "badge") });
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    }}
                  />
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" /> 画像を選ぶ
                  </Button>
                  {edit.image_url && (
                    <Button size="sm" variant="ghost" onClick={() => setEdit({ ...edit, image_url: null })}>
                      画像を外す
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label>バッジ名</Label>
                <Input value={edit.name} maxLength={30} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>説明</Label>
                <Textarea rows={2} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>獲得方法（未獲得の人に表示）</Label>
                <Input value={edit.how_to_earn ?? ""} placeholder="例: 秋のアンケートに回答" onChange={(e) => setEdit({ ...edit, how_to_earn: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>画像がないときの文字（1〜2文字）</Label>
                <Input value={edit.icon ?? ""} maxLength={2} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>バッジカラー</Label>
                <div className="flex flex-wrap gap-2 items-center">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setEdit({ ...edit, color: c })} className={`h-7 w-7 rounded-full border-2 ${edit.color === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} aria-label={c} />
                  ))}
                  <input type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className="h-7 w-10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>付与可能期間 開始</Label>
                  <Input type="datetime-local" value={toLocal(edit.available_from)} onChange={(e) => setEdit({ ...edit, available_from: fromLocal(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label>終了</Label>
                  <Input type="datetime-local" value={toLocal(edit.available_until)} onChange={(e) => setEdit({ ...edit, available_until: fromLocal(e.target.value) })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={edit.is_hidden} onCheckedChange={(v) => setEdit({ ...edit, is_hidden: v })} />
                <span className="text-sm">シークレット（獲得するまでプロフィールに出さない）</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(null)}>キャンセル</Button>
            <Button onClick={save}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GrantDialog badge={grant} onClose={() => { setGrant(null); load(); }} />
      <HoldersDialog badge={holders} onClose={() => { setHolders(null); load(); }} />
    </div>
  );
}

function GrantDialog({ badge, onClose }: { badge: BadgeRow | null; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [picked, setPicked] = useState<PublicProfile[]>([]);
  const [bulk, setBulk] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setQ(""); setResults([]); setPicked([]); setBulk(""); setNote("");
  }, [badge?.code]);
  useEffect(() => {
    if (!q.trim()) return setResults([]);
    const t = setTimeout(async () => setResults(await searchPublicProfiles(q.trim())), 300);
    return () => clearTimeout(t);
  }, [q]);

  const closed = badge?.available_until && new Date(badge.available_until).getTime() < Date.now();
  const notYet = badge?.available_from && new Date(badge.available_from).getTime() > Date.now();

  const submit = async () => {
    if (!badge) return;
    const names = [
      ...picked.map((p) => p.username ?? ""),
      ...bulk.split(/[\s,、]+/),
    ].filter(Boolean);
    if (names.length === 0) return toast.error("ユーザーを選んでください");
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_grant_badge", { _code: badge.code, _usernames: names, _note: note || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    const r = data as any;
    toast.success(`${r.granted}人に付与しました`);
    if (r.missing?.length) toast.warning(`見つからないユーザー: ${r.missing.join(", ")}`);
    onClose();
  };

  return (
    <Dialog open={!!badge} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>「{badge?.name}」を付与</DialogTitle>
        </DialogHeader>
        {(closed || notYet) && (
          <div className="text-xs rounded-md bg-destructive/10 text-destructive p-2">
            {closed ? "付与可能期間が終了しています。" : "付与可能期間の前です。"}期間外でも管理者は付与できます。
          </div>
        )}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>ユーザーを検索して選ぶ</Label>
            <Input value={q} placeholder="ユーザー名・表示名" onChange={(e) => setQ(e.target.value)} />
            {results.length > 0 && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {results.map((p) => (
                  <button key={p.id} className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                    onClick={() => !picked.find((x) => x.id === p.id) && setPicked([...picked, p])}>
                    {p.display_name} <span className="text-muted-foreground">@{p.username}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {picked.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
                  @{p.username}
                  <button onClick={() => setPicked(picked.filter((x) => x.id !== p.id))} aria-label="外す"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>まとめて貼り付け（ユーザー名を改行・カンマ区切り）</Label>
            <Textarea rows={4} value={bulk} placeholder={"taro\nhanako\n@jiro"} onChange={(e) => setBulk(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>メモ（任意・付与理由）</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>キャンセル</Button>
          <Button onClick={submit} disabled={busy}>付与する</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HoldersDialog({ badge, onClose }: { badge: BadgeRow | null; onClose: () => void }) {
  const [list, setList] = useState<{ user_id: string; earned_at: string; note: string | null; p?: PublicProfile }[]>([]);
  const load = async () => {
    if (!badge) return;
    const { data } = await supabase.from("user_badges").select("user_id, earned_at, note").eq("badge_code", badge.code).order("earned_at", { ascending: false });
    const profs = await fetchPublicProfiles((data ?? []).map((r) => r.user_id));
    const m = new Map(profs.map((p) => [p.id, p]));
    setList((data ?? []).map((r) => ({ ...r, p: m.get(r.user_id) })));
  };
  useEffect(() => {
    load();
  }, [badge?.code]);
  const revoke = async (uid: string) => {
    if (!badge || !confirm("このユーザーからバッジを取り消しますか？")) return;
    const { error } = await supabase.from("user_badges").delete().eq("badge_code", badge.code).eq("user_id", uid);
    if (error) return toast.error(error.message);
    load();
  };
  return (
    <Dialog open={!!badge} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>「{badge?.name}」の獲得者（{list.length}人）</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {list.map((r) => (
            <div key={r.user_id} className="flex items-center gap-2 text-sm border-b py-1.5">
              <div className="flex-1 min-w-0">
                {r.p?.display_name ?? "不明"} <span className="text-muted-foreground">@{r.p?.username}</span>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.earned_at).toLocaleString("ja-JP")}{r.note ? ` ・ ${r.note}` : ""}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => revoke(r.user_id)}>取り消し</Button>
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-muted-foreground">まだ獲得者はいません</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= ダッシュボードバナー ================= */
type Banner = {
  id?: string;
  title: string;
  image_url: string;
  action_type: string;
  link_url: string | null;
  open_new_tab: boolean;
  modal_title: string | null;
  modal_body: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
};
const EMPTY_BANNER: Banner = {
  title: "", image_url: "", action_type: "none", link_url: "", open_new_tab: false,
  modal_title: "", modal_body: "", starts_at: null, ends_at: null, is_active: true, sort_order: 0,
};

export function BannersAdminTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Banner[]>([]);
  const [edit, setEdit] = useState<Banner | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = async () => {
    const { data } = await supabase.from("dashboard_banners").select("*").order("sort_order").order("created_at", { ascending: false });
    setRows((data ?? []) as any);
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!edit) return;
    if (!edit.image_url) return toast.error("バナー画像を選んでください");
    if (edit.action_type === "url" && !edit.link_url) return toast.error("URLを入力してください");
    const { id, ...rest } = edit;
    const { error } = id
      ? await supabase.from("dashboard_banners").update(rest).eq("id", id)
      : await supabase.from("dashboard_banners").insert(rest);
    if (error) return toast.error(error.message);
    toast.success("保存しました");
    setEdit(null);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("このバナーを削除しますか？")) return;
    await supabase.from("dashboard_banners").delete().eq("id", id);
    load();
  };
  const toggle = async (b: Banner) => {
    await supabase.from("dashboard_banners").update({ is_active: !b.is_active }).eq("id", b.id!);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">ダッシュボードバナー</h2>
          <p className="text-sm text-muted-foreground">ホームの一番上に表示されます。クリックでURLを開くか、ポップアップで文章を表示できます。</p>
        </div>
        <Button onClick={() => setEdit({ ...EMPTY_BANNER })}>
          <Plus className="h-4 w-4 mr-1" /> バナーを追加
        </Button>
      </div>
      <div className="space-y-3">
        {rows.map((b) => (
          <Card key={b.id} className="p-3 flex flex-col sm:flex-row gap-3">
            <img src={b.image_url} alt={b.title} className="w-full sm:w-56 aspect-[4/1] object-cover rounded-md" />
            <div className="flex-1 min-w-0 text-sm space-y-1">
              <div className="font-semibold">{b.title || "(タイトルなし)"}</div>
              <div className="text-xs text-muted-foreground">
                {b.action_type === "url" ? `URL: ${b.link_url}` : b.action_type === "modal" ? "ポップアップ表示" : "クリック動作なし"}
                {" ・ "}
                {b.starts_at ? new Date(b.starts_at).toLocaleString("ja-JP") : "即時"} 〜 {b.ends_at ? new Date(b.ends_at).toLocaleString("ja-JP") : "無期限"}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={b.is_active} onCheckedChange={() => toggle(b)} />
                <span className="text-xs">{b.is_active ? "公開中" : "非公開"}</span>
                <Button size="sm" variant="ghost" onClick={() => setEdit({ ...b })}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(b.id!)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </Card>
        ))}
        {rows.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">バナーはまだありません</Card>}
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "バナーを編集" : "バナーを追加"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3">
              {edit.image_url && <img src={edit.image_url} alt="" className="w-full aspect-[4/1] object-cover rounded-md" />}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f || !user) return;
                try { setEdit({ ...edit, image_url: await uploadImage(user.id, f, "banner-admin") }); }
                catch (err: any) { toast.error(err.message); }
              }} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> バナー画像を選ぶ（横長 4:1 推奨）
              </Button>
              <div className="space-y-1">
                <Label>タイトル（画像の代替文字）</Label>
                <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>クリックしたとき</Label>
                <Select value={edit.action_type} onValueChange={(v) => setEdit({ ...edit, action_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">何もしない</SelectItem>
                    <SelectItem value="url">URLを開く</SelectItem>
                    <SelectItem value="modal">ポップアップで文章を表示</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {edit.action_type === "url" && (
                <>
                  <Input value={edit.link_url ?? ""} placeholder="https://… または /makron" onChange={(e) => setEdit({ ...edit, link_url: e.target.value })} />
                  <div className="flex items-center gap-2">
                    <Switch checked={edit.open_new_tab} onCheckedChange={(v) => setEdit({ ...edit, open_new_tab: v })} />
                    <span className="text-sm">新しいタブで開く</span>
                  </div>
                </>
              )}
              {edit.action_type === "modal" && (
                <>
                  <Input value={edit.modal_title ?? ""} placeholder="ポップアップの見出し" onChange={(e) => setEdit({ ...edit, modal_title: e.target.value })} />
                  <Textarea rows={6} value={edit.modal_body ?? ""} placeholder="本文" onChange={(e) => setEdit({ ...edit, modal_body: e.target.value })} />
                  <Input value={edit.link_url ?? ""} placeholder="（任意）ポップアップ内ボタンのURL" onChange={(e) => setEdit({ ...edit, link_url: e.target.value })} />
                </>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>掲載開始</Label>
                  <Input type="datetime-local" value={toLocal(edit.starts_at)} onChange={(e) => setEdit({ ...edit, starts_at: fromLocal(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label>掲載終了</Label>
                  <Input type="datetime-local" value={toLocal(edit.ends_at)} onChange={(e) => setEdit({ ...edit, ends_at: fromLocal(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>表示順（小さいほど先）</Label>
                <Input type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) || 0 })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(null)}>キャンセル</Button>
            <Button onClick={save}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
