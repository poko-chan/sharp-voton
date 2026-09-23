import { Fragment, useEffect, useState } from "react";
import { BadgeCheck, Check, ChevronRight, CreditCard, Package, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "./shared";

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
type Pack = { id: string; name: string; description: string | null; price: number };
type PackItem = {
  id: string;
  pack_id: string;
  name: string;
  description: string | null;
  price: number;
  amount_label: string | null;
};

const db = supabase as any;

function yen(n: number) {
  return n === 0 ? "¥0" : `¥${n.toLocaleString("ja-JP")}`;
}

export function PaymentSection() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [packItems, setPackItems] = useState<PackItem[]>([]);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    (async () => {
      const [g, p, f, k, i] = await Promise.all([
        db.from("plan_groups").select("*").eq("active", true).order("sort_order"),
        db.from("plans").select("*").eq("active", true).order("sort_order"),
        db.from("plan_features").select("*").order("sort_order"),
        db.from("plan_packs").select("*").eq("active", true).order("sort_order"),
        db.from("plan_pack_items").select("*").eq("active", true).order("sort_order"),
      ]);
      setGroups(g.data ?? []);
      setPlans(p.data ?? []);
      setFeatures(f.data ?? []);
      setPacks(k.data ?? []);
      setPackItems(i.data ?? []);
    })();
  }, []);

  const hasPlans = plans.length > 0;

  return (
    <div className="space-y-8">
      <SectionHeading title="お支払い" desc="Study#のプランとお支払いを管理します。" />

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
          </div>
        </div>
      )}

      {groups.map((g) => {
        const list = plans.filter((p) => p.group_id === g.id);
        if (list.length === 0) return null;
        const labels: { label: string; kind: "bool" | "text"; group: string; desc: string | null }[] = [];
        for (const f of features.filter((f) => list.some((p) => p.id === f.plan_id))) {
          if (!labels.some((l) => l.label === f.label))
            labels.push({
              label: f.label,
              kind: f.kind,
              group: f.group_label ?? "",
              desc: f.description,
            });
        }
        labels.sort((a, b) => a.group.localeCompare(b.group, "ja"));
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
              {g.description && (
                <p className="text-sm text-muted-foreground">{g.description}</p>
              )}
            </div>

            {(() => {
              const featured = list.find((p) => p.highlight) ?? list[0];
              return (
                <div className="overflow-x-auto rounded-2xl border-2 border-primary/20 bg-card shadow-lg shadow-primary/5">
                  <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 bg-card p-4 align-bottom text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          使える機能やメリット
                        </th>
                        {list.map((p) => {
                          const price = cycle === "monthly" ? p.price_monthly : p.price_yearly;
                          return (
                            <th
                              key={p.id}
                              className={`min-w-[150px] p-4 align-bottom ${
                                p.id === featured?.id
                                  ? "border-x-2 border-t-2 border-primary/30 bg-primary/5"
                                  : ""
                              }`}
                            >
                              <div className="flex flex-col items-center gap-1.5 text-center">
                                {p.highlight && (
                                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-primary-foreground">
                                    おすすめ
                                  </span>
                                )}
                                <span className="text-lg font-extrabold tracking-tight">{p.name}</span>
                                {p.description && (
                                  <span className="text-xs font-normal text-muted-foreground">
                                    {p.description}
                                  </span>
                                )}
                                <span className="mt-1 flex items-baseline gap-0.5">
                                  <span className="text-2xl font-extrabold">{yen(price)}</span>
                                  <span className="text-xs font-medium text-muted-foreground">
                                    /{cycle === "monthly" ? "月" : "年"}
                                  </span>
                                </span>
                                <Button
                                  size="sm"
                                  disabled
                                  variant={p.highlight ? "default" : "outline"}
                                  className="mt-1 w-full justify-center rounded-full font-extrabold uppercase tracking-wide"
                                >
                                  近日提供予定
                                </Button>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {labelGroups.map((lg) => (
                        <Fragment key={lg.group || "ungrouped"}>
                          {lg.group && (
                            <tr key={`g-${lg.group}`}>
                              <td
                                colSpan={list.length + 1}
                                className="border-t-2 border-primary/10 bg-primary/5 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-primary"
                              >
                                {lg.group}
                              </td>
                            </tr>
                          )}
                          {lg.rows.map((l) => (
                            <tr key={l.label} className="group transition-colors hover:bg-muted/40">
                              <td className="border-t bg-card p-4 align-top group-hover:bg-transparent">
                                <span className="font-semibold">{l.label}</span>
                                {l.desc && (
                                  <span className="block text-xs text-muted-foreground/80">
                                    {l.desc}
                                  </span>
                                )}
                              </td>
                              {list.map((p) => {
                                const f = features.find(
                                  (x) => x.plan_id === p.id && x.label === l.label,
                                );
                                return (
                                  <td
                                    key={p.id}
                                    className={`border-t p-4 text-center ${
                                      p.id === featured?.id
                                        ? "border-x bg-primary/5"
                                        : ""
                                    } ${l === lg.rows[lg.rows.length - 1] ? "border-b" : ""}`}
                                  >
                                    {l.kind === "bool" ? (
                                      f?.bool_value ? (
                                        <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">
                                          <Check className="h-4 w-4 font-black text-primary" strokeWidth={3} />
                                        </span>
                                      ) : (
                                        <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                                      )
                                    ) : (
                                      <span className="font-semibold text-muted-foreground">
                                        {f?.text_value || "—"}
                                      </span>
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
              );
            })()}
          </section>
        );
      })}

      {packs.length > 0 && (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <Package className="h-4 w-4" /> 追加パック
          </h3>
          {packs.map((k) => {
            const items = packItems.filter((it) => it.pack_id === k.id);
            return (
              <Card key={k.id} className="space-y-3 p-5">
                <div>
                  <div className="font-semibold">{k.name}</div>
                  {k.description && (
                    <p className="text-xs text-muted-foreground">{k.description}</p>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div>
                        <div className="text-sm font-medium">{it.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {it.amount_label || it.description || ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-base font-bold">{yen(it.price)}</div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <span className="text-sm text-muted-foreground">商品は準備中です</span>
                      <span className="text-base font-bold">{yen(k.price)}</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
