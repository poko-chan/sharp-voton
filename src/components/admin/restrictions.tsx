import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Ban, AlertOctagon } from "lucide-react";
import { SERVICES } from "@/lib/restriction-context";
import { toast } from "sonner";

export function RestrictionsHub() {
  const [inner, setInner] = useState<"global" | "user">("global");
  return (
    <div className="mt-4 space-y-4">
      <Tabs value={inner} onValueChange={(v) => setInner(v as any)}>
        <TabsList>
          <TabsTrigger value="global" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-600">全体停止</TabsTrigger>
          <TabsTrigger value="user" className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600">ユーザー別</TabsTrigger>
        </TabsList>
        <TabsContent value="global"><ServiceStopTab /></TabsContent>
        <TabsContent value="user"><UserRestrictionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

export function ServiceStopTab() {
  const [rows, setRows] = useState<Record<string, { restricted: boolean; message: string; restricted_until: string | null }>>({});
  const load = async () => {
    const { data } = await supabase.from("service_restrictions").select("*");
    const map: Record<string, any> = {};
    (data ?? []).forEach((r) => { map[r.service_key] = { restricted: !!r.restricted, message: r.message ?? "", restricted_until: r.restricted_until }; });
    setRows(map);
  };
  useEffect(() => { load(); }, []);
  const save = async (key: string, patch: Partial<{ restricted: boolean; message: string; restricted_until: string | null }>) => {
    const cur = rows[key] ?? { restricted: false, message: "", restricted_until: null };
    const next = { ...cur, ...patch };
    const { error } = await supabase.from("service_restrictions").upsert({
      service_key: key,
      restricted: next.restricted,
      message: next.message || null,
      restricted_until: next.restricted_until,
    });
    if (error) toast.error(error.message); else { setRows((p) => ({ ...p, [key]: next })); }
  };
  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4 max-w-3xl space-y-2 border-red-500/30">
        <div className="flex items-center gap-2 text-red-600"><Ban className="h-5 w-5" /><h3 className="font-semibold">サービス別 利用停止（全ユーザー）</h3></div>
        <p className="text-sm text-muted-foreground">特定のサービス（タイマー・AIチャット・Voton Classroom など）を全ユーザーに対して停止します。該当ページに入ると赤いオーバーレイが表示されます。</p>
      </Card>
      <Card className="p-0 overflow-hidden max-w-5xl">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr className="text-left">
            <th className="p-3">サービス</th><th className="p-3">停止</th><th className="p-3">メッセージ</th><th className="p-3">解除予定</th>
          </tr></thead>
          <tbody>
            {SERVICES.map((s) => {
              const r = rows[s.key] ?? { restricted: false, message: "", restricted_until: null };
              return (
                <tr key={s.key} className="border-t align-top">
                  <td className="p-3 font-medium">{s.label}<div className="text-xs text-muted-foreground">{s.key}</div></td>
                  <td className="p-3"><Switch checked={r.restricted} onCheckedChange={(v) => save(s.key, { restricted: v })} /></td>
                  <td className="p-3"><Textarea rows={2} defaultValue={r.message} onBlur={(e) => save(s.key, { message: e.target.value })} placeholder="メンテナンス中です…" /></td>
                  <td className="p-3"><Input type="datetime-local" defaultValue={r.restricted_until ? new Date(r.restricted_until).toISOString().slice(0, 16) : ""} onBlur={(e) => save(s.key, { restricted_until: e.target.value ? new Date(e.target.value).toISOString() : null })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function UserRestrictionsTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [restrictions, setRestrictions] = useState<Record<string, Record<string, any>>>({});
  const [filter, setFilter] = useState("");
  const [selectedService, setSelectedService] = useState<string>(SERVICES[0].key);

  const load = async () => {
    const { data: profiles } = await supabase.from("profiles").select("id, username, display_name").order("display_name");
    setUsers(profiles ?? []);
    const { data: rs } = await supabase.from("user_service_restrictions").select("*");
    const map: Record<string, Record<string, any>> = {};
    (rs ?? []).forEach((r) => {
      if (!map[r.user_id]) map[r.user_id] = {};
      map[r.user_id][r.service_key] = r;
    });
    setRestrictions(map);
  };
  useEffect(() => { load(); }, []);

  const save = async (userId: string, patch: Partial<{ restricted: boolean; message: string; restricted_until: string | null }>) => {
    const cur = restrictions[userId]?.[selectedService] ?? { restricted: true, message: "", restricted_until: null };
    const next = { ...cur, ...patch };
    const { error } = await supabase.from("user_service_restrictions").upsert({
      user_id: userId,
      service_key: selectedService,
      restricted: next.restricted,
      message: next.message || null,
      restricted_until: next.restricted_until,
    }, { onConflict: "user_id,service_key" });
    if (error) toast.error(error.message); else load();
  };

  const filtered = users.filter((u) => {
    const q = filter.toLowerCase();
    return !q || (u.username ?? "").toLowerCase().includes(q) || (u.display_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4 max-w-3xl space-y-2 border-blue-500/30">
        <div className="flex items-center gap-2 text-blue-600"><AlertOctagon className="h-5 w-5" /><h3 className="font-semibold">サービス別 個別制限</h3></div>
        <p className="text-sm text-muted-foreground">特定のユーザー × 特定のサービスへのアクセスを制限します。</p>
        <div className="flex gap-2 flex-wrap items-center">
          <Label className="text-xs">対象サービス</Label>
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SERVICES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="ユーザー名・メールで検索" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        </div>
      </Card>
      <Card className="p-0 overflow-hidden max-w-4xl">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr className="text-left">
            <th className="p-3">ユーザー</th><th className="p-3">制限</th><th className="p-3">メッセージ</th><th className="p-3">解除予定</th>
          </tr></thead>
          <tbody>
            {filtered.map((u) => {
              const r = restrictions[u.id]?.[selectedService];
              const restricted = !!r?.restricted;
              return (
                <tr key={u.id + selectedService} className="border-t align-top">
                  <td className="p-3"><div className="font-medium">{u.display_name ?? u.username}</div><div className="text-xs text-muted-foreground">@{u.username}</div></td>
                  <td className="p-3"><Switch checked={restricted} onCheckedChange={(v) => save(u.id, { restricted: v })} /></td>
                  <td className="p-3"><Textarea rows={2} defaultValue={r?.message ?? ""} onBlur={(e) => save(u.id, { message: e.target.value })} placeholder="制限の理由…" /></td>
                  <td className="p-3"><Input type="datetime-local" defaultValue={r?.restricted_until ? new Date(r.restricted_until).toISOString().slice(0, 16) : ""} onBlur={(e) => save(u.id, { restricted_until: e.target.value ? new Date(e.target.value).toISOString() : null })} /></td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground text-sm">ユーザーがいません</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

