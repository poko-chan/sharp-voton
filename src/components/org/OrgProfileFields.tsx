import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ListChecks, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { academicYear, loadOrgFields, yearOptions, type OrgField } from "@/lib/org-profile";

const TYPES = [
  { key: "text", label: "自由入力" },
  { key: "select", label: "選択式" },
  { key: "number", label: "数値" },
];

const slug = (label: string, i: number) =>
  (label.replace(/[^\w]/g, "").toLowerCase() || `field${i + 1}`) + "_" + Math.random().toString(36).slice(2, 6);

export function OrgProfileFields({ orgId }: { orgId: string }) {
  const [fields, setFields] = useState<OrgField[]>([]);
  const [year, setYear] = useState(academicYear());
  const [label, setLabel] = useState("");
  const [type, setType] = useState("select");

  const load = async () => {
    setFields(await loadOrgFields(orgId));
    const { data } = await (supabase as any).from("organizations").select("current_year").eq("id", orgId).maybeSingle();
    if (data?.current_year) setYear(data.current_year);
  };
  useEffect(() => { load(); }, [orgId]);

  const add = async () => {
    if (!label.trim()) return toast.error("項目名を入力してください");
    const { error } = await (supabase as any).from("org_profile_fields").insert({
      organization_id: orgId, key: slug(label, fields.length), label: label.trim(), type,
      options: type === "select" ? ["選択肢1"] : [], required: false, staff_only: true,
      yearly: true, sort_order: fields.length,
    });
    if (error) return toast.error(error.message);
    setLabel(""); load();
  };

  const patch = async (f: OrgField, p: Partial<OrgField>) => {
    setFields((arr) => arr.map((x) => x.id === f.id ? { ...x, ...p } as OrgField : x));
    const { error } = await (supabase as any).from("org_profile_fields").update(p).eq("id", f.id);
    if (error) toast.error(error.message);
  };

  const remove = async (f: OrgField) => {
    const { error } = await (supabase as any).from("org_profile_fields").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    load();
  };

  const saveYear = async (y: string) => {
    setYear(y);
    const { error } = await (supabase as any).from("organizations").update({ current_year: y }).eq("id", orgId);
    if (error) return toast.error(error.message);
    toast.success(`${y}年度に設定しました`);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <Link to="/organizations/$orgId" params={{ orgId }} className="text-sm underline text-muted-foreground">← 組織ホームへ</Link>
      <h1 className="text-xl font-bold flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" />プロフィール項目</h1>
      <p className="text-xs text-muted-foreground">
        表示名以外の項目は組織が自由に決められます（例: 塾なら「教室番号」、学校なら「学年」「クラス」）。
        「教師以上のみ編集」にすると本人は変更できません。
      </p>

      <Card className="p-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">現在の年度</span>
        <Select value={year} onValueChange={saveYear}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{yearOptions().map((y) => <SelectItem key={y} value={y}>{y}年度</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground">年度ごとに学年・クラスを持てます（進級しても過去の記録が残ります）。</span>
      </Card>

      <Card className="p-4 flex flex-wrap gap-2 items-center">
        <Input className="w-48" placeholder="項目名（例: 学年）" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={add}><Plus className="h-4 w-4 mr-1" />項目を追加</Button>
      </Card>

      {fields.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">項目はまだありません</Card>}

      {fields.map((f) => (
        <Card key={f.id} className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <Input className="w-44 h-8" value={f.label} onChange={(e) => patch(f, { label: e.target.value })} />
            <Select value={f.type} onValueChange={(v) => patch(f, { type: v as any })}>
              <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <label className="flex items-center gap-1 text-xs">必須<Switch checked={f.required} onCheckedChange={(v) => patch(f, { required: v })} /></label>
            <label className="flex items-center gap-1 text-xs">教師以上のみ編集<Switch checked={f.staff_only} onCheckedChange={(v) => patch(f, { staff_only: v })} /></label>
            <label className="flex items-center gap-1 text-xs">年度ごと<Switch checked={f.yearly} onCheckedChange={(v) => patch(f, { yearly: v })} /></label>
            <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => remove(f)}><Trash2 className="h-4 w-4" /></Button>
          </div>
          {f.type === "select" && (
            <div className="space-y-1 pl-6">
              {f.options.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="h-8 w-56" value={o}
                    onChange={(e) => patch(f, { options: f.options.map((x, j) => j === i ? e.target.value : x) })} />
                  <Button size="sm" variant="ghost" onClick={() => patch(f, { options: f.options.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => patch(f, { options: [...f.options, `選択肢${f.options.length + 1}`] })}>
                <Plus className="h-3 w-3 mr-1" />選択肢を追加
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
