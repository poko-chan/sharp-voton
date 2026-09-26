import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ORG_APPS } from "@/lib/org-apps";
import { ORG_PRESETS, type OrgPresetKey } from "@/lib/org-presets";
import { Check, ChevronRight, Sparkles, Wand2 } from "lucide-react";

/**
 * 組織のはじめの設定ウィザード。
 * 業態プリセット → 使うアプリ選択 → 役職の初期作成 までを一気に行う。
 */
export function OrgSetupWizard({ orgId, onDone }: { orgId: string; onDone?: () => void }) {
  const [step, setStep] = useState(0);
  const [preset, setPreset] = useState<OrgPresetKey | null>(null);
  const [apps, setApps] = useState<string[]>([]);
  const [makeRoles, setMakeRoles] = useState(true);
  const [busy, setBusy] = useState(false);

  const current = ORG_PRESETS.find((p) => p.key === preset);

  const choosePreset = (k: OrgPresetKey) => {
    setPreset(k);
    setApps(ORG_PRESETS.find((p) => p.key === k)?.apps ?? []);
    setStep(1);
  };

  const toggle = (k: string) =>
    setApps((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));

  const finish = async () => {
    setBusy(true);
    const rows = ORG_APPS.map((a, i) => ({
      organization_id: orgId,
      app_key: a.key,
      enabled: apps.includes(a.key),
      sort_order: i,
    }));
    const { error } = await (supabase as any)
      .from("org_app_settings")
      .upsert(rows, { onConflict: "organization_id,app_key" });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    if (makeRoles && current?.roles.length) {
      const { data: existing } = await (supabase as any)
        .from("org_custom_roles")
        .select("name")
        .eq("organization_id", orgId);
      const have = new Set((existing ?? []).map((r: any) => r.name));
      const insert = current.roles
        .filter((r) => !have.has(r.name))
        .map((r, i) => ({ organization_id: orgId, ...r, sort_order: i }));
      if (insert.length) await (supabase as any).from("org_custom_roles").insert(insert);
    }
    setBusy(false);
    toast.success("組織のはじめの設定が完了しました");
    onDone?.();
  };

  return (
    <Card className="overflow-hidden border-primary/30">
      <div className="bg-primary/10 px-5 py-4 flex items-center gap-3">
        <Wand2 className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <div className="font-bold">組織のはじめの設定</div>
          <div className="text-xs text-muted-foreground">
            使うアプリと役職をまとめて用意します（あとから変更できます）
          </div>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {step === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {ORG_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => choosePreset(p.key)}
                className="rounded-xl border p-4 text-left transition hover:border-primary hover:bg-muted/50"
              >
                <div className="text-2xl">{p.emoji}</div>
                <div className="mt-1 font-bold text-sm">{p.label}</div>
                <div className="text-xs text-muted-foreground">{p.hint}</div>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="text-sm font-bold">使うアプリを選んでください</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ORG_APPS.map((a) => {
                const on = apps.includes(a.key);
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => toggle(a.key)}
                    className={`rounded-xl border p-3 text-left transition ${
                      on ? "border-primary bg-primary/10" : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: a.color }}
                      />
                      <span className="text-sm font-bold flex-1">{a.label}</span>
                      {on && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{a.desc}</div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                戻る
              </Button>
              <Button onClick={() => setStep(2)} disabled={apps.length === 0}>
                次へ
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="text-sm font-bold">役職の初期セット</div>
            {current?.roles.length ? (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={makeRoles}
                    onChange={(e) => setMakeRoles(e.target.checked)}
                  />
                  下の役職をまとめて作成する
                </label>
                <div className="flex flex-wrap gap-2">
                  {current.roles.map((r) => (
                    <span
                      key={r.name}
                      className="text-xs px-3 py-1.5 rounded-full border"
                      style={{ borderColor: r.color, color: r.color }}
                    >
                      {r.name}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                この構成では役職の自動作成はありません。あとから自由に作れます。
              </p>
            )}
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <Sparkles className="inline h-3.5 w-3.5 mr-1 text-primary" />
              選んだアプリ {apps.length} 個が組織ホームに並びます。
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                戻る
              </Button>
              <Button onClick={finish} disabled={busy}>
                この内容ではじめる
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
