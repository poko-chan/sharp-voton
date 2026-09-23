import { useEffect, useState } from "react";
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

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {list.map((p) => {
                const price = cycle === "monthly" ? p.price_monthly : p.price_yearly;
                const mine = features.filter((f) => f.plan_id === p.id);
                return (
                  <Card
                    key={p.id}
                    className={`flex flex-col p-5 ${
                      p.highlight ? "border-primary ring-2 ring-primary/25" : ""
                    }`}
                  >
                    {p.highlight && (
                      <span className="mb-2 inline-block w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        おすすめ
                      </span>
                    )}
                    <div className="text-2xl font-bold tracking-tight">{p.name}</div>
                    {p.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                    )}
                    <div className="mt-5 flex items-end gap-1">
                      <span className="text-3xl font-bold">{yen(price)}</span>
                      <span className="pb-1 text-sm text-muted-foreground">
                        / {cycle === "monthly" ? "月" : "年"}
                      </span>
                    </div>
                    <Button className="mt-4 w-full justify-center" variant="outline" disabled>
                      近日提供予定
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                    <ul className="mt-5 space-y-2 text-sm">
                      {mine.map((f) => (
                        <li key={f.id} className="flex items-start gap-2">
                          {f.kind === "bool" ? (
                            f.bool_value ? (
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            ) : (
                              <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                            )
                          ) : (
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          )}
                          <span
                            className={
                              f.kind === "bool" && !f.bool_value ? "text-muted-foreground" : ""
                            }
                          >
                            {f.label}
                            {f.kind === "text" && f.text_value ? `：${f.text_value}` : ""}
                            {f.description && (
                              <span className="block text-xs text-muted-foreground/80">
                                {f.description}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                );
              })}
            </div>

            {labels.length > 0 && (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left font-medium">機能</th>
                      {list.map((p) => (
                        <th key={p.id} className="p-3 text-center font-medium">
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {labels.map((l) => (
                      <tr key={l.label} className="border-t">
                        <td className="p-3">{l.label}</td>
                        {list.map((p) => {
                          const f = features.find(
                            (x) => x.plan_id === p.id && x.label === l.label,
                          );
                          return (
                            <td key={p.id} className="p-3 text-center">
                              {l.kind === "bool" ? (
                                f?.bool_value ? (
                                  <Check className="mx-auto h-4 w-4 text-primary" />
                                ) : (
                                  <X className="mx-auto h-4 w-4 text-muted-foreground/50" />
                                )
                              ) : (
                                <span className="text-muted-foreground">
                                  {f?.text_value || "—"}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
