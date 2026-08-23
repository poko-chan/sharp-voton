import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Pencil, Plus, Save } from "lucide-react";
import { toast } from "sonner";

export function ShopAdminTab() {
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
export function RedemptionsTab() {
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
export function OrgsAdminTab() {
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

