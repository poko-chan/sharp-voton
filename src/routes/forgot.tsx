import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";
import { resolveUsernameToEmail } from "@/lib/username.functions";
import { getMaskedEmailByUsername } from "@/lib/account-recovery.functions";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/forgot")({
  head: () => ({
    meta: [
      { title: "アカウントを復旧 | Study+" },
      { name: "description", content: "Study+ のパスワードまたはメールアドレスを忘れた場合の復旧手続き。" },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="" className="h-10 w-10 rounded-xl" />
          <h1 className="text-2xl font-bold">アカウントを復旧</h1>
          <Link to="/login" className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> 戻る
          </Link>
        </div>

        <Tabs defaultValue="password">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="password"><KeyRound className="h-4 w-4 mr-1" />パスワード</TabsTrigger>
            <TabsTrigger value="email"><Mail className="h-4 w-4 mr-1" />メール</TabsTrigger>
          </TabsList>
          <TabsContent value="password"><ForgotPassword /></TabsContent>
          <TabsContent value="email"><ForgotEmail /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ForgotPassword() {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const resolve = useServerFn(resolveUsernameToEmail);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { email } = await resolve({ data: { username: username.trim() } });
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("再設定メールを送信しました");
    } catch (e: any) {
      toast.error(e.message ?? "送信に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 space-y-4 mt-3">
      <p className="text-sm text-muted-foreground">
        ユーザー名を入力すると、登録されているメールアドレス宛にパスワード再設定リンクを送信します。
      </p>
      {sent ? (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-4 text-sm">
          メールを送信しました。受信トレイをご確認ください。届かない場合は迷惑メールフォルダもご確認ください。
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>ユーザー名</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>再設定メールを送信</Button>
        </form>
      )}
    </Card>
  );
}

function ForgotEmail() {
  const [username, setUsername] = useState("");
  const [masked, setMasked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lookup = useServerFn(getMaskedEmailByUsername);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMasked(null);
    try {
      const { masked } = await lookup({ data: { username: username.trim() } });
      setMasked(masked);
    } catch (e: any) {
      toast.error(e.message ?? "見つかりませんでした");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 space-y-4 mt-3">
      <p className="text-sm text-muted-foreground">
        ユーザー名から、登録されているメールアドレスの一部を表示します（プライバシー保護のため一部マスクされます）。
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>ユーザー名</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>メールアドレスを確認</Button>
      </form>
      {masked && (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-4 text-sm">
          登録メールアドレス： <span className="font-mono font-semibold">{masked}</span>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        どうしても思い出せない場合は、ヘルプの問い合わせ窓口からご連絡ください。
      </p>
    </Card>
  );
}