import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, Image as ImageIcon, Shuffle, Sparkles, Upload, Award, Loader2, Lock, Crown } from "lucide-react";
import {
  CharacterAvatar,
  DEFAULT_AVATAR,
  randomAvatar,
  SKINS,
  HAIR_COLORS,
  OUTFITS,
  BGS,
  HAIR_COUNT,
  EYES_COUNT,
  MOUTH_COUNT,
  type AvatarConfig,
} from "@/components/profile/CharacterAvatar";
import {
  ANIMATED_BANNERS,
  BANNER_PRESETS,
  BadgeIcon,
  FRAMES,
  UserProfileDialog,
  bannerStyle,
  frameStyle,
  resolveFrame,
  unlockedFrames,
  ProfileAvatar,
  type BadgeView,
} from "@/components/profile/UserProfileDialog";
import { notifyPresencePrefsChanged } from "@/lib/presence";
import { emitProfileChange } from "@/lib/profile-events";

const TAGS = ["朝型", "夜型", "ポモドーロ派", "無音で集中", "BGMあり", "図書館派", "ノートまとめ好き", "暗記カード派", "問題演習派", "受験生", "資格勉強中", "コツコツ型"];

/** 称号: 条件を満たすと選べる */
const TITLES: { name: string; need: string; ok: (streak: number, badges: number) => boolean }[] = [
  { name: "はじめの一歩", need: "いつでも", ok: () => true },
  { name: "コツコツ学習者", need: "3日連続", ok: (s) => s >= 3 },
  { name: "習慣マスター", need: "7日連続", ok: (s) => s >= 7 },
  { name: "継続の達人", need: "14日連続", ok: (s) => s >= 14 },
  { name: "不屈の挑戦者", need: "30日連続", ok: (s) => s >= 30 },
  { name: "バッジコレクター", need: "バッジ3つ", ok: (_s, b) => b >= 3 },
];

type State = {
  display_name: string;
  banner_url: string | null;
  avatar_type: string;
  avatar_config: AvatarConfig;
  bio: string;
  status_message: string;
  study_tags: string[];
  pinned_badge_codes: string[];
  privacy_online: string;
  privacy_activity: string;
  privacy_stats: string;
  profile_title: string;
  profile_frame: string;
  goal_text: string;
  goal_date: string;
};

/** プロフィール編集フォーム本体（設定画面・フレンド画面の両方で使う） */
export function ProfileEditor({ onSaved, compact }: { onSaved?: () => void; compact?: boolean }) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [s, setRaw] = useState<State | null>(null);
  const [earned, setEarned] = useState<BadgeView[]>([]);
  const [streak, setStreak] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const setS = (next: State) => {
    setRaw(next);
    setDirty(true);
  };

  const load = async () => {
    if (!user) return;
    setStatus("loading");
    const [{ data, error }, { data: card }, { data: extra }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name, avatar_url, banner_url, avatar_type, avatar_config, bio, status_message, study_tags, pinned_badge_codes, privacy_online, privacy_activity, privacy_stats, profile_title, profile_frame, goal_text, goal_date",
        )
        .eq("id", user.id)
        .maybeSingle(),
      supabase.rpc("profile_card", { _id: user.id }),
      supabase.rpc("profile_card_extra" as any, { _id: user.id }),
    ]);
    if (error || !data) {
      setStatus("error");
      return;
    }
    const d = data as any;
    setAvatarUrl(d.avatar_url ?? null);
    setRaw({
      display_name: d.display_name ?? "",
      banner_url: d.banner_url ?? "preset:teal",
      avatar_type: d.avatar_type ?? "image",
      avatar_config: { ...DEFAULT_AVATAR, ...(d.avatar_config ?? {}) },
      bio: d.bio ?? "",
      status_message: d.status_message ?? "",
      study_tags: d.study_tags ?? [],
      pinned_badge_codes: d.pinned_badge_codes ?? [],
      privacy_online: d.privacy_online ?? "friends",
      privacy_activity: d.privacy_activity ?? "simple",
      privacy_stats: d.privacy_stats ?? "friends",
      profile_title: d.profile_title ?? "",
      profile_frame: d.profile_frame ?? "auto",
      goal_text: d.goal_text ?? "",
      goal_date: d.goal_date ?? "",
    });
    setEarned((((card as any)?.badges ?? []) as BadgeView[]).filter((b) => b.earned_at));
    setStreak((extra as any)?.streak ?? 0);
    setDirty(false);
    setStatus("ready");
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const save = async () => {
    if (!user || !s || saving) return;
    const name = s.display_name.trim();
    if (!name) return toast.error("表示名を入力してください");
    setSaving(true);
    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: name.slice(0, 40),
        banner_url: s.banner_url,
        avatar_type: s.avatar_type,
        avatar_config: s.avatar_config as any,
        bio: s.bio.trim().slice(0, 300) || null,
        status_message: s.status_message.trim().slice(0, 60) || null,
        study_tags: s.study_tags,
        pinned_badge_codes: s.pinned_badge_codes,
        privacy_online: s.privacy_online,
        privacy_activity: s.privacy_activity,
        privacy_stats: s.privacy_stats,
        profile_title: s.profile_title || null,
        profile_frame: s.profile_frame || "auto",
        goal_text: s.goal_text.trim().slice(0, 40) || null,
        goal_date: s.goal_date || null,
      } as any)
      .eq("id", user.id)
      .select("id");
    setSaving(false);
    if (error) return toast.error(`保存できませんでした: ${error.message}`);
    if (!data || data.length === 0) return toast.error("保存できませんでした。ログインし直してからもう一度お試しください");
    setDirty(false);
    notifyPresencePrefsChanged();
    emitProfileChange();
    toast.success("プロフィールを保存しました");
    onSaved?.();
  };

  const uploadBanner = async (f: File) => {
    if (!user || !s) return;
    if (!f.type.startsWith("image/") || f.size > 5 * 1024 * 1024) return toast.error("5MB以下の画像を選んでください");
    const path = `${user.id}/banner-${Date.now()}.${f.name.split(".").pop() || "jpg"}`;
    const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
    if (error) return toast.error(error.message);
    setS({ ...s, banner_url: supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl });
  };

  if (status === "loading" || (!s && status !== "error"))
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> 読み込み中…
      </div>
    );
  if (status === "error" || !s)
    return (
      <div className="space-y-2 p-6 text-center text-sm">
        <p className="text-muted-foreground">プロフィールを読み込めませんでした。</p>
        <Button size="sm" variant="outline" onClick={load}>もう一度読み込む</Button>
      </div>
    );

  const setAv = (k: keyof AvatarConfig, v: any) => setS({ ...s, avatar_config: { ...s.avatar_config, [k]: v } });
  const toggle = (arr: string[], v: string, max: number) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : arr.length >= max ? arr : [...arr, v];
  const okFrames = unlockedFrames(streak, earned.length);
  const tier = resolveFrame(s.profile_frame, streak, earned.length);
  const titleOptions = [
    ...TITLES.map((t) => ({ name: t.name, need: t.need, ok: t.ok(streak, earned.length) })),
    ...earned.map((b) => ({ name: b.name, need: "バッジ獲得", ok: true })),
  ];

  return (
    <div className="space-y-4">
      {/* ライブプレビュー */}
      <div className="overflow-hidden rounded-xl border">
        <div className="h-16 profile-anim" style={bannerStyle(s.banner_url)} />
        <div className="-mt-7 flex items-end gap-3 px-4 pb-3">
          <div className="rounded-full bg-background ring-4 ring-background profile-anim" style={frameStyle(tier)}>
            <ProfileAvatar p={{ avatar_type: s.avatar_type, avatar_config: s.avatar_config, avatar_url: avatarUrl, display_name: s.display_name }} size={56} />
          </div>
          <div className="min-w-0 pb-1">
            {s.profile_title && (
              <div className="inline-flex items-center gap-1 rounded bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                <Crown className="h-2.5 w-2.5" /> {s.profile_title}
              </div>
            )}
            <div className="truncate font-bold">{s.display_name || "表示名"}</div>
            {s.status_message && <div className="truncate text-xs text-muted-foreground">{s.status_message}</div>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="look">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="look">見た目</TabsTrigger>
          <TabsTrigger value="info">基本情報</TabsTrigger>
          <TabsTrigger value="more">飾り・公開</TabsTrigger>
        </TabsList>

        <TabsContent value="look" className="mt-4 space-y-5">
          <div className="space-y-2">
            <Label>背景</Label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(BANNER_PRESETS).map((k) => (
                <button
                  key={k}
                  onClick={() => setS({ ...s, banner_url: k })}
                  className={`relative h-12 w-20 rounded-md border-2 profile-anim ${s.banner_url === k ? "border-primary" : "border-transparent"}`}
                  style={bannerStyle(k)}
                  aria-label={ANIMATED_BANNERS[k] ?? k}
                  title={ANIMATED_BANNERS[k]}
                >
                  {ANIMATED_BANNERS[k] && <Sparkles className="absolute right-1 top-1 h-3 w-3 text-primary-foreground" />}
                </button>
              ))}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadBanner(e.target.files[0])} />
              <Button variant="outline" className="h-12" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> 画像
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">きらきらマークは動く背景です</p>
          </div>


          <div className="space-y-2">
            <Label>カード枠</Label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={s.profile_frame === "auto" ? "default" : "outline"} onClick={() => setS({ ...s, profile_frame: "auto" })}>
                おまかせ（一番いい枠）
              </Button>
              {FRAMES.map((f) => {
                const ok = okFrames.includes(f.key);
                return (
                  <Button
                    key={f.key}
                    size="sm"
                    variant={s.profile_frame === f.key ? "default" : "outline"}
                    disabled={!ok}
                    title={ok ? f.label : `${f.need}で解放`}
                    onClick={() => setS({ ...s, profile_frame: f.key })}
                  >
                    {!ok && <Lock className="h-3 w-3 mr-1" />}
                    <span className="mr-1 inline-block h-3 w-3 rounded-full border" style={{ background: f.color }} />
                    {f.label}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              いま {streak}日連続・バッジ{earned.length}個。勉強を続けたりバッジを集めると枠が解放されます。
            </p>
          </div>
        </TabsContent>

        <TabsContent value="info" className="mt-4 space-y-4">
          <div className="space-y-1">
            <Label>表示名（40文字まで）</Label>
            <Input value={s.display_name} maxLength={40} onChange={(e) => setS({ ...s, display_name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>今日のひとこと（60文字まで）</Label>
            <Input value={s.status_message} maxLength={60} placeholder="例: 今日は英単語を100個覚える" onChange={(e) => setS({ ...s, status_message: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>自己紹介（300文字まで）</Label>
            <Textarea value={s.bio} maxLength={300} rows={3} onChange={(e) => setS({ ...s, bio: e.target.value })} />
            <div className="text-right text-[10px] text-muted-foreground">{s.bio.length}/300</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <Label>目標（40文字まで）</Label>
              <Input value={s.goal_text} maxLength={40} placeholder="例: 英検準1級に合格" onChange={(e) => setS({ ...s, goal_text: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>目標の日（カウントダウン）</Label>
              <Input type="date" value={s.goal_date} onChange={(e) => setS({ ...s, goal_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>学習スタイル（3つまで）</Label>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((t) => (
                <Button key={t} size="sm" variant={s.study_tags.includes(t) ? "default" : "outline"} className="h-7 text-xs" onClick={() => setS({ ...s, study_tags: toggle(s.study_tags, t, 3) })}>
                  {t}
                </Button>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="more" className="mt-4 space-y-5">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Crown className="h-4 w-4" /> 称号
            </Label>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant={!s.profile_title ? "default" : "outline"} className="h-7 text-xs" onClick={() => setS({ ...s, profile_title: "" })}>
                つけない
              </Button>
              {titleOptions.map((t) => (
                <Button
                  key={t.name}
                  size="sm"
                  variant={s.profile_title === t.name ? "default" : "outline"}
                  className="h-7 text-xs"
                  disabled={!t.ok}
                  title={t.ok ? t.name : `${t.need}で解放`}
                  onClick={() => setS({ ...s, profile_title: t.name })}
                >
                  {!t.ok && <Lock className="h-3 w-3 mr-1" />}
                  {t.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Award className="h-4 w-4" /> トロフィー棚に飾るバッジ（3つまで）
            </Label>
            {earned.length === 0 ? (
              <p className="text-xs text-muted-foreground">まだバッジを持っていません</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {earned.map((b) => (
                  <button
                    key={b.code}
                    onClick={() => setS({ ...s, pinned_badge_codes: toggle(s.pinned_badge_codes, b.code, 3) })}
                    className={`flex items-center gap-2 rounded-full border-2 pr-3 ${s.pinned_badge_codes.includes(b.code) ? "border-primary" : "border-transparent bg-muted"}`}
                  >
                    <BadgeIcon b={b} size={28} />
                    <span className="text-xs">{b.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="font-medium text-sm">公開範囲</div>
            <Row label="オンライン状況" value={s.privacy_online} onChange={(v) => setS({ ...s, privacy_online: v })}
              options={[["public", "全員に公開"], ["friends", "フレンドのみ"], ["private", "非公開（常にオフライン）"]]} />
            <Row label="今開いている画面" value={s.privacy_activity} onChange={(v) => setS({ ...s, privacy_activity: v })}
              options={[["detailed", "画面名まで表示（例: 暗記カード）"], ["simple", "「勉強中」とだけ表示"], ["private", "表示しない"]]} />
            <Row label="学習記録・連続日数" value={s.privacy_stats} onChange={(v) => setS({ ...s, privacy_stats: v })}
              options={[["public", "全員に公開"], ["friends", "フレンドのみ"], ["private", "自分だけ"]]} />
            <p className="text-xs text-muted-foreground">応援メッセージはフレンドにだけ表示されます。</p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background pt-3">
        {dirty && <span className="mr-auto text-xs text-muted-foreground">未保存の変更があります</span>}
        <Button onClick={save} disabled={saving || !dirty}>
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          保存する
        </Button>
      </div>
    </div>
  );
}

/** 設定画面用 */
export function ProfileExtrasSection() {
  const { user } = useAuth();
  const [preview, setPreview] = useState(false);
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> プロフィール
        </div>
        <Button variant="outline" size="sm" onClick={() => setPreview(true)}>
          <Eye className="h-4 w-4 mr-1" /> 自分のプロフィールを見る
        </Button>
      </div>
      <ProfileEditor />
      <UserProfileDialog userId={preview && user ? user.id : null} onOpenChange={(v) => !v && setPreview(false)} />
    </Card>
  );
}

/** フレンド画面・プロフィール画面から開く編集ダイアログ */
export function ProfileEditDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved?: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[88dvh] overflow-y-auto">
        <DialogTitle>プロフィールを編集</DialogTitle>
        {open && (
          <ProfileEditor
            compact
            onSaved={() => {
              onSaved?.();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Swatches({ label, colors, value, onChange }: { label: string; colors: string[]; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">
        {colors.map((c, i) => (
          <button key={c} onClick={() => onChange(i)} className={`h-6 w-6 rounded-full border-2 ${value === i ? "border-primary" : "border-border"}`} style={{ background: c }} aria-label={`${label}${i + 1}`} />
        ))}
      </div>
    </div>
  );
}

function Steps({ label, n, value, onChange }: { label: string; n: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: n }, (_, i) => (
          <Button key={i} size="sm" variant={value === i ? "default" : "outline"} className="h-7 w-8 p-0" onClick={() => onChange(i)}>
            {i + 1}
          </Button>
        ))}
      </div>
    </div>
  );
}
