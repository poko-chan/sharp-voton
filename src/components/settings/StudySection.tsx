import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Plus, Archive, Trash2 } from "lucide-react";
import { listTowns, createTown, updateTown, deleteTown } from "@/lib/town.functions";
import { MAX_STAGE, stageName } from "@/lib/town";
import { useLocalPrefs } from "@/lib/user-prefs";
import { useOrderedSubjects } from "@/lib/subjects";
import { SectionHeading, SettingRow } from "./shared";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function StudySection() {
  return (
    <div className="space-y-6">
      <SectionHeading title="学習" desc="学習の初期設定やタイマー、町の目標を管理します" />
      <StudyPrefsPanel />
      <TownSettings />
    </div>
  );
}

function StudyPrefsPanel() {
  const { prefs, save } = useLocalPrefs();
  const { subjects } = useOrderedSubjects();
  return (
    <Card className="p-6 space-y-5">
      <div className="font-semibold">学習の初期設定（この端末のみ）</div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>週の開始曜日</Label>
          <Select value={String(prefs.week_start_day)} onValueChange={(v) => save({ week_start_day: Number(v) as 0 | 1 })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{WEEKDAYS[0]}曜日</SelectItem>
              <SelectItem value="1">{WEEKDAYS[1]}曜日</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>既定の学習教科</Label>
          <Select value={prefs.default_subject_id ?? "none"} onValueChange={(v) => save({ default_subject_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">指定なし</SelectItem>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>タイマーの既定時間（分）</Label>
          <Input
            type="number" min={1} max={180}
            value={prefs.timer_default_minutes}
            onChange={(e) => save({ timer_default_minutes: Math.max(1, Math.min(180, Number(e.target.value) || 1)) })}
          />
        </div>
        <div className="space-y-1">
          <Label>自動休憩の長さ（分）</Label>
          <Input
            type="number" min={1} max={60}
            value={prefs.timer_break_minutes}
            onChange={(e) => save({ timer_break_minutes: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
            disabled={!prefs.timer_auto_break}
          />
        </div>
        <div className="space-y-1">
          <Label>一覧の既定表示件数</Label>
          <Select value={String(prefs.list_page_size)} onValueChange={(v) => save({ list_page_size: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}件</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <SettingRow
        label="タイマー終了後に自動で休憩を開始する"
        desc="学習タイマーが終わったら自動的に休憩タイマーを開始します"
        checked={prefs.timer_auto_break}
        onChange={(v) => save({ timer_auto_break: v })}
      />
    </Card>
  );
}

function TownSettings() {
  const fetchList = useServerFn(listTowns);
  const create = useServerFn(createTown);
  const update = useServerFn(updateTown);
  const remove = useServerFn(deleteTown);
  const [towns, setTowns] = useState<any[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGoal, setNewGoal] = useState("");

  const load = async () => setTowns((await fetchList()) as any[]);
  useEffect(() => { load(); }, []);

  const active = (towns ?? []).filter((t) => !t.archived);
  const canCreate = active.length === 0 || active.some((t) => (t.max_stage_reached ?? 0) >= MAX_STAGE);

  const onCreate = async () => {
    const name = newName.trim();
    const goal = newGoal.trim();
    if (!name) return toast.error("町の名前を入力してください");
    if (!goal) return toast.error("町の目標を入力してください");
    try {
      await create({ data: { name, town_goal: goal } });
      toast.success("町を作成しました");
      setCreating(false);
      setNewName(""); setNewGoal("");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" /> 町（目標）</div>
      <p className="text-xs text-muted-foreground">
        町ごとに「目標」を設定すると、AIが学習データを見て町を発展・退化させます。最初は1つだけ作成でき、最大ステージに到達すると新しい町を追加できます。
      </p>

      {towns === null && <p className="text-sm text-muted-foreground">読み込み中…</p>}

      {(towns ?? []).map((t) => (
        <TownEditor key={t.id} town={t} onUpdate={load} update={update} remove={remove} />
      ))}

      {!creating && (
        <Button onClick={() => setCreating(true)} disabled={!canCreate} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          {active.length === 0 ? "最初の町を作る" : canCreate ? "新しい町を作る" : `新規作成は最大ステージ(${MAX_STAGE})到達後`}
        </Button>
      )}

      {creating && (
        <div className="rounded border p-4 space-y-3 bg-muted/30">
          <div className="space-y-1">
            <Label>町の名前</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={100} placeholder="私の理想の町" />
          </div>
          <div className="space-y-1">
            <Label>町の目標（AIに伝える詳細）</Label>
            <Textarea
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="例: 数学を毎日30分以上、英語は週3回。応用問題に挑戦して理解を深める町にしたい。"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={onCreate}>作成</Button>
            <Button variant="outline" onClick={() => { setCreating(false); setNewName(""); setNewGoal(""); }}>キャンセル</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function TownEditor({ town, onUpdate, update, remove }: any) {
  const [name, setName] = useState(town.name);
  const [goal, setGoal] = useState(town.town_goal);
  const dirty = name !== town.name || goal !== town.town_goal;

  const save = async () => {
    try {
      await update({ data: { id: town.id, name: name.trim(), town_goal: goal.trim() } });
      toast.success("保存しました");
      onUpdate();
    } catch (e: any) { toast.error(e.message); }
  };
  const toggleArchive = async () => {
    try {
      await update({ data: { id: town.id, archived: !town.archived } });
      toast.success(town.archived ? "復活させました" : "アーカイブしました");
      onUpdate();
    } catch (e: any) { toast.error(e.message); }
  };
  const del = async () => {
    if (!confirm(`「${town.name}」を完全に削除しますか？履歴も全て消えます。`)) return;
    try {
      await remove({ data: { id: town.id } });
      toast.success("削除しました");
      onUpdate();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className={`rounded border p-4 space-y-2 ${town.archived ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          現在: {stageName(town.stage)} (Stage {town.stage} / 最大到達 {town.max_stage_reached})
          {town.archived && " ・ アーカイブ済"}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={toggleArchive} title={town.archived ? "復活" : "アーカイブ"}>
            <Archive className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={del} title="削除" className="text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
      <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={4} maxLength={4000} placeholder="この町の目標" />
      {dirty && (
        <div className="flex gap-2">
          <Button size="sm" onClick={save}>保存</Button>
          <Button size="sm" variant="outline" onClick={() => { setName(town.name); setGoal(town.town_goal); }}>取消</Button>
        </div>
      )}
    </div>
  );
}
