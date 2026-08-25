import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Package, Coins, Gift, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { fetchPublicProfiles } from "@/lib/public-profiles";

export const Route = createFileRoute("/_authenticated/inventory")({ component: InventoryPage });

function InventoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [shopMap, setShopMap] = useState<Record<string, any>>({});
  const [friends, setFriends] = useState<any[]>([]);
  const [giftTarget, setGiftTarget] = useState<{ code: string; max: number } | null>(null);
  const [giftTo, setGiftTo] = useState("");
  const [giftQty, setGiftQty] = useState(1);

  const load = async () => {
    if (!user) return;
    const [{ data: inv }, { data: shop }] = await Promise.all([
      (supabase as any).from("user_inventory").select("*").eq("user_id", user.id).gt("quantity", 0).order("created_at", { ascending: false }),
      (supabase as any).from("coin_shop_items").select("code,name,price,description"),
    ]);
    setItems(inv ?? []);
    const m: Record<string, any> = {};
    (shop ?? []).forEach((s: any) => { m[s.code] = s; });
    setShopMap(m);
    // friends (mutual)
    const { data: f1 } = await supabase.from("follows").select("following_id").eq("follower_id", user.id).eq("status", "accepted");
    const { data: f2 } = await supabase.from("follows").select("follower_id").eq("following_id", user.id).eq("status", "accepted");
    const a = new Set((f1 ?? []).map((r: any) => r.following_id));
    const b = new Set((f2 ?? []).map((r: any) => r.follower_id));
    const mutualIds = [...a].filter((id) => b.has(id));
    if (mutualIds.length) {
      const profs = await fetchPublicProfiles(mutualIds);
      setFriends(profs ?? []);
    } else setFriends([]);
  };
  useEffect(() => { load(); }, [user?.id]);

  const use = async (code: string) => {
    const { data, error } = await (supabase as any).rpc("use_inventory_item", { _item_code: code });
    if (error) return toast.error(error.message);
    if (data?.reward) toast.success(`宝箱から +${data.reward} コイン！`);
    else toast.success("使用しました");
    load();
  };
  const sell = async (code: string, qty = 1) => {
    if (!confirm(`${qty}個を売却しますか？（半額返金）`)) return;
    const { data, error } = await (supabase as any).rpc("sell_inventory_item", { _item_code: code, _qty: qty });
    if (error) return toast.error(error.message);
    toast.success(`+${data?.refund ?? 0} コイン返金`);
    load();
  };
  const gift = async () => {
    if (!giftTarget || !giftTo) return;
    const { error } = await (supabase as any).rpc("gift_inventory_item", { _to: giftTo, _item_code: giftTarget.code, _qty: giftQty, _message: null });
    if (error) return toast.error(error.message);
    toast.success("プレゼント送付完了");
    setGiftTarget(null); setGiftTo(""); setGiftQty(1); load();
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2"><Package /> 持ち物</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.length === 0 && <Card className="p-6 col-span-full text-center text-sm text-muted-foreground">アイテムがありません</Card>}
        {items.map((it) => {
          const s = shopMap[it.item_code] ?? {};
          const refund = Math.max(0, Math.floor((s.price ?? 0) / 2));
          const canUse = ["frame","theme","title","chest","hint","revive","boost"].includes(it.category);
          return (
            <Card key={it.id} className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <div className="font-bold flex-1">{s.name ?? it.item_code}</div>
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/15 text-primary">×{it.quantity}</span>
              </div>
              {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
              <div className="text-[10px] text-muted-foreground">カテゴリ: {it.category} ／ 売却 {refund}コイン</div>
              <div className="flex gap-1 mt-auto pt-2 flex-wrap">
                {canUse && <Button size="sm" onClick={() => use(it.item_code)}>使う</Button>}
                <Button size="sm" variant="outline" onClick={() => sell(it.item_code, 1)}>
                  <Coins className="h-3 w-3 mr-1" />売る
                </Button>
                <Dialog open={giftTarget?.code === it.item_code} onOpenChange={(o) => !o && setGiftTarget(null)}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" onClick={() => setGiftTarget({ code: it.item_code, max: it.quantity })}>
                      <Gift className="h-3 w-3 mr-1" />送る
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>アイテムを送る</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs mb-1">フレンドを選択</div>
                        <select value={giftTo} onChange={(e) => setGiftTo(e.target.value)} className="w-full p-2 rounded border bg-background">
                          <option value="">選択…</option>
                          {friends.map((f) => <option key={f.id} value={f.id}>{f.display_name ?? f.username}</option>)}
                        </select>
                        {friends.length === 0 && <div className="text-xs text-muted-foreground mt-1">相互フォローのフレンドがいません</div>}
                      </div>
                      <div>
                        <div className="text-xs mb-1">個数 (最大 {giftTarget?.max ?? 1})</div>
                        <Input type="number" min={1} max={giftTarget?.max ?? 1} value={giftQty} onChange={(e) => setGiftQty(Math.max(1, Math.min(giftTarget?.max ?? 1, +e.target.value || 1)))} />
                      </div>
                      <Button onClick={gift} disabled={!giftTo} className="w-full">送る</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}