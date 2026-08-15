import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IdCard, Save } from "lucide-react";
import { toast } from "sonner";
import { loadOrgProfiles, nameOf } from "@/lib/org-apps";

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try { JsBarcode(ref.current, value, { format: "CODE128", displayValue: true, height: 60, margin: 4 }); } catch { /* noop */ }
  }, [value]);
  return <svg ref={ref} role="img" aria-label={`バーコード ${value}`} />;
}

function QR({ value }: { value: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => { if (value) QRCode.toDataURL(value, { margin: 1, width: 140 }).then(setUrl).catch(() => {}); }, [value]);
  return url ? <img src={url} alt="QRコード" className="rounded bg-white p-1" /> : null;
}

export function OrgDigitalId({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const [mine, setMine] = useState<any>(null);
  const [all, setAll] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [edit, setEdit] = useState<Record<string, any>>({});

  const load = async () => {
    const { data } = await (supabase as any).from("org_digital_ids").select("*").eq("organization_id", orgId);
    setAll(data ?? []);
    setMine((data ?? []).find((d: any) => d.user_id === user!.id) ?? null);
    if (ctx.isStaff) {
      const { data: m } = await (supabase as any).from("organization_members").select("user_id, role").eq("organization_id", orgId);
      setMembers(m ?? []);
      setProfiles(await loadOrgProfiles(orgId, (m ?? []).map((x: any) => x.user_id)));
    }
  };
  useEffect(() => { load(); }, [orgId, ctx.isStaff]);

  const save = async (userId: string) => {
    const e = edit[userId] ?? {};
    const { error } = await (supabase as any).from("org_digital_ids").upsert({
      organization_id: orgId, user_id: userId,
      id_number: e.id_number ?? null, barcode_value: e.barcode_value ?? null,
      full_name: e.full_name ?? null, affiliation: e.affiliation ?? null,
      valid_until: e.valid_until || null, issued_by: user!.id,
    }, { onConflict: "organization_id,user_id" });
    if (error) return toast.error(error.message);
    toast.success("保存しました"); load();
  };

  const Card_ = (d: any) => (
    <Card className="p-5 max-w-sm space-y-3 bg-gradient-to-br from-primary/15 to-transparent">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><IdCard className="h-4 w-4" />{ctx.org?.name ?? "組織"} 電子証</div>
      <div className="text-lg font-bold">{d.full_name ?? nameOf(profiles[d.user_id], "メンバー")}</div>
      <div className="text-xs text-muted-foreground">{d.affiliation ?? "—"}　No. {d.id_number ?? "—"}</div>
      {d.barcode_value && (
        <div className="flex flex-col items-center gap-2 bg-white rounded p-2">
          <Barcode value={d.barcode_value} />
          <QR value={d.barcode_value} />
        </div>
      )}
      <div className="text-[11px] text-muted-foreground">有効期限: {d.valid_until ?? "—"}</div>
    </Card>
  );

  if (!ctx.isStaff) {
    return mine ? Card_(mine) : <Card className="p-6 text-sm text-muted-foreground">まだ発行されていません。教師以上の担当者が設定します。</Card>;
  }

  return (
    <Tabs defaultValue="mine">
      <TabsList>
        <TabsTrigger value="mine">自分の証</TabsTrigger>
        <TabsTrigger value="issue">発行・編集</TabsTrigger>
      </TabsList>
      <TabsContent value="mine">{mine ? Card_(mine) : <Card className="p-6 text-sm text-muted-foreground">自分の証はまだありません</Card>}</TabsContent>
      <TabsContent value="issue" className="space-y-2">
        {members.map((m) => {
          const d = all.find((x) => x.user_id === m.user_id) ?? {};
          const e = edit[m.user_id] ?? d;
          const set = (patch: any) => setEdit((s) => ({ ...s, [m.user_id]: { ...e, ...patch } }));
          return (
            <Card key={m.user_id} className="p-3 space-y-2">
              <div className="text-sm font-medium">{nameOf(profiles[m.user_id])}</div>
              <div className="flex flex-wrap gap-2">
                <Input className="w-40 h-8" placeholder="氏名" defaultValue={d.full_name ?? ""} onChange={(ev) => set({ full_name: ev.target.value })} />
                <Input className="w-36 h-8" placeholder="所属（例: 1年C組）" defaultValue={d.affiliation ?? ""} onChange={(ev) => set({ affiliation: ev.target.value })} />
                <Input className="w-32 h-8" placeholder="学籍番号" defaultValue={d.id_number ?? ""} onChange={(ev) => set({ id_number: ev.target.value })} />
                <Input className="w-40 h-8" placeholder="バーコード値" defaultValue={d.barcode_value ?? ""} onChange={(ev) => set({ barcode_value: ev.target.value })} />
                <Input type="date" className="w-40 h-8" defaultValue={d.valid_until ?? ""} onChange={(ev) => set({ valid_until: ev.target.value })} />
                <Button size="sm" onClick={() => save(m.user_id)}><Save className="h-3 w-3 mr-1" />保存</Button>
              </div>
            </Card>
          );
        })}
      </TabsContent>
    </Tabs>
  );
}
