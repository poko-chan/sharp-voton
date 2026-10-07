import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
<<<<<<< HEAD
import { ArrowDown, ArrowUp, Plus, Trash2, Package, Layers } from "lucide-react";
=======
import { ArrowUpRight, CreditCard, Eye, Layers, Package, Plus, Sparkles, Trash2 } from "lucide-react";
>>>>>>> 757e9c14f5158836dc6a0bfccc90028607a991ff

type Group = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
};
type Plan = {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  highlight: boolean;
  sort_order: number;
  active: boolean;
};
type Feature = {
  id: string;
  plan_id: string;
  kind: "bool" | "text";
  label: string;
  bool_value: boolean;
  text_value: string | null;
  sort_order: number;
  description: string | null;
  group_label: string | null;
};
type Pack = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  sort_order: number;
  active: boolean;
};
type PackItem = {
  id: string;
  pack_id: string;
  name: string;
  description: string | null;
  price: number;
  amount_label: string | null;
  sort_order: number;
  active: boolean;
};

const db = supabase as any;

export function PlansAdminTab() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [packItems, setPackItems] = useState<PackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [section, setSection] = useState<"plans" | "packs">("plans");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [g, p, f, k, i] = await Promise.all([
      db.from("plan_groups").select("*").order("sort_order"),
      db.from("plans").select("*").order("sort_order"),
      db.from("plan_features").select("*").order("sort_order"),
      db.from("plan_packs").select("*").order("sort_order"),
      db.from("plan_pack_items").select("*").order("sort_order"),
    ]);
    const failed = [g, p, f, k, i].find((result) => result.error);
    if (failed?.error) {
      setLoadError(failed.error.message);
      setLoading(false);
      return;
    }
    setGroups(g.data ?? []);
    setPlans(p.data ?? []);
    setFeatures(f.data ?? []);
    setPacks(k.data ?? []);
    setPackItems(i.data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (table: string, id: string, values: Record<string, unknown>) => {
    const { error } = await db.from(table).update(values).eq("id", id);
    if (error) {
      toast.error(`保存できませんでした: ${error.message}`);
      return;
    }
    const updateById = <T extends { id: string }>(items: T[]) =>
      items.map((item) => (item.id === id ? { ...item, ...values } : item));
    if (table === "plan_groups") setGroups(updateById);
    if (table === "plans") setPlans(updateById);
    if (table === "plan_features") setFeatures(updateById);
    if (table === "plan_packs") setPacks(updateById);
    if (table === "plan_pack_items") setPackItems(updateById);
  };
  const moveOrder = async <T extends { id: string; sort_order: number }>(
    table: string,
    items: T[],
    index: number,
    direction: -1 | 1,
  ) => {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[otherIndex]] = [reordered[otherIndex], reordered[index]];
    const updates = await Promise.all(
      reordered.map((item, sort_order) => db.from(table).update({ sort_order }).eq("id", item.id)),
    );
    const error = updates.find((result) => result.error)?.error;
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  };
  const remove = async (table: string, id: string) => {
    const { error } = await db.from(table).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  };

  if (loading && groups.length + plans.length + packs.length === 0)
    return <div className="p-4 text-sm text-muted-foreground">読み込み中…</div>;

  if (loadError)
    return (
      <Card className="space-y-3 p-6">
        <p className="font-semibold">料金設定を読み込めませんでした</p>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button variant="outline" onClick={() => void load()}>
          再読み込み
        </Button>
      </Card>
    );

  return (
    <div className="space-y-7">
      <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-violet-950 to-slate-900 p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -right-12 -top-20 -z-10 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-200">
              <Sparkles className="h-4 w-4" /> お支払いカタログ
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              料金プランをかんたん管理
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              公開内容は利用者のお支払い画面にすぐ反映されます。現在は料金の表示のみで、請求・購入処理は行われません。
            </p>
          </div>
          <Link
            to="/payments"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20"
          >
            <Eye className="h-4 w-4" /> 利用者画面をプレビュー
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <SummaryTile label="プラン群" value={groups.length} detail="料金のまとまり" />
          <SummaryTile
            label="公開プラン"
            value={
              plans.filter(
                (plan) =>
                  plan.active && groups.some((group) => group.id === plan.group_id && group.active),
              ).length
            }
            detail={`${plans.length} 件中`}
          />
          <SummaryTile
            label="公開パック"
            value={packs.filter((pack) => pack.active).length}
            detail={`${packItems.filter((item) => item.active).length} 商品が公開中`}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border bg-muted/50 p-1">
          <button
            type="button"
            onClick={() => setSection("plans")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
              section === "plans" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
            aria-pressed={section === "plans"}
          >
            <Layers className="h-4 w-4" /> プランと特典
          </button>
          <button
            type="button"
            onClick={() => setSection("packs")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
              section === "packs" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
            aria-pressed={section === "packs"}
          >
            <Package className="h-4 w-4" /> 追加パック
          </button>
        </div>
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
          <CreditCard className="h-3.5 w-3.5" /> 現在は表示のみ・課金なし
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        入力欄はフォーカスを外すと保存され、公開スイッチは切り替えと同時に反映されます。
        まず非公開のまま内容を整え、準備ができた項目だけ公開してください。
      </p>

      {section === "plans" ? (
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Layers className="h-4 w-4" /> プラン群
          </h2>
          <Button
            size="sm"
            onClick={async () => {
              const { error } = await db
                .from("plan_groups")
                .insert({ name: "新しいプラン群", sort_order: groups.length });
              if (error) return toast.error(error.message);
              load();
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            プラン群を追加
          </Button>
        </div>

        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">まだプラン群がありません。</p>
        )}

        {groups.map((g) => (
          <GroupTable
            key={g.id}
            group={g}
            plans={plans.filter((p) => p.group_id === g.id)}
            features={features}
            onPatch={patch}
            onRemove={remove}
            onMoveOrder={moveOrder}
            reload={load}
          />
        ))}
      </section>
      ) : (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Package className="h-4 w-4" /> 追加パック
          </h2>
          <Button
            size="sm"
            onClick={async () => {
              const { error } = await db
                .from("plan_packs")
                .insert({ name: "新しいパック", sort_order: packs.length });
              if (error) return toast.error(error.message);
              load();
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            パックを追加
          </Button>
        </div>
        {packs.map((k, packIndex) => {
          const items = packItems.filter((it) => it.pack_id === k.id);
          return (
            <Card key={k.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="w-48"
                  defaultValue={k.name}
                  onBlur={(e) => patch("plan_packs", k.id, { name: e.target.value })}
                />
                <Input
                  className="min-w-[180px] flex-1"
                  placeholder="説明（任意）"
                  defaultValue={k.description ?? ""}
                  onBlur={(e) => patch("plan_packs", k.id, { description: e.target.value || null })}
                />
                <label className="flex items-center gap-2 text-xs">
                  公開
                  <Switch
                    defaultChecked={k.active}
                    onCheckedChange={(v) => patch("plan_packs", k.id, { active: v })}
                  />
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="パックを上へ移動"
                  title="上へ移動"
                  disabled={packIndex === 0}
                  onClick={() => moveOrder("plan_packs", packs, packIndex, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="パックを下へ移動"
                  title="下へ移動"
                  disabled={packIndex === packs.length - 1}
                  onClick={() => moveOrder("plan_packs", packs, packIndex, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove("plan_packs", k.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left font-medium">商品名</th>
                      <th className="p-2 text-left font-medium">内容（例: 1,000クレジット）</th>
                      <th className="p-2 text-left font-medium">金額</th>
                      <th className="p-2 text-left font-medium">公開</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, itemIndex) => (
                      <tr key={it.id} className="border-t">
                        <td className="p-1.5">
                          <Input
                            className="h-8"
                            defaultValue={it.name}
                            onBlur={(e) =>
                              patch("plan_pack_items", it.id, { name: e.target.value })
                            }
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            className="h-8"
                            defaultValue={it.amount_label ?? ""}
                            onBlur={(e) =>
                              patch("plan_pack_items", it.id, {
                                amount_label: e.target.value || null,
                              })
                            }
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            className="h-8 w-28"
                            defaultValue={it.price}
                            onBlur={(e) =>
                              patch("plan_pack_items", it.id, { price: Number(e.target.value) })
                            }
                          />
                        </td>
                        <td className="p-1.5">
                          <Switch
                            defaultChecked={it.active}
                            onCheckedChange={(v) => patch("plan_pack_items", it.id, { active: v })}
                          />
                        </td>
                        <td className="p-1.5">
                          <div className="flex items-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="商品を上へ移動"
                              title="上へ移動"
                              disabled={itemIndex === 0}
                              onClick={() => moveOrder("plan_pack_items", items, itemIndex, -1)}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="商品を下へ移動"
                              title="下へ移動"
                              disabled={itemIndex === items.length - 1}
                              onClick={() => moveOrder("plan_pack_items", items, itemIndex, 1)}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="商品を削除"
                              onClick={() => remove("plan_pack_items", it.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td className="p-3 text-xs text-muted-foreground" colSpan={5}>
                          このパックにはまだ商品がありません。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const { error } = await db
                    .from("plan_pack_items")
                    .insert({ pack_id: k.id, sort_order: items.length });
                  if (error) return toast.error(error.message);
                  load();
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                商品を追加
              </Button>
            </Card>
          );
        })}
      </section>
      )}
    </div>
  );
}

function SummaryTile({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur-sm">
      <p className="text-[11px] font-semibold text-white/60">{label}</p>
      <p className="mt-0.5 text-xl font-black tabular-nums">
        {value}
        <span className="ml-1 text-xs font-medium text-white/60">{detail}</span>
      </p>
    </div>
  );
}

function GroupTable({
  group,
  plans,
  features,
  onPatch,
  onRemove,
  onMoveOrder,
  reload,
}: {
  group: Group;
  plans: Plan[];
  features: Feature[];
  onPatch: (t: string, id: string, v: Record<string, unknown>) => Promise<void>;
  onRemove: (t: string, id: string) => Promise<void>;
  onMoveOrder: <T extends { id: string; sort_order: number }>(
    table: string,
    items: T[],
    index: number,
    direction: -1 | 1,
  ) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const planIds = plans.map((p) => p.id);
  const groupFeatures = features.filter((f) => planIds.includes(f.plan_id));

  const rows = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        kind: "bool" | "text";
        sort: number;
        description: string | null;
        group_label: string | null;
      }
    >();
    for (const f of groupFeatures) {
      const cur = map.get(f.label);
      if (!cur || f.sort_order < cur.sort) {
        map.set(f.label, {
          label: f.label,
          kind: f.kind,
          sort: f.sort_order,
          description: f.description,
          group_label: f.group_label,
        });
      }
    }
    return [...map.values()].sort((a, b) => {
      const ga = a.group_label ?? "";
      const gb = b.group_label ?? "";
      if (ga !== gb) return ga.localeCompare(gb, "ja");
      return a.sort - b.sort;
    });
  }, [groupFeatures]);

  const cell = (label: string, planId: string) =>
    groupFeatures.find((f) => f.label === label && f.plan_id === planId);

  const ensureCell = async (label: string, kind: "bool" | "text", planId: string, sort: number) => {
    const existing = cell(label, planId);
    if (existing) return existing;
    const { data, error } = await (supabase as any)
      .from("plan_features")
      .insert({ plan_id: planId, label, kind, sort_order: sort })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    return data as Feature;
  };

  const setCellValue = async (
    label: string,
    kind: "bool" | "text",
    planId: string,
    sort: number,
    values: Record<string, unknown>,
  ) => {
    const f = await ensureCell(label, kind, planId, sort);
    if (!f) return;
    await onPatch("plan_features", f.id, values);
    if (!cell(label, planId)) await reload();
  };

  const renameRow = async (oldLabel: string, newLabel: string) => {
    if (!newLabel || newLabel === oldLabel) return;
    for (const f of groupFeatures.filter((x) => x.label === oldLabel)) {
      await onPatch("plan_features", f.id, { label: newLabel });
    }
    await reload();
  };

  const setRowKind = async (label: string, kind: "bool" | "text") => {
    for (const f of groupFeatures.filter((x) => x.label === label)) {
      await onPatch("plan_features", f.id, { kind });
    }
    await reload();
  };

  const setRowMeta = async (label: string, values: Record<string, unknown>) => {
    for (const f of groupFeatures.filter((x) => x.label === label)) {
      await onPatch("plan_features", f.id, values);
    }
  };

  const deleteRow = async (label: string) => {
    for (const f of groupFeatures.filter((x) => x.label === label)) {
      await (supabase as any).from("plan_features").delete().eq("id", f.id);
    }
    await reload();
  };

  const addRow = async () => {
    if (plans.length === 0) return toast.error("先にプランを追加してください。");
    const label = `新しい項目 ${rows.length + 1}`;
    const { error } = await (supabase as any)
      .from("plan_features")
      .insert(plans.map((p) => ({ plan_id: p.id, label, kind: "bool", sort_order: rows.length })));
    if (error) return toast.error(error.message);
    await reload();
  };

  const moveRow = async (index: number, direction: -1 | 1) => {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= rows.length) return;
    if ((rows[index].group_label ?? "") !== (rows[otherIndex].group_label ?? "")) return;
    const reordered = [...rows];
    [reordered[index], reordered[otherIndex]] = [reordered[otherIndex], reordered[index]];
    const updates = await Promise.all(
      reordered.flatMap((row, sort_order) =>
        groupFeatures
          .filter((feature) => feature.label === row.label)
          .map((feature) =>
            (supabase as any).from("plan_features").update({ sort_order }).eq("id", feature.id),
          ),
      ),
    );
    const error = updates.find((result) => result.error)?.error;
    if (error) {
      toast.error(error.message);
      return;
    }
    await reload();
  };

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-56 font-semibold"
          defaultValue={group.name}
          onBlur={(e) => onPatch("plan_groups", group.id, { name: e.target.value })}
        />
        <Input
          className="min-w-[200px] flex-1"
          placeholder="説明（任意）"
          defaultValue={group.description ?? ""}
          onBlur={(e) => onPatch("plan_groups", group.id, { description: e.target.value || null })}
        />
        <label className="flex items-center gap-2 text-xs">
          公開
          <Switch
            defaultChecked={group.active}
            onCheckedChange={(v) => onPatch("plan_groups", group.id, { active: v })}
          />
        </label>
        <Button variant="ghost" size="icon" onClick={() => onRemove("plan_groups", group.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-muted/50 align-top">
              <th className="w-64 p-2 text-left text-xs font-medium text-muted-foreground">
                項目 / プラン
              </th>
              {plans.map((p, planIndex) => (
                <th key={p.id} className="min-w-[180px] space-y-1 p-2 text-left">
                  <Input
                    className="h-8 font-semibold"
                    defaultValue={p.name}
                    onBlur={(e) => onPatch("plans", p.id, { name: e.target.value })}
                  />
                  <Input
                    className="h-7 text-xs"
                    placeholder="キャッチコピー"
                    defaultValue={p.description ?? ""}
                    onBlur={(e) => onPatch("plans", p.id, { description: e.target.value || null })}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground">月</span>
                    <Input
                      type="number"
                      className="h-7 w-20 text-xs"
                      defaultValue={p.price_monthly}
                      onBlur={(e) =>
                        onPatch("plans", p.id, { price_monthly: Number(e.target.value) })
                      }
                    />
                    <span className="text-[11px] text-muted-foreground">年</span>
                    <Input
                      type="number"
                      className="h-7 w-20 text-xs"
                      defaultValue={p.price_yearly}
                      onBlur={(e) =>
                        onPatch("plans", p.id, { price_yearly: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-normal">
                    <label className="flex items-center gap-1">
                      おすすめ
                      <Switch
                        defaultChecked={p.highlight}
                        onCheckedChange={(v) => onPatch("plans", p.id, { highlight: v })}
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      公開
                      <Switch
                        defaultChecked={p.active}
                        onCheckedChange={(v) => onPatch("plans", p.id, { active: v })}
                      />
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label="プランを上へ移動"
                      title="上へ移動"
                      disabled={planIndex === 0}
                      onClick={() => onMoveOrder("plans", plans, planIndex, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label="プランを下へ移動"
                      title="下へ移動"
                      disabled={planIndex === plans.length - 1}
                      onClick={() => onMoveOrder("plans", plans, planIndex, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onRemove("plans", p.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </th>
              ))}
              <th className="w-40 p-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const { error } = await (supabase as any).from("plans").insert({
                      group_id: group.id,
                      name: "新しいプラン",
                      sort_order: plans.length,
                    });
                    if (error) return toast.error(error.message);
                    await reload();
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  プラン
                </Button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.label} className="border-t align-middle">
                <td className="space-y-1 p-2">
                  <Input
                    className="h-8"
                    defaultValue={row.label}
                    onBlur={(e) => renameRow(row.label, e.target.value)}
                  />
                  <Input
                    className="h-7 text-xs"
                    placeholder="説明（任意）"
                    defaultValue={row.description ?? ""}
                    onBlur={(e) => setRowMeta(row.label, { description: e.target.value || null })}
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-7 w-24 text-xs"
                      placeholder="グループ"
                      defaultValue={row.group_label ?? ""}
                      onBlur={(e) => setRowMeta(row.label, { group_label: e.target.value || null })}
                    />
                    <select
                      className="h-7 rounded-md border bg-background px-2 text-xs"
                      value={row.kind}
                      onChange={(e) => setRowKind(row.label, e.target.value as "bool" | "text")}
                    >
                      <option value="bool">◯×</option>
                      <option value="text">短答</option>
                    </select>
                  </div>
                </td>
                {plans.map((p) => {
                  const f = cell(row.label, p.id);
                  return (
                    <td key={p.id} className="p-2">
                      {row.kind === "bool" ? (
                        <Switch
                          checked={f?.bool_value ?? false}
                          onCheckedChange={(v) =>
                            setCellValue(row.label, row.kind, p.id, idx, { bool_value: v })
                          }
                        />
                      ) : (
                        <Input
                          className="h-8"
                          placeholder="例: 赤"
                          defaultValue={f?.text_value ?? ""}
                          onBlur={(e) =>
                            setCellValue(row.label, row.kind, p.id, idx, {
                              text_value: e.target.value || null,
                            })
                          }
                        />
                      )}
                    </td>
                  );
                })}
                <td className="p-2">
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="項目を上へ移動"
                      title="上へ移動"
                      disabled={
                        idx === 0 || (rows[idx - 1]?.group_label ?? "") !== (row.group_label ?? "")
                      }
                      onClick={() => moveRow(idx, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="項目を下へ移動"
                      title="下へ移動"
                      disabled={
                        idx === rows.length - 1 ||
                        (rows[idx + 1]?.group_label ?? "") !== (row.group_label ?? "")
                      }
                      onClick={() => moveRow(idx, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="項目を削除"
                      onClick={() => deleteRow(row.label)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr className="border-t">
                <td className="p-3 text-xs text-muted-foreground" colSpan={plans.length + 2}>
                  まだ項目がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Button size="sm" variant="outline" onClick={addRow}>
        <Plus className="mr-1 h-4 w-4" />
        項目を追加
      </Button>
    </Card>
  );
}
