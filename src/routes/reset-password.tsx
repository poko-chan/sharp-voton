import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "新しいパスワードを設定 | Study#" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase appends type=recovery in the URL hash after the link is clicked.
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setReady(true);
    } else {
      // Also accept active recovery session
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setReady(true);
      });
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("6文字以上で入力してください");
    if (password !== confirm) return toast.error("確認用パスワードが一致しません");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("パスワードを更新しました");
      await supabase.auth.signOut();
      navigate({ to: "/login" });
    } catch (e: any) {
      toast.error(e.message ?? "更新に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md p-8 space-y-5">
        <div className="text-center space-y-2">
          <img src={logoUrl} alt="" className="mx-auto h-14 w-14 rounded-xl" />
          <h1 className="text-2xl font-bold">新しいパスワードを設定</h1>
        </div>
        {!ready ? (
          <p className="text-sm text-muted-foreground text-center">
            メールに記載されたリンクからアクセスしてください。
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>新しいパスワード</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>
            <div>
              <Label>確認用パスワード</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>更新する</Button>
          </form>
        )}
      </Card>
    </div>
  );
}