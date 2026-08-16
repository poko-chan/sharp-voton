import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Save, Search, Copy } from "lucide-react";
import { toast } from "sonner";
import { loadOrgProfiles, nameOf } from "@/lib/org-apps";
import { academicYear, loadOrgFields, loadOrgYearValues, saveOrgYearValues, yearOptions, type OrgField } from "@/lib/org-profile";

export function OrgRoster({ orgId }: { orgId: string }) {
  const [fields, setFields] = useState<OrgField[]>([]);
  const [year, setYear] = useState(academicYear());
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [f, { data: o }, { data: m }] = await Promise.all([
        loadOrgFields(orgId),
        (supabase as any).from("organizations").select("current_year").eq("id", orgId).maybeSingle(),
        (supabase as any).from("organization_members").select("user_id, role").eq("organization_id", orgId),
      ]);
      setFields(f);
      if (o?.current_year) setYear(o.current_year);
      setMembers(m ?? []);
      setProfiles(await loadOrgProfiles(orgId, (m ?? []).map((x: any) => x.user_id)));
    })();
  }, [orgId]);

  useEffect(() => {
    if (!members.length) return;
    loadOrgYearValues(orgId, year, members.map((m) => m.user_id)).then(setValues);
  }, [orgId, year, members.length]);

  const set = (uid: string, key: string, v: string) =>
    setValues((s) => ({ ...s, [uid]: { ...(s[uid] ?? {}), [key]: v } }));

  const saveOne = async (uid: string) => {
    setBusy(true);
    const { error } = await saveOrgYearValues(orgId, uid, year, values[uid] ?? {});
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("保存しました");
  };

  const copyPrev = async () => {
    const prev = String(Number(year) - 1);
    const old = await loadOrgYearValues(orgId, prev, members.map((m) => m.user_id));
    if (!Object.keys(old).length) return toast.error(`${prev}年度のデータがありません`);
    setValues((s) => ({ ...old, ...s }));
    toast.success(`${prev}年度の内容を読み込みました（保存してください）`);
  };

  const list = useMemo(() => members.filter((m) =>
    !q.trim() || nameOf(profiles[m.user_id]).includes(q.trim())), [members, profiles, q]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <Link to="/organizations/$orgId" params={{ orgId }} className="text-sm underline text-muted-foreground">← 組織ホームへ</Link>
      <h1 className="text-xl font-bold flex items-center gap-2"><Users className="h-5 w-5 text-primary" />名簿（学年・クラス設定）</h1>
      <p className="text-xs text-muted-foreground">教師以上のみが編集できます。年度を切り替えると、その年度の内容を編集できます。</p>

      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{yearOptions().map((y) => <SelectItem key={y} value={y}>{y}年度</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={copyPrev}><Copy className="h-3.5 w-3.5 mr-1" />前年度から複製</Button>
        <div className="relative ml-auto">
          <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
          <Input className="h-9 w-48 pl-7" placeholder="名前で検索" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>

      {fields.length === 0 && <Card className="p-6 text-sm text-muted-foreground">先に「プロフィール項目」で学年・クラスなどの項目を作成してください。</Card>}

      {list.map((m) => (
        <Card key={m.user_id} className="p-3 flex flex-wrap items-center gap-2">
          <div className="w-40 truncate text-sm font-medium">{nameOf(profiles[m.user_id])}</div>
          {fields.map((f) => (
            <div key={f.id} className="flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground">{f.label}</span>
              {f.type === "select" ? (
                <Select value={values[m.user_id]?.[f.key] ?? ""} onValueChange={(v) => set(m.user_id, f.key, v)}>
                  <SelectTrigger className="h-8 w-32"><SelectValue placeholder="未設定" /></SelectTrigger>
                  <SelectContent>{f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input className="h-8 w-28" type={f.type === "number" ? "number" : "text"}
                  value={values[m.user_id]?.[f.key] ?? ""} onChange={(e) => set(m.user_id, f.key, e.target.value)} />
              )}
            </div>
          ))}
          <Button size="sm" variant="outline" className="ml-auto" disabled={busy} onClick={() => saveOne(m.user_id)}>
            <Save className="h-3.5 w-3.5 mr-1" />保存
          </Button>
        </Card>
      ))}
    </div>
  );
}
