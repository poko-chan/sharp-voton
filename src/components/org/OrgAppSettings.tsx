import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ORG_APPS } from "@/lib/org-apps";
import { LayoutGrid } from "lucide-react";

export function OrgAppSettings({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<Record<string, any>>({});

  const load = async () => {
    const { data } = await (supabase as any).from("org_app_settings").select("*").eq("organization_id", orgId);
    const map: Record<string, any> = {};
    for (const r of data ?? []) map[r.app_key] = r;
    setRows(map);
  };
  useEffect(() => { load(); }, [orgId]);

  const save = async (key: string, patch: any) => {
    const current = rows[key];
    const payload = { organization_id: orgId, app_key: key, enabled: current?.enabled ?? true, label: current?.label ?? null, ...patch };
    const { error } = await (supabase as any).from("org_app_settings").upsert(payload, { onConflict: "organization_id,app_key" });
    if (error) return toast.error(error.message);
    setRows((r) => ({ ...r, [key]: { ...(r[key] ?? {}), ...payload } }));
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-3">
      <Link to="/organizations/$orgId" params={{ orgId }} className="text-sm underline text-muted-foreground">← 組織ホームへ</Link>
      <h1 className="text-xl font-bold flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-primary" />アプリ管理</h1>
      <p className="text-xs text-muted-foreground">組織のホームに表示するアプリと、その表示名を設定します。</p>
      {ORG_APPS.map((a) => {
        const r = rows[a.key];
        return (
          <Card key={a.key} className="p-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[160px]">
              <div className="font-medium text-sm">{a.label}</div>
              <div className="text-[11px] text-muted-foreground">{a.desc}</div>
            </div>
            <Input className="w-44 h-8" placeholder="表示名（任意）" defaultValue={r?.label ?? ""}
              onBlur={(e) => save(a.key, { label: e.target.value || null })} />
            <Switch checked={r ? r.enabled : true} onCheckedChange={(v) => save(a.key, { enabled: v })} />
          </Card>
        );
      })}
    </div>
  );
}
