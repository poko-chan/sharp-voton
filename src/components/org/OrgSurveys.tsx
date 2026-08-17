import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, BarChart3, ClipboardList, CheckCircle2, GripVertical, Copy, ArrowLeft, Star } from "lucide-react";
import { toast } from "sonner";
import { OrgScopePicker } from "./OrgScopePicker";
import { loadOrgProfiles, nameOf } from "@/lib/org-apps";

export const Q_TYPES: { key: string; label: string }[] = [
  { key: "single", label: "ラジオボタン" },
  { key: "multi", label: "チェックボックス" },
  { key: "dropdown", label: "プルダウン" },
  { key: "text", label: "記述式（短文）" },
  { key: "longtext", label: "段落" },
  { key: "number", label: "数値" },
  { key: "scale", label: "均等目盛（1〜5）" },
  { key: "rating", label: "星評価（1〜5）" },
  { key: "yesno", label: "はい / いいえ" },
  { key: "date", label: "日付" },
  { key: "time", label: "時刻" },
];

const CHOICE = ["single", "multi", "dropdown", "yesno"];
const newQ = () => ({ id: crypto.randomUUID(), type: "single", label: "", options: ["選択肢 1"], required: true });
const newSection = () => ({ id: crypto.randomUUID(), type: "section", label: "", desc: "" });

/** 質問配列をセクション単位に分割する（先頭にセクション見出しが無ければ既定の1つ目） */
export function splitSections(qs: any[]) {
  const secs: { title: string; desc?: string; items: any[] }[] = [{ title: "", desc: "", items: [] }];
  for (const q of qs ?? []) {
    if (q.type === "section") secs.push({ title: q.label, desc: q.desc, items: [] });
    else secs[secs.length - 1].items.push(q);
  }
  return secs.filter((s, i) => i === 0 ? s.items.length > 0 : true);
}

export function OrgSurveys({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [view, setView] = useState<"list" | "build" | "answer" | "results">("list");
  const [current, setCurrent] = useState<any>(null);
  const [scope, setScope] = useState("org");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [qs, setQs] = useState<any[]>([newQ()]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [myResponses, setMyResponses] = useState<Record<string, any>>({});
  const [results, setResults] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [tab, setTab] = useState<"summary" | "individual">("summary");

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
    if (qs.some((q) => !q.label.trim())) return toast.error("質問文が空のものがあります");
    const { error } = await (supabase as any).from("org_surveys").insert({
      organization_id: orgId, group_id: scope === "org" ? null : scope,
      title: title.trim(), description: desc || null, questions: qs, anonymous, created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    await (supabase as any).rpc("org_notify_members", {
      _org: orgId, _group: scope === "org" ? null : scope, _app: "surveys", _title: `アンケート: ${title.trim()}`, _body: desc || null,
    });
    toast.success("アンケートを配信しました");
    setView("list"); setTitle(""); setDesc(""); setQs([newQ()]);
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
    setView("list"); setAnswers({}); load();
  };

  const showResults = async (s: any) => {
    const { data, error } = await (supabase as any).from("org_survey_responses").select("*").eq("survey_id", s.id);
    if (error) return toast.error(error.message);
    setResults(data ?? []); setCurrent(s); setView("results"); setTab("summary");
    if (!s.anonymous) setProfiles(await loadOrgProfiles(orgId, (data ?? []).map((r: any) => r.user_id)));
  };

  const setQ = (i: number, patch: any) => setQs((arr) => arr.map((q, idx) => idx === i ? { ...q, ...patch } : q));

  const renderInput = (q: any) => {
    const v = answers[q.id];
    const set = (val: any) => setAnswers((a) => ({ ...a, [q.id]: val }));
    const opts: string[] = q.type === "yesno" ? ["はい", "いいえ"] : (q.options ?? []);
    switch (q.type) {
      case "single":
      case "yesno":
        return (
          <RadioGroup value={v ?? ""} onValueChange={set} className="space-y-2">
            {opts.map((o) => (
              <label key={o} className="flex items-center gap-3 text-sm cursor-pointer">
                <RadioGroupItem value={o} id={`${q.id}-${o}`} />{o}
              </label>
            ))}
          </RadioGroup>
        );
      case "multi":
        return (
          <div className="space-y-2">
            {opts.map((o) => {
              const arr: string[] = v ?? [];
              return (
                <label key={o} className="flex items-center gap-3 text-sm cursor-pointer">
                  <Checkbox checked={arr.includes(o)} onCheckedChange={(c) => set(c ? [...arr, o] : arr.filter((x) => x !== o))} />{o}
                </label>
              );
            })}
          </div>
        );
      case "dropdown":
        return (
          <Select value={v ?? ""} onValueChange={set}>
            <SelectTrigger className="h-9 max-w-xs"><SelectValue placeholder="選択してください" /></SelectTrigger>
            <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        );
      case "longtext": return <Textarea rows={4} placeholder="回答を入力" value={v ?? ""} onChange={(e) => set(e.target.value)} />;
      case "number": return <Input type="number" className="max-w-[200px]" value={v ?? ""} onChange={(e) => set(e.target.value)} />;
      case "date": return <Input type="date" className="max-w-[200px]" value={v ?? ""} onChange={(e) => set(e.target.value)} />;
      case "time": return <Input type="time" className="max-w-[160px]" value={v ?? ""} onChange={(e) => set(e.target.value)} />;
      case "scale":
        return (
          <div className="flex items-center gap-4 pt-1">
            <span className="text-xs text-muted-foreground">そう思わない</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => set(n)} className="flex flex-col items-center gap-1 text-xs">
                <span>{n}</span>
                <span className={`h-4 w-4 rounded-full border-2 ${v === n ? "bg-primary border-primary" : "border-muted-foreground/40"}`} />
              </button>
            ))}
            <span className="text-xs text-muted-foreground">そう思う</span>
          </div>
        );
      case "rating":
        return (
          <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => set(n)}>
              <Star className={`h-6 w-6 ${((v ?? 0) >= n) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
            </button>))}</div>
        );
      default: return <Input placeholder="回答を入力" value={v ?? ""} onChange={(e) => set(e.target.value)} />;
    }
  };

  const canCreate = ctx.isStaff || ctx.groups.length > 0;
  const FormHeader = ({ t, d }: { t: string; d?: string }) => (
    <Card className="overflow-hidden border-t-[6px] border-t-primary">
      <div className="p-6 space-y-1">
        <div className="text-2xl font-bold">{t || "無題のアンケート"}</div>
        {d && <div className="text-sm text-muted-foreground whitespace-pre-wrap">{d}</div>}
      </div>
    </Card>
  );

  /* ---------- 作成画面 ---------- */
  if (view === "build") return (
    <div className="max-w-2xl mx-auto space-y-3">
      <Button variant="ghost" size="sm" onClick={() => setView("list")}><ArrowLeft className="h-4 w-4 mr-1" />一覧へ</Button>
      <Card className="overflow-hidden border-t-[6px] border-t-primary p-6 space-y-3">
        <Input className="!text-2xl font-bold h-12 border-0 border-b rounded-none px-0 focus-visible:ring-0"
          placeholder="無題のアンケート" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea rows={2} className="border-0 border-b rounded-none px-0 focus-visible:ring-0 resize-none"
          placeholder="アンケートの説明" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div className="flex flex-wrap gap-3 items-center pt-2">
          <OrgScopePicker groups={ctx.groups} value={scope} onChange={setScope} orgLabel="組織全体（教師以上）" />
          <label className="text-xs flex items-center gap-2">匿名で回答を集める<Switch checked={anonymous} onCheckedChange={setAnonymous} /></label>
        </div>
      </Card>

      {qs.map((q, i) => (
        <Card key={q.id} className="p-5 space-y-3 hover:border-primary/50 transition">
          <div className="flex justify-center -mt-2 text-muted-foreground/40"><GripVertical className="h-4 w-4 rotate-90" /></div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input className="flex-1 border-0 border-b rounded-none px-0 focus-visible:ring-0 bg-muted/30"
              placeholder={`質問 ${i + 1}`} value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} />
            <Select value={q.type} onValueChange={(t) => setQ(i, { type: t, options: CHOICE.includes(t) && !(q.options ?? []).length ? ["選択肢 1"] : q.options })}>
              <SelectTrigger className="w-full sm:w-52 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>{Q_TYPES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {["single", "multi", "dropdown"].includes(q.type) && (
            <div className="space-y-2">
              {(q.options ?? []).map((o: string, oi: number) => (
                <div key={oi} className="flex items-center gap-2">
                  <span className={`h-4 w-4 border-2 border-muted-foreground/40 ${q.type === "multi" ? "rounded-[3px]" : "rounded-full"}`} />
                  <Input className="flex-1 border-0 border-b rounded-none px-0 h-8 focus-visible:ring-0" value={o}
                    onChange={(e) => setQ(i, { options: q.options.map((x: string, xi: number) => xi === oi ? e.target.value : x) })} />
                  <button className="text-muted-foreground hover:text-destructive"
                    onClick={() => setQ(i, { options: q.options.filter((_: string, xi: number) => xi !== oi) })}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setQ(i, { options: [...(q.options ?? []), `選択肢 ${(q.options?.length ?? 0) + 1}`] })}>
                <Plus className="h-3 w-3 mr-1" />選択肢を追加
              </Button>
            </div>
          )}
          {q.type === "yesno" && <div className="text-xs text-muted-foreground">選択肢：はい / いいえ</div>}

          <div className="flex items-center justify-end gap-3 border-t pt-3">
            <button className="text-muted-foreground hover:text-foreground" title="複製"
              onClick={() => setQs((a) => [...a.slice(0, i + 1), { ...q, id: crypto.randomUUID() }, ...a.slice(i + 1)])}><Copy className="h-4 w-4" /></button>
            <button className="text-muted-foreground hover:text-destructive" title="削除"
              onClick={() => setQs((a) => a.length > 1 ? a.filter((_, idx) => idx !== i) : a)}><Trash2 className="h-4 w-4" /></button>
            <label className="text-xs flex items-center gap-2 border-l pl-3">必須<Switch checked={q.required} onCheckedChange={(v) => setQ(i, { required: v })} /></label>
          </div>
        </Card>
      ))}

      <div className="flex gap-2 sticky bottom-4">
        <Button variant="outline" onClick={() => setQs((a) => [...a, { ...newQ(), type: "text", options: [] }])}><Plus className="h-4 w-4 mr-1" />質問を追加</Button>
        <Button onClick={create}>配信する</Button>
      </div>
    </div>
  );

  /* ---------- 回答画面 ---------- */
  if (view === "answer" && current) return (
    <div className="max-w-2xl mx-auto space-y-3">
      <Button variant="ghost" size="sm" onClick={() => setView("list")}><ArrowLeft className="h-4 w-4 mr-1" />一覧へ</Button>
      <FormHeader t={current.title} d={current.description} />
      {current.anonymous && <div className="text-xs text-muted-foreground px-1">この回答は匿名で集計されます。</div>}
      {(current.questions ?? []).map((q: any) => (
        <Card key={q.id} className="p-5 space-y-3">
          <div className="text-sm font-medium">{q.label}{q.required && <span className="text-destructive"> *</span>}</div>
          {renderInput(q)}
        </Card>
      ))}
      <div className="flex gap-2">
        <Button onClick={() => submit(current)}>送信</Button>
        <Button variant="ghost" onClick={() => setView("list")}>キャンセル</Button>
      </div>
    </div>
  );

  /* ---------- 結果画面 ---------- */
  if (view === "results" && current) {
    const total = results.length;
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setView("list")}><ArrowLeft className="h-4 w-4 mr-1" />一覧へ</Button>
        <FormHeader t={current.title} d={`回答 ${total} 件`} />
        <div className="flex gap-2">
          <Button size="sm" variant={tab === "summary" ? "default" : "outline"} onClick={() => setTab("summary")}>概要</Button>
          <Button size="sm" variant={tab === "individual" ? "default" : "outline"} onClick={() => setTab("individual")}>個別</Button>
        </div>
        {tab === "summary" && (current.questions ?? []).map((q: any) => {
          const vals = results.map((r) => r.answers?.[q.id]).filter((v) => v !== undefined && v !== "");
          const opts: string[] = q.type === "yesno" ? ["はい", "いいえ"] : (q.options ?? []);
          const isChoice = CHOICE.includes(q.type);
          return (
            <Card key={q.id} className="p-5 space-y-3">
              <div className="font-medium text-sm">{q.label}</div>
              {isChoice ? opts.map((o) => {
                const n = vals.filter((v) => Array.isArray(v) ? v.includes(o) : v === o).length;
                const pct = total ? Math.round((n / total) * 100) : 0;
                return (
                  <div key={o} className="space-y-1">
                    <div className="flex justify-between text-xs"><span>{o}</span><span className="text-muted-foreground">{n}件 ({pct}%)</span></div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              }) : ["scale", "rating", "number"].includes(q.type) ? (
                <div className="text-sm">平均 <span className="font-bold text-lg">{vals.length ? (vals.reduce((a: number, b: any) => a + Number(b), 0) / vals.length).toFixed(2) : "—"}</span>（{vals.length}件）</div>
              ) : (
                <div className="space-y-1">{vals.length === 0 && <div className="text-xs text-muted-foreground">回答なし</div>}
                  {vals.map((v: any, i: number) => <div key={i} className="text-sm rounded bg-muted/50 px-3 py-1.5">{String(v)}</div>)}</div>
              )}
            </Card>
          );
        })}
        {tab === "individual" && results.map((r: any) => (
          <Card key={r.id} className="p-4 space-y-1 text-sm">
            <div className="text-[11px] text-muted-foreground">{current.anonymous ? "匿名" : nameOf(profiles[r.user_id])}</div>
            {(current.questions ?? []).map((q: any) => (
              <div key={q.id}><span className="text-muted-foreground">{q.label}: </span>{Array.isArray(r.answers?.[q.id]) ? r.answers[q.id].join("、") : String(r.answers?.[q.id] ?? "—")}</div>
            ))}
          </Card>
        ))}
        {results.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">まだ回答はありません</Card>}
      </div>
    );
  }

  /* ---------- 一覧 ---------- */
  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {canCreate && (
        <button onClick={() => setView("build")}
          className="w-full rounded-xl border-2 border-dashed p-6 text-sm flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition">
          <Plus className="h-5 w-5" />新しいアンケートを作成
        </button>
      )}
      {rows.length === 0 && <Card className="p-10 text-center text-sm text-muted-foreground">アンケートはありません</Card>}
      <div className="grid sm:grid-cols-2 gap-3">
        {rows.map((s) => (
          <Card key={s.id} className="p-0 overflow-hidden flex flex-col">
            <div className="h-16 bg-gradient-to-r from-primary/25 to-primary/5 flex items-center px-4">
              <ClipboardList className="h-7 w-7 text-primary" />
            </div>
            <div className="p-4 space-y-2 flex-1 flex flex-col">
              <div className="font-bold leading-tight">{s.title}</div>
              <div className="text-[11px] text-muted-foreground">
                {s.group_id ? (ctx.groups.find((g: any) => g.id === s.group_id)?.name ?? "グループ") : "組織全体"}
                {s.anonymous && " ・匿名"} ・ 質問{(s.questions ?? []).length}問
              </div>
              {myResponses[s.id] && <div className="text-[11px] text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />回答済み</div>}
              <div className="flex gap-2 pt-2 mt-auto">
                <Button size="sm" className="flex-1" onClick={() => { setCurrent(s); setAnswers(myResponses[s.id]?.answers ?? {}); setView("answer"); }}>
                  {myResponses[s.id] ? "回答を修正" : "回答する"}
                </Button>
                {(s.created_by === user?.id || ctx.canAdmin) && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => showResults(s)}><BarChart3 className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                      await (supabase as any).from("org_surveys").delete().eq("id", s.id); load();
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
