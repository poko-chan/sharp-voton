import { useEffect, useState } from "react";
import { BadgeCheck, Check, CreditCard, Package, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
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
};
type Pack = { id: string; name: string; description: string | null; price: number };

const db = supabase as any;

function yen(n: number) {
  return n === 0 ? "無料" : `¥${n.toLocaleString("ja-JP")}`;
}

export function PaymentSection() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);

  useEffect(() => {
    (async () => {
      const [g, p, f, k] = await Promise.all([
        db.from("plan_groups").select("*").eq("active", true).order("sort_order"),
        db.from("plans").select("*").eq("active", true).order("sort_order"),
        db.from("plan_features").select("*").order("sort_order"),
        db.from("plan_packs").select("*").eq("active", true).order("sort_order"),
      ]);
      setGroups(g.data ?? []);
      setPlans(p.data ?? []);
      setFeatures(f.data ?? []);
      setPacks(k.data ?? []);
    })();
  }, []);

  const hasPlans = plans.length > 0;

  return (
    <div className="space-y-6">
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

      {groups.map((g) => {
        const list = plans.filter((p) => p.group_id === g.id);
        if (list.length === 0) return null;
        return (
          <section key={g.id} className="space-y-3">
            <div>
              <h3 className="font-semibold">{g.name}</h3>
              {g.description && (
                <p className="text-xs text-muted-foreground">{g.description}</p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => (
                <Card
                  key={p.id}
                  className={`p-5 ${p.highlight ? "border-primary ring-1 ring-primary/30" : ""}`}
                >
                  {p.highlight && (
                    <span className="mb-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      おすすめ
                    </span>
                  )}
                  <div className="font-semibold">{p.name}</div>
                  {p.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                  )}
                  <div className="mt-3 text-2xl font-bold">
                    {yen(p.price_monthly)}
                    {p.price_monthly > 0 && (
                      <span className="text-sm font-normal text-muted-foreground"> / 月</span>
                    )}
                  </div>
                  {p.price_yearly > 0 && (
                    <div className="text-xs text-muted-foreground">
                      年額 {yen(p.price_yearly)}
                    </div>
                  )}
                  <ul className="mt-4 space-y-1.5 text-sm">
                    {features
                      .filter((f) => f.plan_id === p.id)
                      .map((f) => (
                        <li key={f.id} className="flex items-start gap-2">
                          {f.kind === "bool" ? (
                            f.bool_value ? (
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            ) : (
                              <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            )
                          ) : (
                            <span className="mt-0.5 text-xs text-muted-foreground">•</span>
                          )}
                          <span
                            className={
                              f.kind === "bool" && !f.bool_value
                                ? "text-muted-foreground line-through"
                                : ""
                            }
                          >
                            {f.label}
                            {f.kind === "text" && f.text_value ? `：${f.text_value}` : ""}
                          </span>
                        </li>
                      ))}
                  </ul>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      {packs.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 font-semibold">
            <Package className="h-4 w-4" /> 追加パック
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {packs.map((k) => (
              <Card key={k.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-sm font-semibold">{k.name}</div>
                  {k.description && (
                    <p className="text-xs text-muted-foreground">{k.description}</p>
                  )}
                </div>
                <div className="shrink-0 text-lg font-bold">{yen(k.price)}</div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
