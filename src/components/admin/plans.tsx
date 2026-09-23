import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Package, Layers } from "lucide-react";

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

  const load = async () => {
    const [g, p, f, k, i] = await Promise.all([
      db.from("plan_groups").select("*").order("sort_order"),
      db.from("plans").select("*").order("sort_order"),
      db.from("plan_features").select("*").order("sort_order"),
      db.from("plan_packs").select("*").order("sort_order"),
      db.from("plan_pack_items").select("*").order("sort_order"),
    ]);
    setGroups(g.data ?? []);
    setPlans(p.data ?? []);
    setFeatures(f.data ?? []);
    setPacks(k.data ?? []);
    setPackItems(i.data ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const patch = async (table: string, id: string, values: Record<string, unknown>) => {
    const { error } = await db.from(table).update(values).eq("id", id);
    if (error) toast.error(error.message);
  };
  const remove = async (table: string, id: string) => {
    const { error } = await db.from(table).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  };

  if (loading) return <div className="p-4 text-sm text-muted-foreground">読み込み中…</div>;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">プラン管理</h1>
        <p className="text-sm text-muted-foreground">
          表形式で編集できます。行＝項目、列＝プラン。設定内容は利用者の「お支払い」に表示されます。
        </p>
      </div>

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
            reload={load}
          />
        ))}
      </section>

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
        {packs.map((k) => {
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
                  onBlur={(e) =>
                    patch("plan_packs", k.id, { description: e.target.value || null })
                  }
                />
                <label className="flex items-center gap-2 text-xs">
                  公開
                  <Switch
                    defaultChecked={k.active}
                    onCheckedChange={(v) => patch("plan_packs", k.id, { active: v })}
                  />
                </label>
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
                    {items.map((it) => (
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => remove("plan_pack_items", it.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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
    </div>
  );
}

function GroupTable({
  group,
  plans,
  features,
  onPatch,
  onRemove,
  reload,
}: {
  group: Group;
  plans: Plan[];
  features: Feature[];
  onPatch: (t: string, id: string, v: Record<string, unknown>) => Promise<void>;
  onRemove: (t: string, id: string) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const planIds = plans.map((p) => p.id);
  const groupFeatures = features.filter((f) => planIds.includes(f.plan_id));

  const rows = useMemo(() => {
    const map = new Map<string, { label: string; kind: "bool" | "text"; sort: number }>();
    for (const f of groupFeatures) {
      const cur = map.get(f.label);
      if (!cur || f.sort_order < cur.sort) {
        map.set(f.label, { label: f.label, kind: f.kind, sort: f.sort_order });
      }
    }
    return [...map.values()].sort((a, b) => a.sort - b.sort);
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

  const deleteRow = async (label: string) => {
    for (const f of groupFeatures.filter((x) => x.label === label)) {
      await (supabase as any).from("plan_features").delete().eq("id", f.id);
    }
    await reload();
  };

  const addRow = async () => {
    if (plans.length === 0) return toast.error("先にプランを追加してください。");
    const label = `新しい項目 ${rows.length + 1}`;
    const { error } = await (supabase as any).from("plan_features").insert(
      plans.map((p) => ({ plan_id: p.id, label, kind: "bool", sort_order: rows.length })),
    );
    if (error) return toast.error(error.message);
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
          onBlur={(e) =>
            onPatch("plan_groups", group.id, { description: e.target.value || null })
          }
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
              {plans.map((p) => (
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
                    onBlur={(e) =>
                      onPatch("plans", p.id, { description: e.target.value || null })
                    }
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
                  <select
                    className="h-7 rounded-md border bg-background px-2 text-xs"
                    value={row.kind}
                    onChange={(e) => setRowKind(row.label, e.target.value as "bool" | "text")}
                  >
                    <option value="bool">◯×</option>
                    <option value="text">短答</option>
                  </select>
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
                  <Button variant="ghost" size="icon" onClick={() => deleteRow(row.label)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
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
