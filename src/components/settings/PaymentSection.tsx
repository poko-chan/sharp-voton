import { Fragment, useCallback, useEffect, useState } from "react";
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
  sub_group: string | null;
  tagline: string | null;
};
type Faq = { id: string; question: string; answer: string };
type Feature = {
  id: string;
  plan_id: string;
  kind: "bool" | "tri" | "quad" | "stars" | "custom" | "text";
  label: string;
  bool_value: boolean;
  text_value: string | null;
  sort_order: number;
  description: string | null;
  group_label: string | null;
  options: FeatureOption[];
  show_check: boolean;
};
type FeatureOption = { value: string; label: string; description: string };
type Pack = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
};
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
const defaultBoolOptions: FeatureOption[] = [
  { value: "yes", label: "◯", description: "" },
  { value: "no", label: "×", description: "" },
];

function yen(n: number) {
  return n === 0 ? "¥0" : `¥${n.toLocaleString("ja-JP")}`;
}

export function PaymentSection() {
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [selection, setSelection] = useState<"plans" | "packs">("plans");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);

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
    const q = await db.from("plan_faqs").select("id, question, answer").eq("active", true).order("sort_order");
    setFaqs(q.data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { groups, features, packs, packItems } = catalog;
  const subGroups = Array.from(
    new Set(catalog.plans.map((p) => p.sub_group?.trim() || "")),
  );
  const hasSubTabs = subGroups.length > 1 || (subGroups.length === 1 && subGroups[0] !== "");
  const activeSub = sub !== null && subGroups.includes(sub) ? sub : (subGroups[0] ?? "");
  const plans = hasSubTabs
    ? catalog.plans.filter((p) => (p.sub_group?.trim() || "") === activeSub)
    : catalog.plans;
  const maxSaving = catalog.plans.reduce((m, p) => {
    if (p.price_monthly <= 0 || p.price_yearly <= 0) return m;
    return Math.max(m, Math.round((1 - p.price_yearly / (p.price_monthly * 12)) * 100));
  }, 0);
  const hasPlans = groups.some((group) => plans.some((plan) => plan.group_id === group.id));
  const hasPacks = packs.length > 0;

  return (
    <div className="space-y-7">
      <section className="payment-glacier-hero px-6 py-6 sm:p-9">
        <div className="payment-glacier-scene" aria-hidden="true">
          <span className="payment-glacier-sun" />
          <span className="payment-glacier-peak payment-glacier-peak-back" />
          <span className="payment-glacier-peak payment-glacier-peak-main" />
          <span className="payment-glacier-star payment-glacier-star-one" />
          <span className="payment-glacier-star payment-glacier-star-two" />
          <span className="payment-glacier-water" />
          <span className="payment-glacier-water-line" />
        </div>
        <div className="relative z-10 flex max-w-3xl items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Wallet className="h-6 w-6" />
          </div>
          <div className="max-w-[55%]">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">
              Study# Plus
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
              学びに合わせて、選ぼう。
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-foreground/80">
              毎日じっくり使うならプランを。必要な分だけ使いたいときは追加パックを。
              あなたに合う形を、ここから見つけられます。
            </p>
          </div>
        </div>
        <div className="relative z-10 mt-6 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-primary">
            <Sparkles className="h-3.5 w-3.5" /> いつでも内容を確認
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-primary">
            <BadgeCheck className="h-3.5 w-3.5" /> 料金を事前に表示
          </span>
        </div>
      </section>

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
          {hasSubTabs && (
            <div className="flex flex-wrap justify-center gap-2">
              {subGroups.map((name) => (
                <button
                  key={name || "default"}
                  type="button"
                  onClick={() => setSub(name)}
                  className={`rounded-full border px-5 py-2.5 text-sm font-bold transition ${
                    activeSub === name
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {name || "標準プラン"}
                </button>
              ))}
            </div>
          )}
          {hasPlans && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Zap className="h-4 w-4 text-primary" />
                支払いサイクル
                {maxSaving > 0 && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                    年払いで最大{maxSaving}%お得
                  </span>
                )}
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
                  </button>
                ))}
              </div>
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
                return (
                  groupOrder || a.sort_order - b.sort_order || a.label.localeCompare(b.label, "ja")
                );
              });
            const featureGroups = new Map<string, Feature[]>();
            for (const feature of groupFeatures) {
              const key = feature.group_label ?? "";
              const rows = featureGroups.get(key) ?? [];
              rows.push(feature);
              featureGroups.set(key, rows);
            }
            return (
              <section key={group.id} className="space-y-4">
                <div>
                  <h3 className="text-lg font-black">{group.name}</h3>
                  {group.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                  )}
                </div>
                <div
                  className={`grid gap-4 ${
                    groupPlans.length >= 3 ? "md:grid-cols-3" : groupPlans.length === 2 ? "md:grid-cols-2" : ""
                  }`}
                >
                  {groupPlans.map((plan) => {
                    const isFeatured = plan.id === featured?.id && groupPlans.length > 1;
                    const price = cycle === "monthly" ? plan.price_monthly : plan.price_yearly;
                    const saving =
                      plan.price_monthly > 0 && plan.price_yearly > 0
                        ? plan.price_monthly * 12 - plan.price_yearly
                        : 0;
                    const highlights = features
                      .filter((f) => f.plan_id === plan.id)
                      .filter((f) =>
                        f.kind === "text" ? !!f.text_value : f.kind === "bool" ? f.bool_value : !!f.text_value && f.text_value !== "no",
                      )
                      .slice(0, 5);
                    return (
                      <div
                        key={plan.id}
                        className={`relative flex flex-col rounded-3xl border p-6 transition hover:-translate-y-1 hover:shadow-xl ${
                          isFeatured
                            ? "border-primary bg-gradient-to-b from-primary/10 via-card to-card shadow-lg ring-2 ring-primary/30"
                            : "bg-card"
                        }`}
                      >
                        {isFeatured && (
                          <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow">
                            <Sparkles className="h-3 w-3" /> いちばん人気
                          </span>
                        )}
                        {plan.tagline && (
                          <span className="mb-2 w-fit rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                            {plan.tagline}
                          </span>
                        )}
                        <h4 className="text-xl font-black">{plan.name}</h4>
                        {plan.description && (
                          <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                        )}
                        <div className="mt-5 flex items-end gap-1">
                          <span className="text-4xl font-black tracking-tight tabular-nums">
                            {yen(price)}
                          </span>
                          <span className="pb-1 text-sm text-muted-foreground">
                            /{cycle === "monthly" ? "月" : "年"}
                          </span>
                        </div>
                        <p className="mt-1 h-4 text-xs font-semibold text-primary">
                          {cycle === "yearly" && saving > 0
                            ? `月換算 ${yen(Math.round(plan.price_yearly / 12))}・年間 ${yen(saving)} お得`
                            : cycle === "monthly" && saving > 0
                              ? `年払いなら年間 ${yen(saving)} お得`
                              : ""}
                        </p>
                        <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                          {highlights.map((f) => (
                            <li key={f.id} className="flex items-start gap-2">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <span>
                                {f.label}
                                {f.kind === "text" && f.text_value && (
                                  <span className="text-muted-foreground">：{f.text_value}</span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <Button
                          disabled
                          variant={isFeatured ? "default" : "outline"}
                          className="mt-6 w-full rounded-xl font-bold"
                        >
                          まもなく利用できます
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <details className="group rounded-2xl border bg-card/50">
                  <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-bold">
                    すべての機能を詳しく比べる
                    <span className="text-muted-foreground transition group-open:rotate-180">▾</span>
                  </summary>
                <div className="overflow-x-auto rounded-b-2xl border-t bg-card">
                  <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 min-w-48 bg-card p-4 text-left text-xs font-bold text-muted-foreground">
                          項目
                        </th>
                        {groupPlans.map((plan) => {
                          const price =
                            cycle === "monthly" ? plan.price_monthly : plan.price_yearly;
                          return (
                            <th
                              key={plan.id}
                              className={`min-w-40 border-l p-4 text-center align-top ${
                                plan.id === featured?.id ? "bg-primary/5" : ""
                              }`}
                            >
                              {plan.highlight && (
                                <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
                                  <Sparkles className="h-3 w-3" /> おすすめ
                                </span>
                              )}
                              <div className="font-black">{plan.name}</div>
                              {plan.description && (
                                <div className="mt-1 text-xs font-normal text-muted-foreground">
                                  {plan.description}
                                </div>
                              )}
                              <div className="mt-3 text-xl font-black">{yen(price)}</div>
                              <div className="text-[11px] text-muted-foreground">
                                /{cycle === "monthly" ? "月" : "年"}
                              </div>
                              <Button
                                disabled
                                size="sm"
                                variant={plan.id === featured?.id ? "default" : "outline"}
                                className="mt-3 w-full text-xs"
                              >
                                まもなく利用できます
                              </Button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(featureGroups, ([groupLabel, rows]) => (
                        <Fragment key={groupLabel || "ungrouped"}>
                          {groupLabel && (
                            <tr>
                              <th
                                colSpan={groupPlans.length + 1}
                                className="border-t bg-muted/50 px-4 py-2 text-left text-xs font-bold text-primary"
                              >
                                {groupLabel}
                              </th>
                            </tr>
                          )}
                          {rows.map((feature) => (
                            <tr key={feature.label} className="transition-colors hover:bg-muted/30">
                              <th className="sticky left-0 z-10 border-t bg-card p-4 text-left align-top">
                                <span className="font-semibold">{feature.label}</span>
                                {feature.description && (
                                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                                    {feature.description}
                                  </span>
                                )}
                              </th>
                              {groupPlans.map((plan) => {
                                const value = features.find(
                                  (item) =>
                                    item.plan_id === plan.id && item.label === feature.label,
                                );
                                const options =
                                  feature.options?.length > 0
                                    ? feature.options
                                    : feature.kind === "bool"
                                      ? defaultBoolOptions
                                      : [];
                                const selectedOption = options.find(
                                  (option) =>
                                    option.value ===
                                    (feature.kind === "bool"
                                      ? value?.bool_value
                                        ? "yes"
                                        : "no"
                                      : value?.text_value),
                                );
                                return (
                                  <td
                                    key={plan.id}
                                    className={`border-l border-t p-4 text-center align-top ${
                                      plan.id === featured?.id ? "bg-primary/5" : ""
                                    }`}
                                  >
                                    {feature.kind === "text" ? (
                                      <div className="flex items-start justify-center gap-2">
                                        {feature.show_check &&
                                          (value?.bool_value ? (
                                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                          ) : (
                                            <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                                          ))}
                                        <div>
                                          <span className="font-semibold">
                                            {value?.text_value || "—"}
                                          </span>
                                        </div>
                                      </div>
                                    ) : feature.kind === "bool" ? (
                                      <div>
                                        <span className="text-lg font-bold">
                                          {value?.bool_value ? "◯" : "×"}
                                        </span>
                                        {selectedOption?.description && (
                                          <span className="mt-1 block text-xs text-muted-foreground">
                                            {selectedOption.description}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <div>
                                        <span className="font-bold">
                                          {selectedOption?.label ?? "—"}
                                        </span>
                                        {selectedOption?.description && (
                                          <span className="mt-1 block text-xs text-muted-foreground">
                                            {selectedOption.description}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                </details>
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

      {faqs.length > 0 && (
        <section className="space-y-4">
          <div className="text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">FAQ</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">よくあるご質問</h2>
          </div>
          <div className="mx-auto max-w-3xl divide-y rounded-3xl border bg-card">
            {faqs.map((f) => {
              const open = openFaq === f.id;
              return (
                <div key={f.id}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : f.id)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left font-bold"
                    aria-expanded={open}
                  >
                    <span className="flex items-start gap-3">
                      <span className="text-primary">Q.</span>
                      {f.question}
                    </span>
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-sm transition ${
                        open ? "rotate-45 bg-primary text-primary-foreground" : ""
                      }`}
                    >
                      +
                    </span>
                  </button>
                  {open && (
                    <p className="whitespace-pre-wrap px-5 pb-5 pl-11 text-sm leading-relaxed text-muted-foreground">
                      {f.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
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
