import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";

// ========== Organizations admin ==========
export function OrgsAdminTab() {
  const [pending, setPending] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [openApp, setOpenApp] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const load = async () => {
    const { data: ap } = await (supabase as any)
      .from("organization_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = (ap ?? []) as any[];
    const ids = [...new Set(rows.map((r) => r.applicant_id))];
    let profByUser: Record<string, any> = {};
    if (ids.length > 0) {
      const { data: profs } = await (supabase as any)
        .from("profiles").select("id, username, display_name").in("id", ids);
      profByUser = Object.fromEntries(((profs ?? []) as any[]).map((p) => [p.id, p]));
    }
    setApps(rows.map((r) => ({ ...r, profile: profByUser[r.applicant_id] ?? null })));
    const { data: p } = await (supabase as any).from("organizations")
      .select("*, profile:profiles!organizations_created_by_fkey(username, display_name)")
      .eq("status", "pending").order("created_at", { ascending: false });
    setPending(p ?? []);
    const { data: a } = await (supabase as any).from("organizations").select("*").order("created_at", { ascending: false }).limit(50);
    setOrgs(a ?? []);
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!name.trim()) return;
    const { error } = await (supabase as any).from("organizations").insert({ name, description: desc || null, status: "approved" });
    if (error) return toast.error(error.message);
    setName(""); setDesc(""); toast.success("組織を作成しました"); load();
  };
  const review = async (id: string, approve: boolean) => {
    const { error } = await (supabase as any).rpc("admin_review_organization", { _org_id: id, _approve: approve });
    if (error) return toast.error(error.message);
    toast.success(approve ? "承認しました" : "却下しました"); load();
  };
  const reviewApp = async (id: string, approve: boolean) => {
    const { error } = await (supabase as any).rpc("admin_review_organization_application", {
      _application_id: id,
      _approve: approve,
      _note: notes[id]?.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success(approve ? "承認して組織を作成しました" : "却下しました");
    load();
  };
  return (
    <div className="space-y-4 mt-4">
      <Card className="p-3 space-y-3">
        <div className="font-bold flex items-center gap-1"><MessageSquare className="h-4 w-4" />導入申請 ({apps.length})</div>
        {apps.length === 0 && <div className="text-sm text-muted-foreground">申請はありません</div>}
        {apps.map((a: any) => (
          <div key={a.id} className="rounded-lg border p-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{a.org_name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted">{ORG_TYPE_LABEL[a.org_type] ?? a.org_type}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted">{APP_STATUS_LABEL[a.status] ?? a.status}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString("ja-JP")}</span>
            </div>
            <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <div>代表者: {a.rep_last_name} {a.rep_first_name}（{a.rep_last_kana} {a.rep_first_kana}）</div>
              <div>部署: {a.department || "—"}</div>
              <div>メール: {a.contact_email}</div>
              <div>電話: {a.contact_phone}</div>
              <div>所在: {a.country}{a.prefecture ? ` / ${a.prefecture}` : ""}</div>
              <div>住所: {a.address}</div>
              {a.org_type_other && <div>種別（その他）: {a.org_type_other}</div>}
              {a.note && <div className="sm:col-span-2">連絡事項: {a.note}</div>}
              <div>申請者: {a.profile?.display_name ?? a.profile?.username ?? "—"}</div>
            </div>
            {a.status === "pending" && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="max-w-xs"
                  placeholder="申請者へのメモ（任意）"
                  value={notes[a.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                />
                <Button size="sm" onClick={() => reviewApp(a.id, true)}><Check className="h-4 w-4 mr-1" />承認</Button>
                <Button size="sm" variant="outline" onClick={() => reviewApp(a.id, false)}><X className="h-4 w-4 mr-1" />却下</Button>
              </div>
            )}
            <Button size="sm" variant="ghost" onClick={() => setOpenApp(openApp === a.id ? null : a.id)}>
              <MessageSquare className="h-4 w-4 mr-1" />{openApp === a.id ? "問い合わせを閉じる" : "問い合わせを見る"}
            </Button>
            {openApp === a.id && <OrgApplicationThread applicationId={a.id} />}
          </div>
        ))}
      </Card>

      <Card className="p-4 space-y-2">
        <div className="font-bold flex items-center gap-1"><Plus className="h-4 w-4" />新規組織を作成（管理者のみ）</div>
        <Input placeholder="組織名" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea rows={2} placeholder="説明" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Button onClick={create}>作成</Button>
      </Card>
      {pending.length > 0 && (
        <Card className="p-3 space-y-2">
          <div className="font-bold">審査待ち ({pending.length})</div>
          {pending.map((o: any) => (
            <div key={o.id} className="flex items-center gap-2 border rounded p-2 text-sm">
              <div className="flex-1">
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-muted-foreground">{o.description} ・ 申請者 {o.profile?.display_name ?? o.profile?.username}</div>
              </div>
              <Button size="sm" onClick={() => review(o.id, true)}>承認</Button>
              <Button size="sm" variant="outline" onClick={() => review(o.id, false)}>却下</Button>
            </div>
          ))}
        </Card>
      )}
      <Card className="p-3 space-y-2">
        <div className="font-bold">既存組織</div>
        {orgs.map((o: any) => (
          <div key={o.id} className="flex items-center gap-2 border rounded p-2 text-sm">
            <div className="flex-1">
              <div className="font-medium">{o.name} <span className="text-[10px] px-1.5 rounded bg-muted ml-1">{o.status}</span></div>
              <div className="text-xs text-muted-foreground">{o.description}</div>
            </div>
            <a href={`/organizations/${o.id}`} className="text-sm underline">管理 →</a>
          </div>
        ))}
      </Card>
    </div>
  );
}

