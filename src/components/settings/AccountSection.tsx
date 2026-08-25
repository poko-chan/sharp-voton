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

export function AccountSection() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState({ display_name: "", avatar_url: "" as string | null });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (supabase as any).rpc("my_profile_private").then(({ data }: any) => {
      if (data) setProfile({ display_name: data.display_name ?? "", avatar_url: data.avatar_url });
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

  if (loading) return <div className="text-sm text-muted-foreground p-2">読み込み中…</div>;

  return (
    <div className="space-y-6">
      <SectionHeading title="アカウント / プロフィール" desc="表示名やアイコン、プランや招待コードを管理します" />
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

      <PlanPanel />
      <InvitePanel />
    </div>
  );
}

function PlanPanel() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<string>("free");
  useEffect(() => {
    if (!user) return;
    (supabase as any).rpc("my_profile_private").then(({ data }: any) => setPlan(data?.current_plan ?? "free"));
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
