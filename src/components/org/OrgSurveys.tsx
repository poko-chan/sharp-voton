import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { OrgScopePicker } from "./OrgScopePicker";
import { loadOrgProfiles, nameOf } from "@/lib/org-apps";

export const Q_TYPES: { key: string; label: string }[] = [
  { key: "single", label: "単一選択（ラジオ）" },
  { key: "multi", label: "複数選択（チェック）" },
  { key: "dropdown", label: "プルダウン" },
  { key: "text", label: "短文記述" },
  { key: "longtext", label: "長文記述" },
  { key: "number", label: "数値" },
  { key: "scale", label: "5段階評価" },
  { key: "rating", label: "星評価（1〜5）" },
  { key: "yesno", label: "はい / いいえ" },
  { key: "date", label: "日付" },
  { key: "time", label: "時刻" },
];

export function OrgSurveys({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [scope, setScope] = useState("org");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [qs, setQs] = useState<any[]>([{ id: crypto.randomUUID(), type: "single", label: "", options: ["選択肢1", "選択肢2"], required: true }]);
  const [answering, setAnswering] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [myResponses, setMyResponses] = useState<Record<string, any>>({});
  const [results, setResults] = useState<any[] | null>(null);
  const [resultsFor, setResultsFor] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, any>>({});

  const load = async () => {
    const { data, error } = await (supabase as any).from("org_surveys").select("*")
      .eq("organization_id", orgId).order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRows(data ?? []);
    const { data: mine } = await (supabase as any).from("org_survey_responses").select("*").eq("user_id", user!.id);
    const m: Record<string, any> = {};
    for (const r of mine ?? []) m[r.survey_id] = r;
    setMyResponses(m);
  };
  useEffect(() => { load(); }, [orgId]);

  const create = async () => {
    if (!title.trim()) return toast.error("タイトルを入力してください");
    const { error } = await (supabase as any).from("org_surveys").insert({
      organization_id: orgId, group_id: scope === "org" ? null : scope,
      title: title.trim(), description: desc || null, questions: qs, anonymous, created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    await (supabase as any).rpc("org_notify_members", {
      _org: orgId, _group: scope === "org" ? null : scope, _app: "surveys", _title: `アンケート: ${title.trim()}`, _body: desc || null,
    });
    toast.success("アンケートを配信しました");
    setCreating(false); setTitle(""); setDesc(""); setQs([{ id: crypto.randomUUID(), type: "single", label: "", options: ["選択肢1", "選択肢2"], required: true }]);
    load();
  };

  const submit = async (s: any) => {
    for (const q of s.questions ?? []) {
      if (q.required && (answers[q.id] === undefined || answers[q.id] === "" || (Array.isArray(answers[q.id]) && !answers[q.id].length)))
        return toast.error("必須の質問に回答してください");
    }
    const { error } = await (supabase as any).from("org_survey_responses")
      .upsert({ survey_id: s.id, user_id: user!.id, answers }, { onConflict: "survey_id,user_id" });
    if (error) return toast.error(error.message);
    toast.success("回答を送信しました");
    setAnswering(null); setAnswers({}); load();
  };

  const showResults = async (s: any) => {
    const { data, error } = await (supabase as any).from("org_survey_responses").select("*").eq("survey_id", s.id);
    if (error) return toast.error(error.message);
    setResults(data ?? []); setResultsFor(s.id);
    if (!s.anonymous) setProfiles(await loadOrgProfiles(orgId, (data ?? []).map((r: any) => r.user_id)));
  };

  const setQ = (i: number, patch: any) => setQs((arr) => arr.map((q, idx) => idx === i ? { ...q, ...patch } : q));

  const renderInput = (q: any) => {
    const v = answers[q.id];
    const set = (val: any) => setAnswers((a) => ({ ...a, [q.id]: val }));
    switch (q.type) {
      case "single":
      case "dropdown":
        return (
          <Select value={v ?? ""} onValueChange={set}>
            <SelectTrigger className="h-9"><SelectValue placeholder="選択してください" /></SelectTrigger>
            <SelectContent>{(q.options ?? []).map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        );
      case "multi":
        return (
          <div className="flex flex-wrap gap-2">
            {(q.options ?? []).map((o: string) => {
              const arr: string[] = v ?? [];
              const on = arr.includes(o);
              return <Button key={o} type="button" size="sm" variant={on ? "default" : "outline"}
                onClick={() => set(on ? arr.filter((x) => x !== o) : [...arr, o])}>{o}</Button>;
            })}
          </div>
        );
      case "longtext": return <Textarea rows={4} value={v ?? ""} onChange={(e) => set(e.target.value)} />;
      case "number": return <Input type="number" value={v ?? ""} onChange={(e) => set(e.target.value)} />;
      case "date": return <Input type="date" value={v ?? ""} onChange={(e) => set(e.target.value)} />;
      case "time": return <Input type="time" value={v ?? ""} onChange={(e) => set(e.target.value)} />;
      case "yesno":
        return <div className="flex gap-2">{["はい", "いいえ"].map((o) => (
          <Button key={o} type="button" size="sm" variant={v === o ? "default" : "outline"} onClick={() => set(o)}>{o}</Button>))}</div>;
      case "scale":
      case "rating":
        return <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => (
          <Button key={n} type="button" size="sm" variant={v === n ? "default" : "outline"} onClick={() => set(n)}>
            {q.type === "rating" ? "★" : ""}{n}</Button>))}</div>;
      default: return <Input value={v ?? ""} onChange={(e) => set(e.target.value)} />;
    }
  };

  const canCreate = ctx.isStaff || ctx.groups.length > 0;

  return (
    <div className="space-y-3">
      {canCreate && (!creating ? <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />アンケートを作成</Button> : (
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <OrgScopePicker groups={ctx.groups} value={scope} onChange={setScope} orgLabel="組織全体（教師以上）" />
            <label className="text-xs flex items-center gap-2 ml-auto">匿名回答<Switch checked={anonymous} onCheckedChange={setAnonymous} /></label>
          </div>
          <Input placeholder="アンケート名" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={2} placeholder="説明（任意）" value={desc} onChange={(e) => setDesc(e.target.value)} />
          {qs.map((q, i) => (
            <Card key={q.id} className="p-3 space-y-2">
              <div className="flex gap-2">
                <Input className="flex-1" placeholder={`質問${i + 1}`} value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} />
                <Select value={q.type} onValueChange={(v) => setQ(i, { type: v })}>
                  <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{Q_TYPES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setQs((a) => a.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {["single", "multi", "dropdown"].includes(q.type) && (
                <Textarea rows={2} placeholder="選択肢（改行区切り）" value={(q.options ?? []).join("\n")}
                  onChange={(e) => setQ(i, { options: e.target.value.split("\n").filter(Boolean) })} />
              )}
              <label className="text-xs flex items-center gap-2">必須<Switch checked={q.required} onCheckedChange={(v) => setQ(i, { required: v })} /></label>
            </Card>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setQs((a) => [...a, { id: crypto.randomUUID(), type: "text", label: "", options: [], required: false }])}>
              <Plus className="h-3 w-3 mr-1" />質問を追加
            </Button>
            <Button onClick={create}>配信する</Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>やめる</Button>
          </div>
        </Card>
      ))}

      {rows.length === 0 && <Card className="p-6 text-sm text-muted-foreground">アンケートはありません</Card>}
      {rows.map((s) => (
        <Card key={s.id} className="p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[160px]">
              <div className="font-bold">{s.title}</div>
              <div className="text-[11px] text-muted-foreground">
                {s.group_id ? (ctx.groups.find((g: any) => g.id === s.group_id)?.name ?? "グループ") : "組織全体"}
                {s.anonymous && " ・匿名"}{myResponses[s.id] && " ・回答済み"}
              </div>
            </div>
            {(s.created_by === user?.id || ctx.canAdmin) && (
              <>
                <Button size="sm" variant="outline" onClick={() => showResults(s)}><BarChart3 className="h-3 w-3 mr-1" />結果</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                  await (supabase as any).from("org_surveys").delete().eq("id", s.id); load();
                }}><Trash2 className="h-4 w-4" /></Button>
              </>
            )}
            <Button size="sm" onClick={() => { setAnswering(answering === s.id ? null : s.id); setAnswers(myResponses[s.id]?.answers ?? {}); }}>
              {myResponses[s.id] ? "回答を修正" : "回答する"}
            </Button>
          </div>
          {s.description && <div className="text-sm text-muted-foreground">{s.description}</div>}

          {answering === s.id && (
            <div className="space-y-3 pt-2 border-t">
              {(s.questions ?? []).map((q: any) => (
                <div key={q.id} className="space-y-1">
                  <div className="text-sm font-medium">{q.label}{q.required && <span className="text-destructive"> *</span>}</div>
                  {renderInput(q)}
                </div>
              ))}
              <Button onClick={() => submit(s)}>送信</Button>
            </div>
          )}

          {resultsFor === s.id && results && (
            <div className="pt-2 border-t space-y-2 text-sm">
              <div className="font-medium">回答 {results.length}件</div>
              {results.map((r: any) => (
                <div key={r.id} className="border rounded p-2">
                  <div className="text-[11px] text-muted-foreground">{s.anonymous ? "匿名" : nameOf(profiles[r.user_id])}</div>
                  {(s.questions ?? []).map((q: any) => (
                    <div key={q.id}><span className="text-muted-foreground">{q.label}: </span>{Array.isArray(r.answers?.[q.id]) ? r.answers[q.id].join("、") : String(r.answers?.[q.id] ?? "—")}</div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
