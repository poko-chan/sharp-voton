import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check } from "lucide-react";

export function OrgNotifications({ orgId }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data } = await (supabase as any).from("org_notifications").select("*")
      .eq("organization_id", orgId).eq("user_id", user!.id).order("created_at", { ascending: false }).limit(100);
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [orgId]);

  const markAll = async () => {
    await (supabase as any).from("org_notifications").update({ read_at: new Date().toISOString() })
      .eq("organization_id", orgId).eq("user_id", user!.id).is("read_at", null);
    load();
  };

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={markAll}><Check className="h-3 w-3 mr-1" />すべて既読にする</Button>
      {rows.length === 0 && <Card className="p-6 text-sm text-muted-foreground">通知はありません</Card>}
      {rows.map((n) => (
        <Card key={n.id} className={`p-3 flex items-start gap-2 ${n.read_at ? "opacity-60" : ""}`}>
          <Bell className="h-4 w-4 mt-0.5 text-amber-500" />
          <div className="flex-1">
            <div className="text-sm font-medium">{n.title}</div>
            {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
            <div className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("ja-JP")}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}
