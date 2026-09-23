import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

const db = supabase as any;

export function PlansAdminTab() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [g, p, f, k] = await Promise.all([
      db.from("plan_groups").select("*").order("sort_order"),
      db.from("plans").select("*").order("sort_order"),
      db.from("plan_features").select("*").order("sort_order"),
      db.from("plan_packs").select("*").order("sort_order"),
    ]);
    setGroups(g.data ?? []);
    setPlans(p.data ?? []);
    setFeatures(f.data ?? []);
    setPacks(k.data ?? []);
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">プラン管理</h1>
        <p className="text-sm text-muted-foreground">
          プラン群・プラン・内容・追加パックを設定します。設定内容は利用者の「お支払い」画面に表示されます。
        </p>
      </div>

      <section className="space-y-4">
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
          <Card key={g.id} className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="w-56"
                defaultValue={g.name}
                onBlur={(e) => patch("plan_groups", g.id, { name: e.target.value })}
              />
              <Input
                className="min-w-[200px] flex-1"
                placeholder="説明（任意）"
                defaultValue={g.description ?? ""}
                onBlur={(e) => patch("plan_groups", g.id, { description: e.target.value || null })}
              />
              <Input
                type="number"
                className="w-20"
                defaultValue={g.sort_order}
                onBlur={(e) => patch("plan_groups", g.id, { sort_order: Number(e.target.value) })}
              />
              <label className="flex items-center gap-2 text-xs">
                公開
                <Switch
                  defaultChecked={g.active}
                  onCheckedChange={(v) => patch("plan_groups", g.id, { active: v })}
                />
              </label>
              <Button variant="ghost" size="icon" onClick={() => remove("plan_groups", g.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            <div className="space-y-3 border-t pt-3">
              {plans
                .filter((p) => p.group_id === g.id)
                .map((p) => (
                  <PlanEditor
                    key={p.id}
                    plan={p}
                    features={features.filter((f) => f.plan_id === p.id)}
                    onPatch={patch}
                    onRemove={remove}
                    reload={load}
                  />
                ))}
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const { error } = await db.from("plans").insert({
                    group_id: g.id,
                    name: "新しいプラン",
                    sort_order: plans.filter((p) => p.group_id === g.id).length,
                  });
                  if (error) return toast.error(error.message);
                  load();
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                プランを追加
              </Button>
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
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
        {packs.map((k) => (
          <Card key={k.id} className="flex flex-wrap items-center gap-2 p-3">
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
            <label className="flex items-center gap-1 text-xs">
              金額
              <Input
                type="number"
                className="w-24"
                defaultValue={k.price}
                onBlur={(e) => patch("plan_packs", k.id, { price: Number(e.target.value) })}
              />
            </label>
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
          </Card>
        ))}
      </section>
    </div>
  );
}

function PlanEditor({
  plan,
  features,
  onPatch,
  onRemove,
  reload,
}: {
  plan: Plan;
  features: Feature[];
  onPatch: (t: string, id: string, v: Record<string, unknown>) => Promise<void>;
  onRemove: (t: string, id: string) => Promise<void>;
  reload: () => Promise<void>;
}) {
  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-44"
          defaultValue={plan.name}
          onBlur={(e) => onPatch("plans", plan.id, { name: e.target.value })}
        />
        <label className="flex items-center gap-1 text-xs">
          月額
          <Input
            type="number"
            className="w-24"
            defaultValue={plan.price_monthly}
            onBlur={(e) => onPatch("plans", plan.id, { price_monthly: Number(e.target.value) })}
          />
        </label>
        <label className="flex items-center gap-1 text-xs">
          年額
          <Input
            type="number"
            className="w-24"
            defaultValue={plan.price_yearly}
            onBlur={(e) => onPatch("plans", plan.id, { price_yearly: Number(e.target.value) })}
          />
        </label>
        <label className="flex items-center gap-2 text-xs">
          おすすめ
          <Switch
            defaultChecked={plan.highlight}
            onCheckedChange={(v) => onPatch("plans", plan.id, { highlight: v })}
          />
        </label>
        <label className="flex items-center gap-2 text-xs">
          公開
          <Switch
            defaultChecked={plan.active}
            onCheckedChange={(v) => onPatch("plans", plan.id, { active: v })}
          />
        </label>
        <Button variant="ghost" size="icon" onClick={() => onRemove("plans", plan.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <Textarea
        rows={2}
        placeholder="プランの説明（任意）"
        defaultValue={plan.description ?? ""}
        onBlur={(e) => onPatch("plans", plan.id, { description: e.target.value || null })}
      />

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">プランの内容</div>
        {features.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-md border bg-background px-2 text-xs"
              defaultValue={f.kind}
              onChange={(e) => onPatch("plan_features", f.id, { kind: e.target.value })}
            >
              <option value="bool">◯×</option>
              <option value="text">短答</option>
            </select>
            <Input
              className="w-52"
              placeholder="項目名（例: AI機能）"
              defaultValue={f.label}
              onBlur={(e) => onPatch("plan_features", f.id, { label: e.target.value })}
            />
            <Switch
              defaultChecked={f.bool_value}
              onCheckedChange={(v) => onPatch("plan_features", f.id, { bool_value: v })}
            />
            <Input
              className="min-w-[160px] flex-1"
              placeholder="短答の内容（例: 赤）"
              defaultValue={f.text_value ?? ""}
              onBlur={(e) => onPatch("plan_features", f.id, { text_value: e.target.value || null })}
            />
            <Button variant="ghost" size="icon" onClick={() => onRemove("plan_features", f.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const { error } = await db
              .from("plan_features")
              .insert({ plan_id: plan.id, label: "新しい項目", sort_order: features.length });
            if (error) return toast.error(error.message);
            reload();
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          内容を追加
        </Button>
      </div>
    </div>
  );
}
