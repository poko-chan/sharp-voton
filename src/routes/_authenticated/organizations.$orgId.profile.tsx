import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-apps";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserCircle, Lock } from "lucide-react";
import { academicYear, loadOrgFields, loadOrgYearValues, saveOrgYearValues, yearOptions, type OrgField } from "@/lib/org-profile";

export const Route = createFileRoute("/_authenticated/organizations/$orgId/profile")({ component: OrgProfilePage });

function OrgProfilePage() {
  const { orgId } = Route.useParams();
  const { user } = useAuth();
  const { isStaff, org } = useOrg(orgId);
  const [p, setP] = useState<any>({});
  const [fields, setFields] = useState<OrgField[]>([]);
  const [year, setYear] = useState(academicYear());
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    (supabase as any).from("org_profiles").select("*").eq("organization_id", orgId).eq("user_id", user.id).maybeSingle()
      .then(({ data }: any) => setP(data ?? {}));
    loadOrgFields(orgId).then(setFields);
  }, [orgId, user?.id]);

  useEffect(() => { if (org?.current_year) setYear(org.current_year); }, [org?.current_year]);

  useEffect(() => {
    if (!user) return;
    loadOrgYearValues(orgId, year, [user.id]).then((m) => setValues(m[user.id] ?? {}));
  }, [orgId, year, user?.id]);

  const save = async () => {
    const { error } = await (supabase as any).from("org_profiles").upsert({
      organization_id: orgId, user_id: user!.id,
      display_name: p.display_name || null, bio: p.bio || null, avatar_url: p.avatar_url || null,
    }, { onConflict: "organization_id,user_id" });
    if (error) return toast.error(error.message);

    const editable = fields.filter((f) => !f.staff_only || isStaff);
    if (editable.length) {
      const merged = { ...(await loadOrgYearValues(orgId, year, [user!.id]))[user!.id], ...Object.fromEntries(editable.map((f) => [f.key, values[f.key] ?? ""])) };
      const miss = fields.find((f) => f.required && !f.staff_only && !merged[f.key]);
      if (miss) return toast.error(`${miss.label} は必須です`);
      const { error: e2 } = await saveOrgYearValues(orgId, user!.id, year, merged);
      if (e2) return toast.error(e2.message);
    }
    toast.success("保存しました");
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-3">
      <Link to="/organizations/$orgId" params={{ orgId }} className="text-sm underline text-muted-foreground">← 組織ホームへ</Link>
      <h1 className="text-xl font-bold flex items-center gap-2"><UserCircle className="h-5 w-5 text-primary" />組織内プロフィール</h1>
      <p className="text-xs text-muted-foreground">この情報は組織の中でのみ表示されます（通常のStudy#プロフィールとは別です）。</p>
      <Card className="p-4 space-y-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">組織内での表示名</div>
          <Input placeholder="表示名" value={p.display_name ?? ""} onChange={(e) => setP((s: any) => ({ ...s, display_name: e.target.value }))} />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">年度</span>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{yearOptions().map((y) => <SelectItem key={y} value={y}>{y}年度</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {fields.map((f) => {
          const locked = f.staff_only && !isStaff;
          return (
            <div key={f.id}>
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                {f.label}{f.required && <span className="text-destructive">*</span>}
                {locked && <span className="inline-flex items-center gap-0.5 text-[10px]"><Lock className="h-3 w-3" />教師以上のみ編集</span>}
              </div>
              {f.type === "select" ? (
                <Select value={values[f.key] ?? ""} onValueChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} disabled={locked}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="未設定" /></SelectTrigger>
                  <SelectContent>{f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input disabled={locked} type={f.type === "number" ? "number" : "text"}
                  value={values[f.key] ?? ""} onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))} />
              )}
            </div>
          );
        })}

        <Textarea rows={3} placeholder="自己紹介（任意）" value={p.bio ?? ""} onChange={(e) => setP((s: any) => ({ ...s, bio: e.target.value }))} />
        <Button onClick={save}>保存</Button>
      </Card>
    </div>
  );
}
