import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Check,
  CreditCard,
  Package,
  RefreshCw,
  Sparkles,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Group = { id: string; name: string; description: string | null };
type Plan = {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  highlight: boolean;
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
type Pack = { id: string; name: string; description: string | null; price: number; currency: string };
type PackItem = {
  id: string;
  pack_id: string;
  name: string;
  description: string | null;
  price: number;
  amount_label: string | null;
};
type Catalog = {
  groups: Group[];
  plans: Plan[];
  features: Feature[];
  packs: Pack[];
  packItems: PackItem[];
};

const db = supabase as any;
const EMPTY_CATALOG: Catalog = { groups: [], plans: [], features: [], packs: [], packItems: [] };

function yen(n: number) {
  return n === 0 ? "¥0" : `¥${n.toLocaleString("ja-JP")}`;
}

export function PaymentSection() {
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [selection, setSelection] = useState<"plans" | "packs">("plans");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [g, p, f, k, i] = await Promise.all([
      db.from("plan_groups").select("*").eq("active", true).order("sort_order"),
      db.from("plans").select("*").eq("active", true).order("sort_order"),
      db.from("plan_features").select("*").order("sort_order"),
      db.from("plan_packs").select("*").eq("active", true).order("sort_order"),
      db.from("plan_pack_items").select("*").eq("active", true).order("sort_order"),
    ]);
    const failed = [g, p, f, k, i].find((result) => result.error);
    if (failed?.error) {
      setLoadError(failed.error.message);
      setLoading(false);
      return;
    }
    setCatalog({
      groups: g.data ?? [],
      plans: p.data ?? [],
      features: f.data ?? [],
      packs: k.data ?? [],
      packItems: i.data ?? [],
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { groups, plans, features, packs, packItems } = catalog;
  const hasPlans = groups.some((group) => plans.some((plan) => plan.group_id === group.id));
  const hasPacks = packs.length > 0;

  return (
<<<<<<< HEAD
    <div className="space-y-8">
      <SectionHeading title="お支払い" desc="Study#のプランとお支払いを管理します。" />

      <div className="payment-glacier-hero">
        <div className="relative z-10 max-w-[55%] p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Study# plans</p>
          <p className="mt-2 text-lg font-extrabold sm:text-xl">自分に合うプランを見つけよう</p>
        </div>
        <div className="payment-glacier-scene" aria-hidden="true">
          <span className="payment-glacier-sun" />
          <span className="payment-glacier-peak payment-glacier-peak-back" />
          <span className="payment-glacier-peak payment-glacier-peak-main" />
          <span className="payment-glacier-star payment-glacier-star-one" />
          <span className="payment-glacier-star payment-glacier-star-two" />
          <span className="payment-glacier-water" />
          <span className="payment-glacier-water-line" />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border bg-muted/40 p-4 text-sm">
        <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
        近日提供予定です。現在は料金の請求や購入手続きは行われません。
      </div>

      {!hasPlans && (
        <Card className="p-6">
          <CreditCard className="mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            プランは現在準備中です。すべての機能を無料でご利用いただけます。
          </p>
        </Card>
      )}

      {hasPlans && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-full border bg-muted/50 p-1 text-sm">
            {(["monthly", "yearly"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className={`rounded-full px-4 py-1.5 transition ${
                  cycle === c ? "bg-background font-semibold shadow-sm" : "text-muted-foreground"
                }`}
              >
                {c === "monthly" ? "月払い" : "年払い"}
              </button>
            ))}
=======
    <div className="space-y-7">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 p-6 text-white shadow-xl shadow-indigo-900/15 sm:p-9">
        <div className="absolute -right-14 -top-20 -z-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 right-1/4 -z-10 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="flex max-w-3xl items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/75">
              Study# Plus
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
              学びに合わせて、選ぼう。
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85">
              毎日じっくり使うならプランを。必要な分だけ使いたいときは追加パックを。
              あなたに合う形を、ここから見つけられます。
            </p>
>>>>>>> 757e9c14f5158836dc6a0bfccc90028607a991ff
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 ring-1 ring-white/20">
            <Sparkles className="h-3.5 w-3.5" /> いつでも内容を確認
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 ring-1 ring-white/20">
            <BadgeCheck className="h-3.5 w-3.5" /> 料金を事前に表示
          </span>
        </div>
      </section>

<<<<<<< HEAD
      {groups.map((g) => {
        const list = plans.filter((p) => p.group_id === g.id);
        if (list.length === 0) return null;
        const labels: {
          label: string;
          kind: "bool" | "text";
          group: string;
          desc: string | null;
          sort: number;
        }[] = [];
        for (const f of features.filter((f) => list.some((p) => p.id === f.plan_id))) {
          if (!labels.some((l) => l.label === f.label))
            labels.push({
              label: f.label,
              kind: f.kind,
              group: f.group_label ?? "",
              desc: f.description,
              sort: f.sort_order,
            });
        }
        labels.sort(
          (a, b) =>
            a.group.localeCompare(b.group, "ja") ||
            a.sort - b.sort ||
            a.label.localeCompare(b.label, "ja"),
        );
        const labelGroups: { group: string; rows: typeof labels }[] = [];
        for (const l of labels) {
          const g = labelGroups.find((x) => x.group === l.group);
          if (g) g.rows.push(l);
          else labelGroups.push({ group: l.group, rows: [l] });
        }
        return (
          <section key={g.id} className="space-y-5">
            <div className="text-center">
              <h3 className="text-lg font-bold">{g.name}</h3>
              {g.description && <p className="text-sm text-muted-foreground">{g.description}</p>}
=======
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/80 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
        <div>
          <p className="text-sm font-bold">お支払い機能は準備中です</p>
          <p className="mt-1 text-xs leading-relaxed opacity-80">
            ここではプランやパックの内容・料金を確認できます。現在、請求や購入手続きは行われません。
            すべての機能を無料でご利用いただけます。
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-black tracking-tight">どちらを見ますか？</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            継続して使うプランと、必要なときだけ選べる追加パックがあります。
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setSelection("plans")}
            className={`group rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
              selection === "plans"
                ? "border-violet-500 bg-violet-500/[0.07] shadow-sm ring-2 ring-violet-500/20"
                : "bg-card hover:border-violet-300"
            }`}
            aria-pressed={selection === "plans"}
          >
            <span className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                <CreditCard className="h-5 w-5" />
              </span>
              <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-bold text-violet-700 dark:text-violet-200">
                月額・年額
              </span>
            </span>
            <span className="mt-3 block font-bold">プランを選ぶ</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              毎月の学びを、もっと便利に。
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSelection("packs")}
            className={`group rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
              selection === "packs"
                ? "border-sky-500 bg-sky-500/[0.07] shadow-sm ring-2 ring-sky-500/20"
                : "bg-card hover:border-sky-300"
            }`}
            aria-pressed={selection === "packs"}
          >
            <span className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
                <Package className="h-5 w-5" />
              </span>
              <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-700 dark:text-sky-200">
                買い切り
              </span>
            </span>
            <span className="mt-3 block font-bold">追加パックを見る</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              必要な分だけ、気軽に追加。
            </span>
          </button>
        </div>
      </section>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> 料金情報を読み込んでいます…
        </Card>
      ) : loadError ? (
        <Card className="space-y-3 p-6 text-center">
          <p className="font-semibold">料金情報を読み込めませんでした</p>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" /> 再読み込み
          </Button>
        </Card>
      ) : selection === "plans" ? (
        <div className="space-y-8">
          {hasPlans && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Zap className="h-4 w-4 text-amber-500" />
                支払いサイクル
              </div>
              <div className="inline-flex rounded-full bg-muted p-1">
                {(["monthly", "yearly"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCycle(value)}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                      cycle === value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {value === "monthly" ? "月払い" : "年払い"}
                    {value === "yearly" && (
                      <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">
                        年額
                      </span>
                    )}
                  </button>
                ))}
              </div>
>>>>>>> 757e9c14f5158836dc6a0bfccc90028607a991ff
            </div>
          )}
          {!hasPlans && (
            <EmptyCatalog
              icon={CreditCard}
              title="プランは準備中です"
              description="公開されたプランはまだありません。現在はすべての機能を無料で利用できます。"
              actionLabel="追加パックを見る"
              onAction={() => setSelection("packs")}
            />
          )}
          {groups.map((group) => {
            const groupPlans = plans.filter((plan) => plan.group_id === group.id);
            if (!groupPlans.length) return null;
            const featured = groupPlans.find((plan) => plan.highlight) ?? groupPlans[0];
            const groupFeatures = features
              .filter((feature) => groupPlans.some((plan) => plan.id === feature.plan_id))
              .reduce<Feature[]>((rows, feature) => {
                if (!rows.some((row) => row.label === feature.label)) rows.push(feature);
                return rows;
              }, [])
              .sort((a, b) => {
                const groupOrder = (a.group_label ?? "").localeCompare(b.group_label ?? "", "ja");
                return groupOrder || a.sort_order - b.sort_order;
              });
            return (
              <section key={group.id} className="space-y-4">
                <div>
                  <h3 className="text-lg font-black">{group.name}</h3>
                  {group.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                  )}
                </div>
                <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {groupPlans.map((plan) => {
                    const price = cycle === "monthly" ? plan.price_monthly : plan.price_yearly;
                    const monthlyEquivalent =
                      cycle === "yearly" ? Math.round(plan.price_yearly / 12) : null;
                    const discount =
                      plan.price_monthly > 0 && plan.price_yearly > 0
                        ? Math.max(
                            0,
                            Math.round(
                              (1 - plan.price_yearly / (plan.price_monthly * 12)) * 100,
                            ),
                          )
                        : 0;
                    return (
                      <Card
                        key={plan.id}
                        className={`relative flex flex-col overflow-hidden rounded-3xl p-5 transition hover:-translate-y-1 hover:shadow-lg ${
                          plan.id === featured?.id
                            ? "border-violet-500/60 bg-gradient-to-b from-violet-500/[0.08] to-card shadow-md shadow-violet-500/10 ring-1 ring-violet-500/25"
                            : "bg-card"
                        }`}
                      >
                        {plan.highlight && (
                          <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 px-2.5 py-1 text-[10px] font-extrabold text-white shadow-sm">
                            <Sparkles className="h-3 w-3" /> 人気
                          </span>
                        )}
                        <div className="min-h-16 pr-16">
                          <h4 className="text-xl font-black">{plan.name}</h4>
                          {plan.description && (
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {plan.description}
                            </p>
                          )}
                        </div>
                        <div className="mt-5 border-b pb-5">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black tracking-tight">{yen(price)}</span>
                            <span className="text-xs font-medium text-muted-foreground">
                              /{cycle === "monthly" ? "月" : "年"}
                            </span>
                          </div>
                          {cycle === "yearly" && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              月あたり {yen(monthlyEquivalent ?? 0)}
                              {discount > 0 && (
                                <span className="ml-2 font-bold text-emerald-600 dark:text-emerald-400">
                                  月払いより約{discount}%お得
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        <ul className="my-4 flex-1 space-y-2.5">
                          {groupFeatures.length ? (
                            groupFeatures.map((feature) => {
                              const value = features.find(
                                (item) =>
                                  item.plan_id === plan.id && item.label === feature.label,
                              );
                              const enabled =
                                feature.kind === "bool"
                                  ? (value?.bool_value ?? false)
                                  : !!value?.text_value;
                              return (
                                <li
                                  key={feature.label}
                                  className={`flex gap-2 text-sm ${enabled ? "" : "text-muted-foreground/60"}`}
                                >
                                  {enabled ? (
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <X className="mt-0.5 h-4 w-4 shrink-0" />
                                  )}
                                  <span>
                                    <span className="font-semibold">{feature.label}</span>
                                    {feature.kind === "text" && value?.text_value && (
                                      <span className="ml-1 text-muted-foreground">
                                        {value.text_value}
                                      </span>
                                    )}
                                    {feature.description && (
                                      <span className="mt-0.5 block text-xs text-muted-foreground">
                                        {feature.description}
                                      </span>
                                    )}
                                  </span>
                                </li>
                              );
                            })
                          ) : (
                            <li className="text-xs text-muted-foreground">
                              プランの詳細は準備中です。
                            </li>
                          )}
                        </ul>
                        <Button
                          disabled
                          className={`w-full rounded-xl font-bold ${
                            plan.id === featured?.id
                              ? "bg-gradient-to-r from-violet-600 to-indigo-500 text-white hover:opacity-90"
                              : ""
                          }`}
                          variant={plan.id === featured?.id ? "default" : "outline"}
                        >
                          まもなく利用できます
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="space-y-5">
          <div className="rounded-2xl border bg-card p-4">
            <h2 className="font-bold">必要なときに、必要な分だけ。</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              追加パックは買い切り形式の商品です。各パックに含まれる内容と料金をご確認ください。
            </p>
          </div>
          {!hasPacks ? (
            <EmptyCatalog
              icon={Package}
              title="追加パックは準備中です"
              description="公開されたパックはまだありません。プランの内容もぜひご覧ください。"
              actionLabel="プランを見る"
              onAction={() => setSelection("plans")}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {packs.map((pack, index) => {
                const items = packItems.filter((item) => item.pack_id === pack.id);
                return (
                  <Card
                    key={pack.id}
                    className="overflow-hidden rounded-3xl border-sky-500/15 bg-gradient-to-br from-sky-500/[0.06] via-card to-card p-5 transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
                        {index === 0 ? (
                          <Package className="h-5 w-5" />
                        ) : (
                          <Zap className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-black">{pack.name}</h3>
                        {pack.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{pack.description}</p>
                        )}
                      </div>
                      <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-[10px] font-extrabold text-sky-700 dark:text-sky-200">
                        買い切り
                      </span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {items.length ? (
                        items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-2xl border bg-background/75 p-3"
                          >
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                              <Check className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold">{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.amount_label || item.description || "内容は準備中です"}
                              </p>
                            </div>
                            <p className="shrink-0 font-black">{yen(item.price)}</p>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center justify-between rounded-2xl border bg-background/75 p-3">
                          <span className="text-sm text-muted-foreground">商品は準備中です</span>
                          <span className="font-black">{yen(pack.price)}</span>
                        </div>
                      )}
                    </div>
                    <Button disabled variant="outline" className="mt-4 w-full rounded-xl font-bold">
                      <Package className="mr-2 h-4 w-4" /> 購入機能は準備中です
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="flex items-start gap-2 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheckIcon />
        <p>
          表示価格は管理者が登録した情報です。購入機能の提供開始時には、支払い条件や解約方法を事前に明示します。
        </p>
      </div>
    </div>
  );
}

function EmptyCatalog({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof CreditCard;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Card className="flex flex-col items-center rounded-3xl border-dashed px-6 py-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-lg font-black">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <Button variant="outline" className="mt-5 rounded-xl" onClick={onAction}>
        {actionLabel}
      </Button>
    </Card>
  );
}

function ShieldCheckIcon() {
  return <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
}
