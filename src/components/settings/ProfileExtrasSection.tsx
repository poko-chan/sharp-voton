import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, Image as ImageIcon, Shuffle, Sparkles, Upload, Award, Target } from "lucide-react";
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
  BANNER_PRESETS,
  BadgeIcon,
  UserProfileDialog,
  type BadgeView,
} from "@/components/profile/UserProfileDialog";
import { notifyPresencePrefsChanged } from "@/lib/presence";
import { emitProfileChange } from "@/lib/profile-events";

const TAGS = [
  "朝型",
  "夜型",
  "ポモドーロ派",
  "無音で集中",
  "BGMあり",
  "図書館派",
  "ノートまとめ好き",
  "暗記カード派",
  "問題演習派",
  "受験生",
  "資格勉強中",
  "コツコツ型",
];

function weekStart(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

export function ProfileExtrasSection() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [preview, setPreview] = useState(false);
  const [s, setS] = useState({
    banner_url: "preset:teal" as string | null,
    avatar_type: "image",
    avatar_config: DEFAULT_AVATAR as AvatarConfig,
    bio: "",
    status_message: "",
    study_tags: [] as string[],
    pinned_badge_codes: [] as string[],
    weekly_target_minutes: 300,
    weekly_goal_note: "",
    weekly_goal_shared: true,
    privacy_online: "friends",
    privacy_activity: "simple",
    privacy_stats: "friends",
  });
  const [earned, setEarned] = useState<BadgeView[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "banner_url, avatar_type, avatar_config, bio, status_message, study_tags, pinned_badge_codes, privacy_online, privacy_activity, privacy_stats",
        )
        .eq("id", user.id)
        .maybeSingle();
      if (data)
        setS({
          banner_url: data.banner_url ?? "preset:teal",
          avatar_type: data.avatar_type,
          avatar_config: { ...DEFAULT_AVATAR, ...((data.avatar_config as any) ?? {}) },
          bio: data.bio ?? "",
          status_message: data.status_message ?? "",
          study_tags: data.study_tags ?? [],
          pinned_badge_codes: data.pinned_badge_codes ?? [],
          privacy_online: data.privacy_online,
          privacy_activity: data.privacy_activity,
          privacy_stats: data.privacy_stats,
        });
      const { data: card } = await supabase.rpc("profile_card", { _id: user.id });
      setEarned((((card as any)?.badges ?? []) as BadgeView[]).filter((b) => b.earned_at));
      const { data: pledge } = await (supabase as any)
        .from("fr_pledges")
        .select("target_minutes, note, shared")
        .eq("user_id", user.id)
        .eq("week_start", weekStart())
        .maybeSingle();
      if (pledge)
        setS((current) => ({
          ...current,
          weekly_target_minutes: pledge.target_minutes,
          weekly_goal_note: pledge.note ?? "",
          weekly_goal_shared: pledge.shared,
        }));
      setLoaded(true);
    })();
  }, [user?.id]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
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
      })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    const { error: pledgeError } = await (supabase as any).from("fr_pledges").upsert(
      {
        user_id: user.id,
        week_start: weekStart(),
        target_minutes: Math.max(1, Math.round(s.weekly_target_minutes)),
        note: s.weekly_goal_note.trim().slice(0, 100) || null,
        shared: s.weekly_goal_shared,
      },
      { onConflict: "user_id,week_start" },
    );
    if (pledgeError) return toast.error(pledgeError.message);
    notifyPresencePrefsChanged();
    emitProfileChange();
    toast.success("プロフィールを保存しました");
  };

  const uploadBanner = async (f: File) => {
    if (!user) return;
    if (!f.type.startsWith("image/") || f.size > 5 * 1024 * 1024)
      return toast.error("5MB以下の画像を選んでください");
    const path = `${user.id}/banner-${Date.now()}.${f.name.split(".").pop() || "jpg"}`;
    const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
    if (error) return toast.error(error.message);
    setS({ ...s, banner_url: supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl });
  };

  const setAv = (k: keyof AvatarConfig, v: any) =>
    setS({ ...s, avatar_config: { ...s.avatar_config, [k]: v } });
  const toggle = (arr: string[], v: string, max: number) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : arr.length >= max ? arr : [...arr, v];

  if (!loaded) return null;

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> プロフィールの見た目と公開範囲
        </div>
        <Button variant="outline" size="sm" onClick={() => setPreview(true)}>
          <Eye className="h-4 w-4 mr-1" /> 自分のプロフィールを見る
        </Button>
      </div>

      <div className="space-y-2">
        <Label>背景画像</Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(BANNER_PRESETS).map(([k, bg]) => (
            <button
              key={k}
              onClick={() => setS({ ...s, banner_url: k })}
              className={`h-12 w-20 rounded-md border-2 ${s.banner_url === k ? "border-primary" : "border-transparent"}`}
              style={{ background: bg }}
              aria-label={k}
            />
          ))}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && uploadBanner(e.target.files[0])}
          />
          <Button variant="outline" className="h-12" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> 画像をアップロード
          </Button>
        </div>
        {s.banner_url && !s.banner_url.startsWith("preset:") && (
          <img src={s.banner_url} alt="" className="h-20 w-full object-cover rounded-md" />
        )}
      </div>

      <div className="space-y-3">
        <Label>アイコンの種類</Label>
        <div className="flex gap-2">
          <Button
            variant={s.avatar_type === "image" ? "default" : "outline"}
            size="sm"
            onClick={() => setS({ ...s, avatar_type: "image" })}
          >
            <ImageIcon className="h-4 w-4 mr-1" /> 写真
          </Button>
          <Button
            variant={s.avatar_type === "character" ? "default" : "outline"}
            size="sm"
            onClick={() => setS({ ...s, avatar_type: "character" })}
          >
            <Sparkles className="h-4 w-4 mr-1" /> キャラクター
          </Button>
        </div>
        {s.avatar_type === "character" && (
          <div className="flex flex-col sm:flex-row gap-4 rounded-lg border p-4">
            <div className="flex flex-col items-center gap-2">
              <CharacterAvatar config={s.avatar_config} size={120} className="rounded-full" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setS({ ...s, avatar_config: randomAvatar() })}
              >
                <Shuffle className="h-4 w-4 mr-1" /> おまかせ
              </Button>
            </div>
            <div className="flex-1 space-y-2 text-sm">
              <Swatches
                label="肌"
                colors={SKINS}
                value={s.avatar_config.skin}
                onChange={(v) => setAv("skin", v)}
              />
              <Steps
                label="髪型"
                n={HAIR_COUNT}
                value={s.avatar_config.hair}
                onChange={(v) => setAv("hair", v)}
              />
              <Swatches
                label="髪色"
                colors={HAIR_COLORS}
                value={s.avatar_config.hairColor}
                onChange={(v) => setAv("hairColor", v)}
              />
              <Steps
                label="目"
                n={EYES_COUNT}
                value={s.avatar_config.eyes}
                onChange={(v) => setAv("eyes", v)}
              />
              <Steps
                label="口"
                n={MOUTH_COUNT}
                value={s.avatar_config.mouth}
                onChange={(v) => setAv("mouth", v)}
              />
              <Swatches
                label="服"
                colors={OUTFITS}
                value={s.avatar_config.outfit}
                onChange={(v) => setAv("outfit", v)}
              />
              <Swatches
                label="背景"
                colors={BGS}
                value={s.avatar_config.bg}
                onChange={(v) => setAv("bg", v)}
              />
              <div className="flex items-center gap-2">
                <span className="w-10 text-muted-foreground">メガネ</span>
                <Switch
                  checked={s.avatar_config.glasses}
                  onCheckedChange={(v) => setAv("glasses", v)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label>今日のひとこと（60文字まで）</Label>
        <Input
          value={s.status_message}
          maxLength={60}
          placeholder="例: 今日は英単語を100個覚える"
          onChange={(e) => setS({ ...s, status_message: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label>自己紹介（300文字まで）</Label>
        <Textarea
          value={s.bio}
          maxLength={300}
          rows={3}
          onChange={(e) => setS({ ...s, bio: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>学習スタイル（3つまで）</Label>
        <div className="flex flex-wrap gap-1.5">
          {TAGS.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={s.study_tags.includes(t) ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setS({ ...s, study_tags: toggle(s.study_tags, t, 3) })}
            >
              {t}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <Label className="flex items-center gap-1">
          <Target className="h-4 w-4" /> 今週の学習目標
        </Label>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
          <Input
            type="number"
            min={1}
            max={10080}
            value={s.weekly_target_minutes}
            onChange={(e) => setS({ ...s, weekly_target_minutes: Number(e.target.value) })}
            className="sm:w-40"
          />
          <span className="text-sm text-muted-foreground">分 / 週</span>
        </div>
        <Input
          value={s.weekly_goal_note}
          maxLength={100}
          placeholder="例: 数学の苦手単元を復習する"
          onChange={(e) => setS({ ...s, weekly_goal_note: e.target.value })}
        />
        <div className="flex items-center gap-2 text-sm">
          <Switch
            checked={s.weekly_goal_shared}
            onCheckedChange={(v) => setS({ ...s, weekly_goal_shared: v })}
          />
          フレンドに公開する
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1">
          <Award className="h-4 w-4" /> 名前の横に飾るバッジ（3つまで）
        </Label>
        {earned.length === 0 ? (
          <p className="text-xs text-muted-foreground">まだバッジを持っていません</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {earned.map((b) => (
              <button
                key={b.code}
                onClick={() =>
                  setS({ ...s, pinned_badge_codes: toggle(s.pinned_badge_codes, b.code, 3) })
                }
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
        <Row
          label="オンライン状況"
          value={s.privacy_online}
          onChange={(v) => setS({ ...s, privacy_online: v })}
          options={[
            ["public", "全員に公開"],
            ["friends", "フレンドのみ"],
            ["private", "非公開（常にオフライン）"],
          ]}
        />
        <Row
          label="今開いている画面"
          value={s.privacy_activity}
          onChange={(v) => setS({ ...s, privacy_activity: v })}
          options={[
            ["detailed", "画面名まで表示（例: 暗記カード）"],
            ["simple", "「勉強中」とだけ表示"],
            ["private", "表示しない"],
          ]}
        />
        <Row
          label="学習記録・教材"
          value={s.privacy_stats}
          onChange={(v) => setS({ ...s, privacy_stats: v })}
          options={[
            ["public", "全員に公開"],
            ["friends", "フレンドのみ"],
            ["private", "自分だけ"],
          ]}
        />
      </div>

      <Button onClick={save}>保存する</Button>
      <UserProfileDialog
        userId={preview ? user!.id : null}
        onOpenChange={(v) => !v && setPreview(false)}
      />
    </Card>
  );
}

function Row({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
      <span className="text-sm sm:w-36">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="sm:w-72">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Swatches({
  label,
  colors,
  value,
  onChange,
}: {
  label: string;
  colors: string[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">
        {colors.map((c, i) => (
          <button
            key={c}
            onClick={() => onChange(i)}
            className={`h-6 w-6 rounded-full border-2 ${value === i ? "border-primary" : "border-border"}`}
            style={{ background: c }}
            aria-label={`${label}${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function Steps({
  label,
  n,
  value,
  onChange,
}: {
  label: string;
  n: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: n }, (_, i) => (
          <Button
            key={i}
            size="sm"
            variant={value === i ? "default" : "outline"}
            className="h-7 w-8 p-0"
            onClick={() => onChange(i)}
          >
            {i + 1}
          </Button>
        ))}
      </div>
    </div>
  );
}
