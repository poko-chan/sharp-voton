import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// コイン残高を取得（無ければ学習時間から自動初期化）
export const getCoinBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await (supabase as any)
      .from("user_coins").select("*").eq("user_id", userId).maybeSingle();
    if (existing) return existing;
    // 初期化: これまでの累計勉強分を1分=1コインで付与
    const { data: logs } = await supabase
      .from("study_logs").select("duration_minutes").eq("user_id", userId);
    const total = (logs ?? []).reduce((s: number, l: any) => s + (l.duration_minutes ?? 0), 0);
    const { data: ins } = await (supabase as any)
      .from("user_coins").insert({ user_id: userId, balance: total, total_earned: total }).select().single();
    return ins;
  });

// 学習記録から付与（差分計算: total_earned との差を加算）
export const syncCoinsFromLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: logs } = await supabase
      .from("study_logs").select("duration_minutes").eq("user_id", userId);
    const total = (logs ?? []).reduce((s: number, l: any) => s + (l.duration_minutes ?? 0), 0);
    const { data: cur } = await (supabase as any)
      .from("user_coins").select("*").eq("user_id", userId).maybeSingle();
    if (!cur) {
      const { data: ins } = await (supabase as any)
        .from("user_coins").insert({ user_id: userId, balance: total, total_earned: total }).select().single();
      return ins;
    }
    const diff = Math.max(0, total - cur.total_earned);
    const next = { balance: cur.balance + diff, total_earned: cur.total_earned + diff, updated_at: new Date().toISOString() };
    const { data: upd } = await (supabase as any).from("user_coins").update(next).eq("user_id", userId).select().single();
    return upd;
  });

// アイテム購入
const SHOP_ITEMS = {
  tree: { cost: 30, label: "🌳 木" },
  flower: { cost: 20, label: "🌸 花畑" },
  fountain: { cost: 100, label: "⛲ 噴水" },
  cafe: { cost: 200, label: "☕ カフェ" },
  statue: { cost: 500, label: "🗿 像" },
  castle: { cost: 1500, label: "🏰 城" },
  rocket: { cost: 3000, label: "🚀 ロケット" },
} as const;
type ItemKey = keyof typeof SHOP_ITEMS;
export const SHOP = SHOP_ITEMS;

export const buyTownItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ itemKey: z.string(), x: z.number().int().min(0).max(100), y: z.number().int().min(0).max(100) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const item = (SHOP_ITEMS as any)[data.itemKey] as { cost: number } | undefined;
    if (!item) throw new Error("不明なアイテムです");
    const { data: cur } = await (supabase as any).from("user_coins").select("*").eq("user_id", userId).maybeSingle();
    if (!cur || cur.balance < item.cost) throw new Error(`コインが足りません（必要 ${item.cost}）`);
    await (supabase as any).from("user_coins").update({ balance: cur.balance - item.cost, updated_at: new Date().toISOString() }).eq("user_id", userId);
    const { data: ins, error } = await (supabase as any)
      .from("town_items").insert({ user_id: userId, item_key: data.itemKey, x: data.x, y: data.y }).select().single();
    if (error) throw error;
    return ins;
  });

export const listTownItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any).from("town_items").select("*").order("created_at");
    return data ?? [];
  });

export const removeTownItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await (context.supabase as any).from("town_items").delete().eq("id", data.id);
    return { ok: true };
  });
