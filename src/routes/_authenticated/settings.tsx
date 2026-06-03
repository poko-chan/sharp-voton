import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { selfDeleteAccount } from "@/lib/admin.functions";
import { listTowns, createTown, updateTown, deleteTown } from "@/lib/town.functions";
import { MAX_STAGE, stageName } from "@/lib/town";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, Upload, User, AlertTriangle, Sparkles, Plus, Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { emitProfileChange } from "@/lib/profile-events";
import { useI18n } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { THEMES, saveUserTheme, type ThemeName } from "@/lib/theme";

function UserSettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ display_name: "", avatar_url: "" as string | null });
  const [s, setS] = useState({
    notify_daily_reminder: true,
    notify_chat: true,
    notify_streak_break: true,
    notify_email: false,
    notify_announcements: true,
    reminder_time: "20:00",
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles")
      .select("display_name, avatar_url, notify_daily_reminder, notify_chat, notify_streak_break, notify_email, notify_announcements, reminder_time")
      .eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data) {
          setProfile({ display_name: data.display_name ?? "", avatar_url: data.avatar_url });
          setS({
            notify_daily_reminder: data.notify_daily_reminder ?? true,
            notify_chat: data.notify_chat ?? true,
            notify_streak_break: data.notify_streak_break ?? true,
            notify_email: data.notify_email ?? false,
            notify_announcements: (data as any).notify_announcements ?? true,
            reminder_time: (data.reminder_time ?? "20:00").slice(0, 5),
          });
        }
        setLoading(false);
      });
  }, [user]);

  const requestBrowser = async () => {
    if (!("Notification" in window)) return toast.error("このブラウザは通知に対応していません");
    const r = await Notification.requestPermission();
    if (r === "granted") toast.success("ブラウザ通知を有効にしました");
    else toast.error("通知が許可されませんでした");
  };

  const onAvatarPick = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("画像ファイルを選んでください");
    if (file.size > 5 * 1024 * 1024) return toast.error("5MB以下にしてください");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) throw error;
      setProfile((p) => ({ ...p, avatar_url: url }));
      emitProfileChange();
      toast.success("アイコンを更新しました");
    } catch (e: any) {
      toast.error(e.message ?? "アップロード失敗");
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    const name = profile.display_name.trim();
    if (!name) return toast.error("表示名を入力してください");
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    emitProfileChange();
    toast.success("プロフィールを保存しました");
  };

  const saveNotifications = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update(s).eq("id", user.id);
    if (error) toast.error(error.message); else toast.success("通知設定を保存しました");
  };

  if (loading) return <div className="p-8 text-muted-foreground">読み込み中…</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2"><Settings /> ユーザー設定</h1>

      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2 font-semibold"><User className="h-4 w-4" /> プロフィール</div>
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.display_name} />
            <AvatarFallback>{(profile.display_name || "U").slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && onAvatarPick(e.target.files[0])}
            />
            <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "アップロード中…" : "アイコンを変更"}
            </Button>
            <p className="text-xs text-muted-foreground">JPG/PNG・最大5MB</p>
          </div>
        </div>
        <div className="space-y-1">
          <Label>表示名</Label>
          <Input value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} maxLength={40} />
        </div>
        <Button onClick={saveProfile}>プロフィールを保存</Button>
      </Card>

      <Card className="p-6 space-y-5">
        <div className="font-semibold">通知設定</div>
        <Row label="毎日の学習リマインダー" desc="設定した時刻に学習を促します" checked={s.notify_daily_reminder} onChange={(v) => setS({ ...s, notify_daily_reminder: v })} />
        <div className="pl-2"><Label className="text-xs">リマインダー時刻</Label>
          <Input type="time" value={s.reminder_time} onChange={(e) => setS({ ...s, reminder_time: e.target.value })} className="w-32" />
        </div>
        <Row label="チャット通知" desc="新しいメッセージで通知" checked={s.notify_chat} onChange={(v) => setS({ ...s, notify_chat: v })} />
        <Row label="お知らせ通知" desc="管理者からのお知らせを受け取る" checked={s.notify_announcements} onChange={(v) => setS({ ...s, notify_announcements: v })} />
        <Row label="連続学習の途切れ警告" desc="streakが途切れそうな時にお知らせ" checked={s.notify_streak_break} onChange={(v) => setS({ ...s, notify_streak_break: v })} />
        <Row label="メール通知も受け取る" desc="重要なお知らせをメールでも" checked={s.notify_email} onChange={(v) => setS({ ...s, notify_email: v })} />
        <div className="flex gap-2 pt-2">
          <Button onClick={saveNotifications}>保存</Button>
          <Button variant="outline" onClick={requestBrowser}>ブラウザ通知を有効化</Button>
        </div>
      </Card>

      <LanguageSettings />

      <ThemeSettings />

      <TownSettings />

      <DangerZone />
    </div>
  );
}

function LanguageSettings() {
  const { lang, setLang, t } = useI18n();
  return (
    <Card className="p-6 space-y-3">
      <div className="font-semibold">{t("settings.language")}</div>
      <p className="text-xs text-muted-foreground">{t("settings.language.desc")}</p>
      <Select value={lang} onValueChange={(v) => setLang(v as "ja" | "en")}>
        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ja">{t("lang.ja")}</SelectItem>
          <SelectItem value="en">{t("lang.en")}</SelectItem>
        </SelectContent>
      </Select>
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

  const load = async () => {
    const data = await fetchList();
    setTowns(data as any[]);
  };
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

function DangerZone() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const del = useServerFn(selfDeleteAccount);
  const [confirmText, setConfirmText] = useState("");
  const [counts, setCounts] = useState<{ logs: number; goals: number; questions: number; plans: number; subjects: number; events: number; ai: number; tutor: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const tables = ["study_logs", "goals", "questions", "study_plans", "subjects", "events", "ai_chats", "tutor_messages"] as const;
      const results = await Promise.all(tables.map((t) =>
        supabase.from(t as any).select("id", { count: "exact", head: true }).eq("user_id", user.id)
      ));
      setCounts({
        logs: results[0].count ?? 0, goals: results[1].count ?? 0, questions: results[2].count ?? 0,
        plans: results[3].count ?? 0, subjects: results[4].count ?? 0, events: results[5].count ?? 0,
        ai: results[6].count ?? 0, tutor: results[7].count ?? 0,
      });
    })();
  }, [user]);

  const doDelete = async () => {
    if (confirmText !== "DELETE") { toast.error("確認のため DELETE と入力してください"); throw new Error("confirm"); }
    try {
      await del();
      toast.success("アカウントを削除しました");
      await signOut();
      navigate({ to: "/login" });
    } catch (e: any) {
      toast.error(e.message ?? "削除に失敗しました");
      throw e;
    }
  };

  if (!user) return null;
  const scope = counts ? [
    `プロフィール情報（${user.email}）`,
    `勉強記録 ${counts.logs} 件`,
    `学習目標 ${counts.goals} 件`,
    `学習計画 ${counts.plans} 件`,
    `教科 ${counts.subjects} 件`,
    `カレンダー予定 ${counts.events} 件`,
    `生成した問題 ${counts.questions} 件（および採点履歴すべて）`,
    `AIチャット ${counts.ai} 件 / AIチューターメッセージ ${counts.tutor} 件`,
    `アバター画像、通知設定、ログイン情報`,
  ] : ["全データを集計中..."];

  return (
    <Card className="p-6 space-y-3 border-destructive/30">
      <div className="flex items-center gap-2 font-semibold text-destructive">
        <AlertTriangle className="h-4 w-4" /> アカウント削除
      </div>
      <p className="text-sm text-muted-foreground">
        アカウントを削除すると、以下のすべてのデータが完全に消去されます。元に戻せません。
      </p>
      <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-0.5">
        <div className="font-medium text-destructive mb-1">削除対象データ</div>
        <ul className="list-disc pl-5 text-muted-foreground">
          {scope.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">確認のため <code>DELETE</code> と入力</Label>
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" className="max-w-xs" />
      </div>
      <ConfirmDialog
        trigger={
          <Button variant="destructive" disabled={confirmText !== "DELETE"}>
            アカウントを完全に削除する
          </Button>
        }
        title="本当にアカウントを削除しますか？"
        description="この操作は取り消せません。サーバーからすべての関連データが完全に消去されます。"
        scopeItems={scope}
        confirmLabel="完全に削除する"
        onConfirm={doDelete}
      />
    </Card>
  );
}

function Row({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/settings")({ component: UserSettingsPage });
