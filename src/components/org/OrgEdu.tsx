import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, Flame, Trophy, Star, Lock, CheckCircle2, Plus, Trash2, Settings2, ArrowLeft, Target, Sparkles, Brain, Map } from "lucide-react";
import { toast } from "sonner";
import { academicYear, audienceLabel, loadOrgFields, loadOrgYearValues, matchAudience, type OrgField } from "@/lib/org-profile";
import { OrgEduReview } from "./OrgEduReview";

const HUES = ["#7B6CFF", "#34D7B5", "#38bdf8", "#fb923c", "#f472b6"];
const levelOf = (xp: number) => Math.floor(Math.sqrt(xp / 40)) + 1;
const nextLevelXp = (lv: number) => Math.pow(lv, 2) * 40;

export function OrgEdu({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const [fields, setFields] = useState<OrgField[]>([]);
  const [myValues, setMyValues] = useState<Record<string, string>>({});
  const [subjects, setSubjects] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [streak, setStreak] = useState<any>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [mode, setMode] = useState<"home" | "play" | "manage" | "review">("home");
  const [unit, setUnit] = useState<any>(null);
  const isStaff = ctx.isStaff;

  const load = async () => {
    const year = ctx.org?.current_year ?? academicYear();
    const [f, vals, { data: s }, { data: u }, { data: q }, { data: at }, { data: st }] = await Promise.all([
      loadOrgFields(orgId),
      loadOrgYearValues(orgId, year, user ? [user.id] : []),
      (supabase as any).from("org_edu_subjects").select("*").eq("organization_id", orgId).order("sort_order"),
      (supabase as any).from("org_edu_units").select("*").eq("organization_id", orgId).order("level").order("sort_order"),
      (supabase as any).from("org_edu_questions").select("*").eq("organization_id", orgId).order("sort_order"),
      (supabase as any).from("org_edu_attempts").select("*").eq("organization_id", orgId).eq("user_id", user!.id),
      (supabase as any).from("org_edu_streaks").select("*").eq("organization_id", orgId).eq("user_id", user!.id).maybeSingle(),
    ]);
    setFields(f); setMyValues(vals[user!.id] ?? {});
    setSubjects(s ?? []); setUnits(u ?? []); setQuestions(q ?? []); setAttempts(at ?? []); setStreak(st ?? null);
    if (!subjectId && (s ?? []).length) setSubjectId(s![0].id);
  };
  useEffect(() => { if (user) load(); }, [orgId, user?.id, ctx.org?.current_year]);

  const visibleUnits = useMemo(() => units
    .filter((u) => u.subject_id === subjectId)
    .filter((u) => isStaff || matchAudience(u.audience, myValues)), [units, subjectId, myValues, isStaff]);

  const qOfUnit = (unitId: string) => questions
    .filter((q) => q.unit_id === unitId)
    .filter((q) => isStaff || matchAudience(q.audience, myValues));

  const clearedUnits = useMemo(() => {
    const set = new Set<string>();
    for (const u of units) {
      const qs = qOfUnit(u.id);
      if (!qs.length) continue;
      const ok = qs.every((q) => attempts.some((a) => a.question_id === q.id && a.correct));
      if (ok) set.add(u.id);
    }
    return set;
  }, [units, questions, attempts, myValues]);

  const xp = streak?.xp ?? 0;
  const lv = levelOf(xp);
  const progressPct = Math.min(100, Math.round(((xp - nextLevelXp(lv - 1)) / Math.max(1, nextLevelXp(lv) - nextLevelXp(lv - 1))) * 100));
  const mistakes = attempts.filter((a) => !a.correct && !a.resolved_at).length;

  if (mode === "play" && unit) {
    return <Play orgId={orgId} unit={unit} questions={qOfUnit(unit.id)} onExit={() => { setMode("home"); setUnit(null); load(); }} />;
  }
  if (mode === "manage") {
    return <Manage orgId={orgId} fields={fields} subjects={subjects} units={units} questions={questions}
      onDone={() => { setMode("home"); load(); }} />;
  }

  const TabBar = (
    <div className="flex gap-2">
      <Button size="sm" variant={mode === "home" ? "default" : "outline"} onClick={() => setMode("home")}>
        <Map className="h-4 w-4 mr-1" />カリキュラム
      </Button>
      <Button size="sm" variant={mode === "review" ? "default" : "outline"} onClick={() => setMode("review")}>
        <Brain className="h-4 w-4 mr-1" />AI復習{mistakes > 0 ? `（${mistakes}）` : ""}
      </Button>
    </div>
  );

  if (mode === "review") {
    return <div className="max-w-3xl mx-auto space-y-4">{TabBar}<OrgEduReview orgId={orgId} /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {TabBar}
      <Card className="p-5 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border-primary/30">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-12 w-12 rounded-2xl bg-primary/20 grid place-items-center"><GraduationCap className="h-6 w-6 text-primary" /></div>
          <div className="flex-1 min-w-[180px]">
            <div className="text-lg font-extrabold">Makron for education</div>
            <div className="text-xs text-muted-foreground">組織専用の教材です（コイン・ポイントは貯まりません）</div>
          </div>
          {isStaff && <Button size="sm" variant="outline" onClick={() => setMode("manage")}><Settings2 className="h-4 w-4 mr-1" />問題を管理</Button>}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Stat icon={<Star className="h-4 w-4 text-amber-500" />} label="レベル" value={`Lv.${lv}`} />
          <Stat icon={<Flame className="h-4 w-4 text-orange-500" />} label="連続学習" value={`${streak?.current_streak ?? 0}日`} />
          <Stat icon={<Trophy className="h-4 w-4 text-primary" />} label="クリア単元" value={`${clearedUnits.size}/${units.length}`} />
        </div>
        <div className="mt-3">
          <Progress value={progressPct} className="h-2" />
          <div className="text-[10px] text-muted-foreground mt-1">次のレベルまで {Math.max(0, nextLevelXp(lv) - xp)} XP ・ 復習待ち {mistakes} 問</div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {subjects.map((s, i) => (
          <button key={s.id} onClick={() => setSubjectId(s.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition ${subjectId === s.id ? "text-white" : "hover:bg-muted"}`}
            style={{ borderColor: s.color ?? HUES[i % HUES.length], background: subjectId === s.id ? (s.color ?? HUES[i % HUES.length]) : "transparent" }}>
            {s.name}
          </button>
        ))}
        {subjects.length === 0 && <Card className="p-6 w-full text-center text-sm text-muted-foreground">まだ教科がありません{isStaff ? "。「問題を管理」から追加できます。" : ""}</Card>}
      </div>

      <div className="space-y-1">
        {visibleUnits.length === 0 && subjects.length > 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">あなたに配信されている単元はまだありません</Card>
        )}
        <div className="relative pt-3">
          {visibleUnits.map((u, i) => {
            const qs = qOfUnit(u.id);
            const cleared = clearedUnits.has(u.id);
            const unlocked = isStaff || i === 0 || clearedUnits.has(visibleUnits[i - 1].id);
            const hue = HUES[i % HUES.length];
            const off = [0, 56, 80, 56, 0, -56, -80, -56][i % 8];
            const doneCount = qs.filter((q) => attempts.some((a) => a.question_id === q.id && a.correct)).length;
            return (
              <div key={u.id} className="flex flex-col items-center">
                {i > 0 && <div className="h-6 w-1 rounded-full bg-border" style={{ marginLeft: off }} />}
                <div className="flex items-center gap-3 w-full justify-center" style={{ transform: `translateX(${off}px)` }}>
                  <button disabled={!unlocked || !qs.length}
                    onClick={() => { setUnit(u); setMode("play"); }}
                    className={`relative h-16 w-16 rounded-full grid place-items-center shadow-md transition hover:scale-105 ${unlocked && qs.length ? "" : "grayscale opacity-60"}`}
                    style={{ background: cleared ? hue : `${hue}33`, border: `3px solid ${hue}` }} aria-label={u.title}>
                    {cleared ? <CheckCircle2 className="h-7 w-7 text-white" /> : unlocked ? <Star className="h-7 w-7" style={{ color: hue }} /> : <Lock className="h-6 w-6 text-muted-foreground" />}
                    <span className="absolute -bottom-1 text-[9px] px-1.5 rounded-full bg-background border">Lv{u.level}</span>
                  </button>
                  <div className="max-w-[200px]">
                    <div className="text-sm font-bold leading-tight">{u.title}</div>
                    <div className="text-[11px] text-muted-foreground">{doneCount}/{qs.length} 問正解{isStaff ? ` ・ ${audienceLabel(u.audience, fields)}` : ""}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const Stat = ({ icon, label, value }: any) => (
  <div className="rounded-xl bg-background/60 border p-2">
    <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">{icon}{label}</div>
    <div className="text-lg font-extrabold">{value}</div>
  </div>
);

function Play({ orgId, unit, questions, onExit }: { orgId: string; unit: any; questions: any[]; onExit: () => void }) {
  const { user } = useAuth();
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<null | boolean>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [reveal, setReveal] = useState<{ answer: string; explanation: string } | null>(null);
  const q = questions[i];

  const check = async () => {
    if (!q || !answer.trim()) return;
    // 採点はサーバー側（RPC）で行う。正解・解説は解答後にのみ返る。
    const { data, error } = await (supabase as any).rpc("org_edu_check_answer", { _question: q.id, _answer: answer.trim() });
    if (error) return toast.error(error.message);
    const ok = !!data?.correct;
    setReveal({ answer: data?.answer ?? "", explanation: data?.explanation ?? "" });
    setChecked(ok);
    if (ok) setCorrectCount((c) => c + 1);
  };

  const next = async () => {
    setChecked(null); setAnswer(""); setShowHint(false); setReveal(null);
    if (i + 1 < questions.length) return setI(i + 1);
    await (supabase as any).rpc("org_edu_record_result", { _org: orgId, _correct: correctCount, _xp: correctCount * 10 });
    toast.success(`終了！ ${correctCount}/${questions.length} 問正解（XP +${correctCount * 10}）`);
    onExit();
  };

  if (!q) return <Card className="p-8 text-center text-sm text-muted-foreground">問題がありません<div className="mt-3"><Button onClick={onExit}>戻る</Button></div></Card>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onExit}><ArrowLeft className="h-4 w-4 mr-1" />やめる</Button>
        <Progress value={((i) / questions.length) * 100} className="h-2 flex-1" />
        <span className="text-xs text-muted-foreground">{i + 1}/{questions.length}</span>
      </div>
      <Card className="p-5 space-y-4">
        <div className="text-xs text-muted-foreground">{unit.title}</div>
        <div className="text-base font-medium whitespace-pre-wrap">{q.body}</div>
        {q.kind === "choice" ? (
          <div className="grid gap-2">
            {(q.choices ?? []).map((c: string) => (
              <button key={c} disabled={checked !== null} onClick={() => setAnswer(c)}
                className={`text-left rounded-xl border-2 px-3 py-2 text-sm transition ${answer === c ? "border-primary bg-primary/10" : "hover:bg-muted"}`}>{c}</button>
            ))}
          </div>
        ) : (
          <Input placeholder="答えを入力" value={answer} disabled={checked !== null} onChange={(e) => setAnswer(e.target.value)} />
        )}
        {q.hint_text && checked === null && (
          showHint ? <div className="text-xs rounded-lg bg-muted p-2">ヒント: {q.hint_text}</div>
            : <Button size="sm" variant="ghost" onClick={() => setShowHint(true)}><Sparkles className="h-3.5 w-3.5 mr-1" />ヒントを見る</Button>
        )}
        {checked !== null && (
          <div className={`rounded-xl p-3 text-sm ${checked ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
            <div className="font-bold">{checked ? "正解！" : `不正解（正解: ${reveal?.answer ?? ""}）`}</div>
            {reveal?.explanation && <div className="mt-1 whitespace-pre-wrap text-foreground/80">{reveal.explanation}</div>}
            {!checked && <div className="mt-1 text-[11px] text-muted-foreground">この問題は「間違い直しノート」に入ります。AIが解き方を教えてくれます。</div>}
          </div>
        )}
        <div className="flex gap-2">
          {checked === null
            ? <Button onClick={check} disabled={!answer.trim()}><Target className="h-4 w-4 mr-1" />答え合わせ</Button>
            : <Button onClick={next}>{i + 1 < questions.length ? "次の問題へ" : "終了する"}</Button>}
        </div>
      </Card>
    </div>
  );
}

function Manage({ orgId, fields, subjects, units, questions, onDone }:
  { orgId: string; fields: OrgField[]; subjects: any[]; units: any[]; questions: any[]; onDone: () => void }) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"questions" | "structure">("questions");
  const [subjectName, setSubjectName] = useState("");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [unitTitle, setUnitTitle] = useState("");
  const [unitLevel, setUnitLevel] = useState("1");
  const [unitAud, setUnitAud] = useState<Record<string, string[]>>({});
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [draft, setDraft] = useState<any>(null);
  const [keys, setKeys] = useState<Record<string, { answer: string; explanation: string }>>({});

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).rpc("org_edu_question_keys", { _org: orgId });
      const map: Record<string, { answer: string; explanation: string }> = {};
      for (const r of data ?? []) map[r.id] = { answer: r.answer ?? "", explanation: r.explanation ?? "" };
      setKeys(map);
    })();
  }, [orgId, questions.length]);

  const selectFields = fields.filter((f) => f.type === "select");
  const toggleAud = (setter: any, key: string, opt: string) => setter((s: any) => {
    const list: string[] = s[key] ?? [];
    return { ...s, [key]: list.includes(opt) ? list.filter((x) => x !== opt) : [...list, opt] };
  });

  const AudPicker = ({ value, onToggle }: { value: Record<string, string[]>; onToggle: (k: string, o: string) => void }) => (
    <div className="space-y-1">
      <div className="text-[11px] text-muted-foreground">出題対象（未選択なら全員）</div>
      {selectFields.map((f) => (
        <div key={f.id} className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] w-16 shrink-0">{f.label}</span>
          {f.options.map((o) => (
            <button key={o} onClick={() => onToggle(f.key, o)}
              className={`px-2 py-0.5 rounded-full text-[11px] border ${(value[f.key] ?? []).includes(o) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}>{o}</button>
          ))}
        </div>
      ))}
      {selectFields.length === 0 && <div className="text-[11px] text-muted-foreground">「プロフィール項目」で選択式の項目（例: 学年）を作ると、対象を絞れます。</div>}
    </div>
  );

  const addSubject = async () => {
    if (!subjectName.trim()) return;
    const { error } = await (supabase as any).from("org_edu_subjects").insert({
      organization_id: orgId, name: subjectName.trim(), color: HUES[subjects.length % HUES.length], sort_order: subjects.length,
    });
    if (error) return toast.error(error.message);
    setSubjectName(""); toast.success("教科を追加しました"); onDone();
  };

  const addUnit = async () => {
    if (!subjectId || !unitTitle.trim()) return toast.error("教科と単元名を入力してください");
    const { error } = await (supabase as any).from("org_edu_units").insert({
      organization_id: orgId, subject_id: subjectId, title: unitTitle.trim(),
      level: Number(unitLevel) || 1, audience: unitAud, sort_order: units.length,
    });
    if (error) return toast.error(error.message);
    setUnitTitle(""); setUnitAud({}); toast.success("単元を追加しました"); onDone();
  };

  const newDraft = () => setDraft({
    unit_id: unitId || units[0]?.id || "", kind: "choice", body: "",
    choices: ["", "", "", ""], answer: "", explanation: "", hint_text: "", audience: {},
  });

  const editDraft = (q: any) => setDraft({
    id: q.id, unit_id: q.unit_id, kind: q.kind, body: q.body,
    choices: Array.isArray(q.choices) && q.choices.length ? q.choices : ["", "", "", ""],
    answer: keys[q.id]?.answer ?? "", explanation: keys[q.id]?.explanation ?? "",
    hint_text: q.hint_text ?? "", audience: q.audience ?? {},
  });

  const saveQuestion = async () => {
    if (!draft?.unit_id || !draft.body.trim() || !draft.answer.trim())
      return toast.error("単元・問題文・正解を入力してください");
    const payload = {
      organization_id: orgId, unit_id: draft.unit_id, kind: draft.kind, body: draft.body.trim(),
      choices: draft.kind === "choice" ? draft.choices.filter(Boolean) : [],
      answer: draft.answer.trim(), explanation: draft.explanation || null, hint_text: draft.hint_text || null,
      audience: draft.audience ?? {},
    };
    const { error } = draft.id
      ? await (supabase as any).from("org_edu_questions").update(payload).eq("id", draft.id)
      : await (supabase as any).from("org_edu_questions").insert({
          ...payload, created_by: user!.id,
          sort_order: questions.filter((q) => q.unit_id === draft.unit_id).length,
        });
    if (error) return toast.error(error.message);
    toast.success(draft.id ? "問題を更新しました" : "問題を追加しました");
    setDraft(null); onDone();
  };

  const del = async (table: string, id: string) => {
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    onDone();
  };

  const unitsOfSubject = units.filter((u) => !subjectId || u.subject_id === subjectId);
  const unitLabel = (id: string) => units.find((u) => u.id === id)?.title ?? "単元";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="ghost" onClick={onDone}><ArrowLeft className="h-4 w-4 mr-1" />カリキュラムへ戻る</Button>
        <Button size="sm" variant={tab === "questions" ? "default" : "outline"} onClick={() => setTab("questions")}>問題</Button>
        <Button size="sm" variant={tab === "structure" ? "default" : "outline"} onClick={() => setTab("structure")}>教科・単元</Button>
      </div>

      {tab === "structure" && (
        <>
          <Card className="p-4 space-y-2">
            <div className="font-bold text-sm">教科</div>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs" style={{ borderColor: s.color }}>
                  {s.name}<button onClick={() => del("org_edu_subjects", s.id)}><Trash2 className="h-3 w-3 text-destructive" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input className="w-48" placeholder="教科名（例: 数学）" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
              <Button onClick={addSubject}><Plus className="h-4 w-4 mr-1" />追加</Button>
            </div>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="font-bold text-sm">単元</div>
            <div className="flex flex-wrap gap-2">
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger className="w-40 h-9"><SelectValue placeholder="教科" /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input className="w-52" placeholder="単元名（例: 一次方程式）" value={unitTitle} onChange={(e) => setUnitTitle(e.target.value)} />
              <Input className="w-20" type="number" min={1} value={unitLevel} onChange={(e) => setUnitLevel(e.target.value)} />
            </div>
            <AudPicker value={unitAud} onToggle={(k, o) => toggleAud(setUnitAud, k, o)} />
            <Button size="sm" onClick={addUnit}><Plus className="h-4 w-4 mr-1" />単元を追加</Button>
            <div className="space-y-1 pt-2">
              {unitsOfSubject.map((u) => (
                <div key={u.id} className="flex items-center gap-2 text-xs border rounded-lg px-2 py-1">
                  <span className="font-medium">Lv{u.level} {u.title}</span>
                  <span className="text-muted-foreground">{audienceLabel(u.audience, fields)}</span>
                  <span className="ml-auto">{questions.filter((q) => q.unit_id === u.id).length}問</span>
                  <button onClick={() => del("org_edu_units", u.id)}><Trash2 className="h-3 w-3 text-destructive" /></button>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {tab === "questions" && (
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); const first = units.find((u) => u.subject_id === v); setUnitId(first?.id ?? ""); }}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="教科" /></SelectTrigger>
              <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger className="w-56 h-9"><SelectValue placeholder="単元を選ぶ" /></SelectTrigger>
              <SelectContent>{unitsOfSubject.map((u) => <SelectItem key={u.id} value={u.id}>Lv{u.level} {u.title}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" onClick={newDraft} disabled={!unitId}><Plus className="h-4 w-4 mr-1" />問題を追加</Button>
          </div>

          <div className="space-y-1">
            {questions.filter((q) => q.unit_id === unitId).map((q, i) => (
              <div key={q.id} className="flex items-center gap-2 text-xs border rounded-lg px-2 py-1">
                <span className="text-muted-foreground">{i + 1}.</span>
                <span className="truncate flex-1">{q.body}</span>
                <span className="text-[10px] text-muted-foreground">{q.kind === "choice" ? "選択式" : "記述"}</span>
                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => editDraft(q)}>編集</Button>
                <button onClick={() => del("org_edu_questions", q.id)}><Trash2 className="h-3 w-3 text-destructive" /></button>
              </div>
            ))}
            {unitId && questions.filter((q) => q.unit_id === unitId).length === 0 && (
              <div className="text-xs text-muted-foreground text-center p-6">問題はまだありません。「問題を追加」から作成してください。</div>
            )}
          </div>

          {draft && (
            <Card className="p-4 space-y-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">{unitLabel(draft.unit_id)} の問題</div>
              <Textarea rows={3} placeholder="問題文" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs">単元</label>
                  <Select value={draft.unit_id} onValueChange={(v) => setDraft({ ...draft, unit_id: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>Lv{u.level} {u.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs">タイプ</label>
                  <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v, answer: "" })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="choice">選択式</SelectItem><SelectItem value="text">記述</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>

              {draft.kind === "choice" ? (
                <div className="space-y-1">
                  <label className="text-xs">選択肢（ラジオで正解を選択）</label>
                  {draft.choices.map((o: string, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="radio" checked={!!o && draft.answer === o} onChange={() => o && setDraft({ ...draft, answer: o })} />
                      <Input value={o} placeholder={`選択肢${i + 1}`} onChange={(e) => {
                        const cs = [...draft.choices]; const prev = cs[i]; cs[i] = e.target.value;
                        setDraft({ ...draft, choices: cs, answer: draft.answer === prev ? e.target.value : draft.answer });
                      }} />
                      <Button size="sm" variant="ghost" onClick={() => setDraft({
                        ...draft, choices: draft.choices.filter((_: any, j: number) => j !== i),
                        answer: draft.answer === o ? "" : draft.answer,
                      })}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, choices: [...draft.choices, ""] })}>
                    <Plus className="h-3 w-3 mr-1" />選択肢追加
                  </Button>
                </div>
              ) : (
                <div>
                  <label className="text-xs">正解（前後の空白は無視して照合します）</label>
                  <Input value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} />
                </div>
              )}

              <div>
                <label className="text-xs">解説（任意）</label>
                <Textarea rows={2} value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} />
              </div>
              <div>
                <label className="text-xs">ヒント（任意。AIは使わず作成者が記入）</label>
                <Textarea rows={2} value={draft.hint_text} onChange={(e) => setDraft({ ...draft, hint_text: e.target.value })} />
              </div>
              <AudPicker value={draft.audience ?? {}} onToggle={(k, o) => setDraft((d: any) => {
                const list: string[] = d.audience?.[k] ?? [];
                return { ...d, audience: { ...(d.audience ?? {}), [k]: list.includes(o) ? list.filter((x) => x !== o) : [...list, o] } };
              })} />
              <div className="flex gap-2">
                <Button onClick={saveQuestion}>{draft.id ? "更新" : "作成"}</Button>
                <Button variant="ghost" onClick={() => setDraft(null)}>キャンセル</Button>
              </div>
            </Card>
          )}
        </Card>
      )}
    </div>
  );
}
