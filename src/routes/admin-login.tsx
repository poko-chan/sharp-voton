import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Shield, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-login")({
  head: () => {
    const title = "管理者ログイン｜Study+";
    const description = "Study+ の管理者専用ログインページです。一般利用者のログインは通常のログインページから行ってください。";
    const url = "https://studyplus-voton.lovable.app/admin-login";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { name: "robots", content: "noindex,nofollow" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && isAdmin) navigate({ to: "/admin" });
  }, [user, isAdmin, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Allow login by username OR email
      let email = identifier;
      if (!identifier.includes("@")) {
        const { data } = await supabase
          .from("profiles")
          .select("email")
          .eq("username", identifier)
          .maybeSingle();
        if (!data?.email) throw new Error("ユーザーが見つかりません");
        email = data.email;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("ログイン成功");
    } catch (e: any) {
      toast.error(e.message ?? "ログイン失敗");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">管理者ログイン</h1>
          <p className="text-sm text-muted-foreground">権限を持つユーザーのみアクセス可能</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label>ユーザー名 または メール</Label>
            <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required placeholder="ユーザー名" />
          </div>
          <div className="space-y-1">
            <Label>パスワード</Label>
            <div className="relative">
              <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>ログイン</Button>
        </form>
        <Link to="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">
          ← 通常のログインへ
        </Link>
      </Card>
    </div>
  );
}
