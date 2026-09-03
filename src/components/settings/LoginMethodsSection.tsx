import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Link2, Unlink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SectionHeading } from "./shared";
import googleLogo from "@/assets/google-logo.svg.asset.json";

type Identity = { identity_id: string; id: string; provider: string; identity_data?: any };

const PROVIDERS: Array<{ id: "google" | "apple"; label: string }> = [
  { id: "google", label: "Google" },
  { id: "apple", label: "Apple" },
];

export function LoginMethodsSection() {
  const { user } = useAuth();
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (!error) setIdentities(((data?.identities ?? []) as any[]) as Identity[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const linked = (p: string) => identities.some((i) => i.provider === p);
  const hasPassword = linked("email");

  const link = async (provider: "google" | "apple") => {
    setBusy(provider);
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/settings` },
    });
    if (error) {
      // 手動リンクが無効な環境では、同じメールアドレスでのサインインによる
      // 自動リンクにフォールバックする。
      const msg = String(error.message ?? "");
      if (/manual linking/i.test(msg)) {
        const r = await lovable.auth.signInWithOAuth(provider, {
          redirect_uri: `${window.location.origin}/settings`,
        });
        if ((r as any)?.error) toast.error((r as any).error.message ?? "連携に失敗しました");
        else await load();
      } else {
        toast.error(msg || "連携に失敗しました");
      }
    }
    setBusy(null);
  };

  const unlink = async (provider: string) => {
    const target = identities.find((i) => i.provider === provider);
    if (!target) return;
    if (identities.length <= 1) {
      toast.error("ログイン方法が1つしかないため解除できません");
      return;
    }
    setBusy(provider);
    const { error } = await supabase.auth.unlinkIdentity(target as any);
    if (error) toast.error(error.message ?? "解除に失敗しました");
    else {
      toast.success(`${provider} の連携を解除しました`);
      await load();
    }
    setBusy(null);
  };

  const savePassword = async () => {
    if (pw.length < 6) return toast.error("パスワードは6文字以上にしてください");
    if (pw !== pw2) return toast.error("確認用パスワードが一致しません");
    setBusy("password");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) toast.error(error.message);
    else {
      toast.success(hasPassword ? "パスワードを変更しました" : "パスワードを設定しました");
      setPw("");
      setPw2("");
      await load();
    }
    setBusy(null);
  };

  if (loading) return <div className="text-sm text-muted-foreground p-2">読み込み中…</div>;

  return (
    <div className="space-y-6">
      <SectionHeading title="ログイン方法" desc="パスワード・Google・Apple の連携を管理します" />

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4" /> 連携中のログイン方法
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">メールアドレス + パスワード</div>
                <div className="text-xs text-muted-foreground">
                  {hasPassword ? "設定済み" : "未設定（下のフォームから設定できます）"}
                </div>
              </div>
            </div>
          </div>

          {PROVIDERS.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-3">
                {p.id === "google" ? (
                  <img src={googleLogo.url} alt="" width={20} height={20} className="h-5 w-5" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M17.05 12.04c-.03-2.6 2.13-3.86 2.23-3.92-1.21-1.77-3.1-2.02-3.77-2.05-1.6-.16-3.13.94-3.94.94-.83 0-2.07-.92-3.41-.9-1.75.03-3.37 1.02-4.27 2.59-1.82 3.16-.46 7.83 1.31 10.39.86 1.26 1.88 2.66 3.22 2.61 1.3-.05 1.79-.84 3.36-.84s2.01.84 3.39.81c1.4-.02 2.28-1.27 3.14-2.53.99-1.45 1.39-2.86 1.41-2.93-.03-.01-2.7-1.04-2.73-4.12zM14.62 4.39c.71-.87 1.2-2.06 1.07-3.27-1.03.04-2.29.69-3.03 1.55-.66.77-1.25 2-1.09 3.16 1.16.09 2.34-.59 3.05-1.44z" />
                  </svg>
                )}
                <div>
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-xs text-muted-foreground">{linked(p.id) ? "連携済み" : "未連携"}</div>
                </div>
              </div>
              {linked(p.id) ? (
                <Button variant="outline" size="sm" disabled={busy === p.id} onClick={() => unlink(p.id)}>
                  <Unlink className="mr-2 h-4 w-4" /> 解除
                </Button>
              ) : (
                <Button size="sm" disabled={busy === p.id} onClick={() => link(p.id)}>
                  <Link2 className="mr-2 h-4 w-4" /> 連携する
                </Button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          安全のため、ログイン方法を最低 1 つは残す必要があります。
        </p>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 font-semibold">
          <KeyRound className="h-4 w-4" /> パスワードの{hasPassword ? "変更" : "設定"}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>新しいパスワード</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-1">
            <Label>確認のため再入力</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        <Button onClick={savePassword} disabled={busy === "password"}>
          {hasPassword ? "パスワードを変更" : "パスワードを設定"}
        </Button>
      </Card>
    </div>
  );
}

export default LoginMethodsSection;
