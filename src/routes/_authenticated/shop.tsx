import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Coins, ShoppingBag, Gift, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/shop")({ component: ShopPage });

const CATEGORIES: { key: string; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "frame", label: "フレーム" },
  { key: "theme", label: "テーマ" },
  { key: "title", label: "称号" },
  { key: "decor", label: "デコ" },
  { key: "hint", label: "ヒント券" },
  { key: "revive", label: "復活" },
  { key: "chest", label: "宝箱" },
  { key: "boost", label: "ブースト" },
  { key: "scratch", label: "計算用紙" },
  { key: "emoji", label: "絵文字" },
  { key: "privilege", label: "権限" },
];

function ShopPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [balance, setBalance] = useState(0);
  const [tab, setTab] = useState("all");
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const [{ data: it }, { data: inv }, { data: c }, { data: tx }] = await Promise.all([
      (supabase as any).from("coin_shop_items").select("*").eq("is_active", true).order("sort_order"),
      (supabase as any).from("user_inventory").select("item_code").eq("user_id", user.id),
      supabase.from("user_coins").select("balance").eq("user_id", user.id).maybeSingle(),
      (supabase as any).from("coin_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);
    setItems(it ?? []);
    setOwned(new Set((inv ?? []).map((r: any) => r.item_code)));
    setBalance(c?.balance ?? 0);
    setHistory(tx ?? []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const buy = async (item: any) => {
    if (balance < item.price) return toast.error("コインが足りません");
    if (!item.consumable && owned.has(item.code)) return toast.error("既に所有しています");
    setBusy(item.id);
    const { data, error } = await (supabase as any).rpc("purchase_shop_item", { _item_id: item.id });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`「${item.name}」を購入しました！`);
    await load();
    if (data?.balance != null) setBalance(data.balance);
  };

  const equip = async (item: any) => {
    if (!user) return;
    const patch: any = {};
    if (item.category === "frame") patch.active_frame = item.payload?.frame ?? item.code;
    if (item.category === "theme") patch.active_theme = item.payload?.theme ?? item.code;
    if (item.category === "title") patch.active_title = item.payload?.title ?? item.name;
    if (!Object.keys(patch).length) return toast.info("このアイテムは装備できません");
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("装備しました");
  };

  const filtered = tab === "all" ? items : items.filter((i) => i.category === tab);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><ShoppingBag /> コインショップ</h1>
        <Card className="px-4 py-2 flex items-center gap-2 bg-amber-500/10 border-amber-500/30">
          <Coins className="h-5 w-5 text-amber-500" />
          <span className="font-bold text-lg tabular-nums">{balance}</span>
          <span className="text-xs text-muted-foreground">コイン</span>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {CATEGORIES.map((c) => <TabsTrigger key={c.key} value={c.key}>{c.label}</TabsTrigger>)}
          <TabsTrigger value="__hist">履歴</TabsTrigger>
        </TabsList>
        {CATEGORIES.map((c) => (
          <TabsContent key={c.key} value={c.key}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
              {filtered.map((it) => {
                const isOwned = !it.consumable && owned.has(it.code);
                return (
                  <Card key={it.id} className="p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <div className="font-bold flex-1">{it.name}</div>
                      {isOwned && <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success flex items-center gap-1"><Check className="h-3 w-3" />所有済</span>}
                    </div>
                    {it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}
                    <div className="flex items-center justify-between mt-auto pt-2">
                      <div className="flex items-center gap-1 text-amber-600 font-bold"><Coins className="h-4 w-4" />{it.price}</div>
                      <div className="flex gap-1">
                        {isOwned && ["frame","theme","title"].includes(it.category) && (
                          <Button size="sm" variant="outline" onClick={() => equip(it)}>装備</Button>
                        )}
                        <Button size="sm" disabled={busy === it.id || (isOwned && !it.consumable) || balance < it.price} onClick={() => buy(it)}>
                          {isOwned && !it.consumable ? "所有済" : "購入"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
              {filtered.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground col-span-full">アイテムはありません</Card>}
            </div>
          </TabsContent>
        ))}
        <TabsContent value="__hist">
          <Card className="divide-y mt-4">
            {history.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">履歴はありません</div>}
            {history.map((h: any) => (
              <div key={h.id} className="p-3 flex items-center gap-2 text-sm">
                <Gift className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{h.reason}</span>
                <span className={`font-bold tabular-nums ${h.amount > 0 ? "text-success" : "text-destructive"}`}>{h.amount > 0 ? "+" : ""}{h.amount}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleString("ja-JP")}</span>
              </div>
            ))}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}