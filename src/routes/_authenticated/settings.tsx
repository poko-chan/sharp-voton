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
import { AccessibilityPanel } from "@/components/AccessibilityPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { THEMES, saveUserTheme, type ThemeName } from "@/lib/theme";
import { useUserPrefs, FONT_OPTIONS } from "@/lib/user-prefs";
import { NAV } from "@/components/AppShell";
import { useMemo } from "react";

function UserSettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState({ display_name: "", avatar_url: "" as string | null });
  const [s, setS] = useState({
    notify_daily_reminder: true,
    notify_chat: true,
    notify_streak_break: true,
    notify_announcements: true,
    reminder_time: "20:00",
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles")
      .select("display_name, avatar_url, notify_daily_reminder, notify_chat, notify_streak_break, notify_announcements, reminder_time")
      .eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data) {
          setProfile({ display_name: data.display_name ?? "", avatar_url: data.avatar_url });
          setS({
            notify_daily_reminder: data.notify_daily_reminder ?? true,
            notify_chat: data.notify_chat ?? true,
            notify_streak_break: data.notify_streak_break ?? true,
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
    if (r === "granted") toast.success("ブラウザ通知を有効にしました。リマインダーが届くようになります");
    else toast.error("通知が許可されませんでした。ブラウザの設定から通知を許可してください");
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

  const notifPermission = typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2"><Settings /> {t("settings.title")}</h1>
      <AccessibilityPanel />
      <CustomizationPanel />

      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2 font-semibold"><User className="h-4 w-4" /> {t("settings.profile")}</div>
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
              {uploading ? t("settings.uploading") : t("settings.changeIcon")}
            </Button>
            <p className="text-xs text-muted-foreground">JPG/PNG・最大5MB</p>
          </div>
        </div>
        <div className="space-y-1">
          <Label>{t("settings.displayName")}</Label>
          <Input value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} maxLength={40} />
        </div>
        <Button onClick={saveProfile}>{t("settings.saveProfile")}</Button>
      </Card>

      <Card className="p-6 space-y-5">
        <div className="font-semibold">{t("settings.notifications")}</div>
        {notifPermission !== "granted" && (
          <p className="text-xs text-warning-foreground bg-warning/10 border border-warning/30 rounded p-2">
            {t("settings.notifPermissionNeeded")}
          </p>
        )}
        <Row label={t("settings.dailyReminder")} desc={t("settings.dailyReminderDesc")} checked={s.notify_daily_reminder} onChange={(v) => setS({ ...s, notify_daily_reminder: v })} />
        <div className="pl-2"><Label className="text-xs">{t("settings.reminderTime")}</Label>
          <Input type="time" value={s.reminder_time} onChange={(e) => setS({ ...s, reminder_time: e.target.value })} className="w-32" />
        </div>
        <Row label={t("settings.chatNotif")} desc={t("settings.chatNotifDesc")} checked={s.notify_chat} onChange={(v) => setS({ ...s, notify_chat: v })} />
        <Row label={t("settings.announcementNotif")} desc={t("settings.announcementNotifDesc")} checked={s.notify_announcements} onChange={(v) => setS({ ...s, notify_announcements: v })} />
        <Row label={t("settings.streakNotif")} desc={t("settings.streakNotifDesc")} checked={s.notify_streak_break} onChange={(v) => setS({ ...s, notify_streak_break: v })} />
        <div className="flex gap-2 pt-2">
          <Button onClick={saveNotifications}>{t("common.save")}</Button>
          <Button variant="outline" onClick={requestBrowser}>{t("settings.enableBrowserNotif")}</Button>
        </div>
      </Card>

      <LanguageSettings />

      <ThemeSettings />

      <TownSettings />

      <ExportPanel />

      <PlanPanel />
      <InvitePanel />

      <DangerZone />
    </div>
  );
}

function PlanPanel() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<string>("free");
  useEffect(() => {
    if (!user) return;
    (supabase as any).from("profiles").select("current_plan").eq("id", user.id).maybeSingle()
      .then(({ data }: any) => setPlan(data?.current_plan ?? "free"));
  }, [user?.id]);
  return (
    <Card className="p-6 space-y-3">
      <div className="font-semibold">現在のプラン</div>
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold">{plan === "free" ? "無料プラン" : plan}</span>
        <span className="text-xs px-2 py-0.5 rounded bg-muted">{plan.toUpperCase()}</span>
      </div>
      <p className="text-sm text-muted-foreground">有料プランは現在準備中です。すべての機能を無料でご利用いただけます。</p>
    </Card>
  );
}

function InvitePanel() {
  const { user } = useAuth();
  const [code, setCode] = useState<string>("");
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).rpc("my_profile_private");
      setCode((data as any)?.referral_code ?? "");
      const { count: c } = await (supabase as any).from("user_referrals").select("*", { count: "exact", head: true }).eq("referrer_id", user.id);
      setCount(c ?? 0);
    })();
  }, [user?.id]);
  const link = typeof window !== "undefined" ? `${window.location.origin}/r/${code}` : `/r/${code}`;
  return (
    <Card className="p-6 space-y-3">
      <div className="font-semibold">友達を招待 (+10コイン)</div>
      <p className="text-sm text-muted-foreground">招待リンクから登録された方とあなたの両方に 10 コインがプレゼントされます。</p>
      <div className="flex gap-2">
        <Input value={link} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
        <Button onClick={() => { navigator.clipboard.writeText(link); toast.success("コピーしました"); }}>コピー</Button>
      </div>
      <div className="text-xs text-muted-foreground">これまでに {count} 人を招待しました</div>
    </Card>
  );
}

function ExportPanel() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const csv = async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase.from("study_logs").select("date,duration_minutes,memo,tag,subject_id").eq("user_id", user.id).order("date");
    const rows = ["date,duration_minutes,memo,tag,subject_id", ...(data ?? []).map((r: any) => `${r.date},${r.duration_minutes},"${(r.memo ?? "").replace(/"/g, '""')}",${r.tag ?? ""},${r.subject_id ?? ""}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `study_logs_${Date.now()}.csv`; a.click();
    setBusy(false); toast.success("CSVを出力しました");
  };
  const ics = async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase.from("events").select("title,start_at,end_at").eq("user_id", user.id);
    const out = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//StudyApp//EN",
      ...(data ?? []).flatMap((e: any) => ["BEGIN:VEVENT", `UID:${e.start_at}-${Math.random()}@studyapp`, `SUMMARY:${e.title}`, `DTSTART:${(e.start_at ?? "").replace(/[-:]/g, "").slice(0, 15)}Z`, e.end_at ? `DTEND:${(e.end_at ?? "").replace(/[-:]/g, "").slice(0, 15)}Z` : "", "END:VEVENT"].filter(Boolean)),
      "END:VCALENDAR"].join("\n");
    const blob = new Blob([out], { type: "text/calendar" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "events.ics"; a.click();
    setBusy(false); toast.success("カレンダーを出力しました");
  };
  return (
    <Card className="p-6 space-y-3">
      <div className="font-semibold">データ出力</div>
      <p className="text-sm text-muted-foreground">勉強記録や予定を外部にエクスポート。</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={csv} disabled={busy} variant="outline">CSVダウンロード</Button>
        <Button onClick={ics} disabled={busy} variant="outline">.icsダウンロード</Button>
      </div>
    </Card>
  );
}

function CustomizationPanel() {
  const { prefs, save } = useUserPrefs();
  const { isAdmin } = useAuth();
  const NAV_ITEMS: { to: string; label: string }[] = [
    { to: "/dashboard", label: "ダッシュボード" },
    { to: "/today", label: "Today" },
    { to: "/study", label: "勉強記録" },
    { to: "/timer", label: "タイマー" },
    { to: "/calendar", label: "カレンダー" },
    { to: "/goals", label: "目標" },
    { to: "/heatmap", label: "ヒートマップ" },
    { to: "/flashcards", label: "暗記カード" },
    { to: "/friends", label: "フレンド" },
    { to: "/polls", label: "投票" },
    { to: "/questions", label: "AI問題作成" },
    { to: "/practice", label: "AI演習" },
    { to: "/tutor", label: "AIチャット" },
    { to: "/classroom", label: "Classroom" },
    { to: "/chat", label: "チャット" },
    { to: "/classchat", label: "クラスチャット" },
    { to: "/notes", label: "付箋" },
    { to: "/announcements", label: "お知らせ" },
    { to: "/share", label: "共有" },
    { to: "/missions", label: "デイリーミッション" },
    { to: "/leaderboard", label: "ランキング" },
    { to: "/rank", label: "段位・称号" },
    { to: "/export", label: "データ出力" },
  ];
  const hidden = new Set(prefs.sidebar_hidden ?? []);
  const toggleNav = (to: string) => {
    const next = new Set(hidden);
    if (next.has(to)) next.delete(to); else next.add(to);
    save({ sidebar_hidden: Array.from(next) });
  };
  const dock = new Set(prefs.right_dock ?? ["ambient","feedback"]);
  const toggleDock = (k: string) => {
    const next = new Set(dock);
    if (next.has(k)) next.delete(k); else next.add(k);
    save({ right_dock: Array.from(next) });
  };
  return (
    <Card className="p-6 space-y-4">
      <div className="font-semibold">画面カスタマイズ</div>
      <div className="space-y-2">
        <Label>フォント（Google Fonts）</Label>
        <Select value={prefs.font_family ?? "system"} onValueChange={(v) => save({ font_family: v })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                <span style={{ fontFamily: f.css }}>{f.label}（あア亜Aa）</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">アプリ全体のフォントを変更します。選択時に Google Fonts から動的に読み込みます。</p>
      </div>
      <div className="space-y-2">
        <Label>テーマカラー</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={(prefs as any).theme_color ?? "#3B82F6"}
            onChange={(e) => {
              const v = e.target.value;
              save({ ...(prefs as any), theme_color: v } as any);
              document.documentElement.style.setProperty("--primary", v);
            }}
            className="h-10 w-16 rounded border"
          />
          <span className="text-xs text-muted-foreground">アプリ全体のアクセントカラーを変更します。</span>
        </div>
      </div>
      <div className="space-y-2">
        <Label>右下のフローティング機能</Label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center justify-between rounded border p-2 text-sm">
            <span>サポート/フィードバック</span>
            <Switch checked={dock.has("feedback")} onCheckedChange={() => toggleDock("feedback")} />
          </label>
          <label className="flex items-center justify-between rounded border p-2 text-sm">
            <span>環境音 (タイマーのみ)</span>
            <Switch checked={dock.has("ambient")} onCheckedChange={() => toggleDock("ambient")} />
          </label>
          <MikuToggleRow />
        </div>
        <p className="text-[11px] text-muted-foreground">※ 環境音ボタンはタイマー画面のみで表示されます。</p>
      </div>
      <div className="space-y-2">
        <Label>左メニューに表示する項目</Label>
        <p className="text-[11px] text-muted-foreground">OFFにした項目は「その他」メニューから引き続きアクセスできます。</p>
        <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-auto rounded border p-2">
          {NAV_ITEMS.map((n) => (
            <label key={n.to} className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-accent">
              <span className="truncate">{n.label}</span>
              <Switch checked={!hidden.has(n.to)} onCheckedChange={() => toggleNav(n.to)} />
            </label>
          ))}
        </div>
      </div>
      {isAdmin && (
        <div className="rounded border border-warning/40 bg-warning/5 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">管理者として実行</div>
              <div className="text-[11px] text-muted-foreground">ON にすると、利用停止サービスを管理者として閲覧・操作できます。OFFでは一般ユーザーと同じ制限を受けます。</div>
            </div>
            <Switch checked={prefs.act_as_admin} onCheckedChange={(v) => save({ act_as_admin: v })} />
          </div>
        </div>
      )}
    </Card>
  );
}

function MikuToggleRow() {
  const { enabled, toggle } = useMikuEnabled();
  return (
    <label className="flex items-center justify-between rounded border p-2 text-sm">
      <span>🎤 初音ミクが画面を歩く</span>
      <Switch checked={enabled} onCheckedChange={(v) => toggle(!!v)} />
    </label>
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

function ThemeSettings() {
  const { user } = useAuth();
  const [theme, setTheme] = useState<ThemeName>("default");
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("theme")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setTheme(((data as { theme?: ThemeName } | null)?.theme ?? "default") as ThemeName));
  }, [user]);
  const onPick = async (t: ThemeName) => {
    setTheme(t);
    if (user) await saveUserTheme(user.id, t);
  };
  return (
    <Card className="p-6 space-y-3">
      <div className="font-semibold">テーマカラー</div>
      <p className="text-xs text-muted-foreground">アプリの配色をお好みに切り替えできます</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {THEMES.map((tm) => (
          <button
            key={tm.key}
            onClick={() => onPick(tm.key)}
            className={`p-3 rounded-lg border-2 text-xs flex flex-col items-center gap-2 transition ${
              theme === tm.key ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
            }`}
          >
            <span className="h-8 w-8 rounded-full border" style={{ background: tm.swatch }} />
            <span>{tm.label}</span>
          </button>
        ))}
      </div>
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
