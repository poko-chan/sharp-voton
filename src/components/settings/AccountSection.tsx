import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, User } from "lucide-react";
import { toast } from "sonner";
import { emitProfileChange } from "@/lib/profile-events";
import { useI18n } from "@/lib/i18n";
import { SectionHeading } from "./shared";
import {
  CharacterAvatar,
  DEFAULT_CHARACTER,
  normalizeCharacter,
  type CharacterConfig,
} from "@/components/profile/CharacterAvatar";
import { ProfileExtrasSection } from "./ProfileExtrasSection";

export function AccountSection() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState({
    display_name: "",
    avatar_url: "" as string | null,
    character_profile: DEFAULT_CHARACTER,
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (supabase as any).rpc("my_profile_private").then(({ data }: any) => {
      if (data) {
        setProfile({
          display_name: data.display_name ?? "",
          avatar_url: data.avatar_url,
          character_profile: normalizeCharacter(data.character_profile),
        });
      }
      setLoading(false);
    });
  }, [user]);

  const onAvatarPick = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("画像ファイルを選んでください");
    if (file.size > 5 * 1024 * 1024) return toast.error("5MB以下にしてください");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);
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
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name, character_profile: profile.character_profile } as any)
      .eq("id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    emitProfileChange();
    toast.success("プロフィールを保存しました");
  };

  if (loading) return <div className="text-sm text-muted-foreground p-2">読み込み中…</div>;

  return (
    <div className="space-y-6">
      <SectionHeading
        title="アカウント"
        desc="招待コードなどアカウントの情報を管理します"
      />
      <Card className="p-4 text-sm text-muted-foreground">
        表示名・アイコン・キャラクター・自己紹介などのプロフィールは「フレンド」画面の「プロフィール編集」から変更できます。プランは「お支払い」で確認できます。
      </Card>
      <InvitePanel />
    </div>
  );
}

const CHARACTER_OPTIONS = {
  skin: [
    ["#f6c7a5", "ライト"],
    ["#e9a875", "ウォーム"],
    ["#9b6041", "ブラウン"],
    ["#75442f", "ディープ"],
  ],
  hair: [
    ["short", "ショート"],
    ["bob", "ボブ"],
    ["long", "ロング"],
    ["curly", "カール"],
  ],
  hairColor: [
    ["#3b2418", "ブラウン"],
    ["#111827", "ブラック"],
    ["#7c3aed", "パープル"],
    ["#db2777", "ピンク"],
  ],
  eyes: [
    ["round", "まる目"],
    ["calm", "落ち着き"],
    ["star", "キラキラ"],
  ],
  outfit: [
    ["hoodie", "フーディー"],
    ["uniform", "制服"],
    ["jacket", "ジャケット"],
  ],
  outfitColor: [
    ["#6366f1", "インディゴ"],
    ["#0f766e", "ティール"],
    ["#ea580c", "オレンジ"],
    ["#db2777", "ローズ"],
  ],
  accessory: [
    ["none", "なし"],
    ["glasses", "メガネ"],
    ["cap", "キャップ"],
    ["bow", "リボン"],
  ],
  background: [
    ["#e0e7ff", "ミスト"],
    ["#dcfce7", "ミント"],
    ["#fef3c7", "レモン"],
    ["#fce7f3", "ピーチ"],
  ],
} as const;

function CharacterEditor({
  value,
  onChange,
}: {
  value: CharacterConfig;
  onChange: (value: CharacterConfig) => void;
}) {
  const set = (key: keyof CharacterConfig, next: string) => onChange({ ...value, [key]: next });
  const groups = [
    ["肌", "skin"],
    ["髪型", "hair"],
    ["髪色", "hairColor"],
    ["目", "eyes"],
    ["服", "outfit"],
    ["服の色", "outfitColor"],
    ["アクセサリー", "accessory"],
    ["背景", "background"],
  ] as const;

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <div className="font-semibold">キャラクター</div>
        <p className="text-xs text-muted-foreground">
          写真アイコンとは別に表示される、あなたの分身です。あとから何度でも変更できます。
        </p>
      </div>
      <div className="flex items-start gap-4">
        <CharacterAvatar value={value} className="h-28 w-28 shrink-0 rounded-3xl shadow-sm" />
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          {groups.map(([label, key]) => {
            const options = CHARACTER_OPTIONS[key] as readonly (readonly [string, string])[];
            return (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <div className="flex flex-wrap gap-1">
                  {options.map(([option, optionLabel]) => (
                    <button
                      type="button"
                      key={option}
                      onClick={() => set(key, option)}
                      aria-label={`${label}: ${optionLabel}`}
                      className={`rounded-md border px-2 py-1 text-xs transition ${
                        value[key] === option
                          ? "border-primary bg-primary/10 text-primary"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      {["skin", "hairColor", "outfitColor", "background"].includes(key) && (
                        <span
                          className="mr-1 inline-block h-2.5 w-2.5 rounded-full border align-[-1px]"
                          style={{ backgroundColor: option }}
                        />
                      )}
                      {optionLabel}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlanPanel() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<string>("free");
  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .rpc("my_profile_private")
      .then(({ data }: any) => setPlan(data?.current_plan ?? "free"));
  }, [user?.id]);
  return (
    <Card className="p-6 space-y-3">
      <div className="font-semibold">現在のプラン</div>
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold">{plan === "free" ? "無料プラン" : plan}</span>
        <span className="text-xs px-2 py-0.5 rounded bg-muted">{plan.toUpperCase()}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        有料プランは現在準備中です。すべての機能を無料でご利用いただけます。
      </p>
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
      const { count: c } = await (supabase as any)
        .from("user_referrals")
        .select("*", { count: "exact", head: true })
        .eq("referrer_id", user.id);
      setCount(c ?? 0);
    })();
  }, [user?.id]);
  const link = typeof window !== "undefined" ? `${window.location.origin}/r/${code}` : `/r/${code}`;
  return (
    <Card className="p-6 space-y-3">
      <div className="font-semibold">友達を招待 (+10コイン)</div>
      <p className="text-sm text-muted-foreground">
        招待リンクから登録された方とあなたの両方に 10 コインがプレゼントされます。
      </p>
      <div className="flex gap-2">
        <Input value={link} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
        <Button
          onClick={() => {
            navigator.clipboard.writeText(link);
            toast.success("コピーしました");
          }}
        >
          コピー
        </Button>
      </div>
      <div className="text-xs text-muted-foreground">これまでに {count} 人を招待しました</div>
    </Card>
  );
}
