import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Shield, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { signInWithUsername, checkUsernameAvailable } from "@/lib/username.functions";
import { EmailVerifyNotice } from "@/components/auth/EmailVerifyNotice";
import { GoogleTranslateWidget } from "@/components/GoogleTranslateWidget";
import logoUrl from "@/assets/logo.png";
import googleLogo from "@/assets/google-logo.svg.asset.json";

export const Route = createFileRoute("/login")({
  head: () => {
    const title = "ログイン｜StudyΩ — 学習を続けやすくする学習プラットフォーム";
    const description =
      "StudyΩ にログインして、勉強記録・集中タイマー・AI問題生成・AIチャット・学習目標管理などの学習サポート機能を使い始めましょう。新規登録もこちらから。";
    const url = "https://omega-voton.lovable.app/login";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: () => (
      <LoginPage />
  ),
});

function LoginPage() {
  const { user, loading, accountKind: myKind } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [accountKind, setAccountKind] = useState<"child" | "parent" | "org">("child");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<
    Array<{ id: string; title: string; body: string; tag: string; publish_at: string }>
  >([]);
  const signInByUsername = useServerFn(signInWithUsername);
  const checkUsername = useServerFn(checkUsernameAvailable);

  // /login?kind=org&next=/for-schools のような遷移に対応する。
  const [nextPath, setNextPath] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const kind = q.get("kind");
    if (kind === "org" || kind === "parent" || kind === "child") {
      setAccountKind(kind as any);
      if (kind !== "child") setMode("signup");
    }
    const nx = q.get("next");
    if (nx && nx.startsWith("/")) setNextPath(nx);
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    if (nextPath) navigate({ to: nextPath as any });
    else if (myKind === "org") navigate({ to: "/organizations" });
    else if (myKind) navigate({ to: "/dashboard" });
  }, [user, loading, navigate, nextPath, myKind]);

  useEffect(() => {
    supabase
      .from("announcements")
      .select("id, title, body, tag, publish_at")
      .eq("show_on_login" as any, true)
      .lte("publish_at", new Date().toISOString())
      .order("publish_at", { ascending: false })
      .limit(3)
      .then(({ data }) => setAnnouncements((data ?? []) as any));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!agreed) throw new Error("利用規約とプライバシーポリシーに同意してください");
        const uname = username.trim();
        const dname = displayName.trim() || uname;
        if (!uname) throw new Error("ユーザー名を入力してください");
        if (!/^[A-Za-z0-9_.\-]{2,32}$/.test(uname)) {
          throw new Error("ユーザー名は2〜32文字の英数字・_.- のみ");
        }
        if (dname.length > 40) throw new Error("表示名は40文字以内で入力してください");
        const avail = await checkUsername({ data: { username: uname } });
        if (!avail.available) throw new Error("そのユーザー名はすでに使われています");
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
            data: { username: uname, display_name: dname, account_kind: accountKind },
          },
        });
        if (error) throw error;
        if (!signUpData.session) {
          // メール認証が必要。案内画面へ切り替える。
          setPendingEmail(email);
          return;
        }
        // update kind (trigger may not honor metadata)
        await supabase
          .from("profiles")
          .update({ account_kind: accountKind } as any)
          .eq("id", signUpData.session.user.id);
        toast.success("登録完了！自動ログインします");
      } else {
        const uname = username.trim();
        if (!uname) throw new Error("ユーザー名を入力してください");
        const tokens = await signInByUsername({ data: { username: uname, password } });
        const { error } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        });
        if (error) throw error;
      }
    } catch (e: any) {
      toast.error(e.message ?? "エラーが発生しました");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/login` });
    if (r.error) toast.error("Googleログインに失敗しました");
    setBusy(false);
  };
  const apple = async () => {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("apple", { redirect_uri: `${window.location.origin}/login` });
    if (r.error) toast.error("Appleログインに失敗しました");
    setBusy(false);
  };
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="w-full max-w-md space-y-4">
        {announcements.length > 0 && (
          <Card className="p-4 space-y-2 border-primary/30">
            <div className="text-xs font-semibold text-primary">📣 お知らせ</div>
            <div className="space-y-2 max-h-48 overflow-auto">
              {announcements.map((a) => (
                <div key={a.id} className="text-sm border-l-2 border-primary/40 pl-3">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{a.body}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(a.publish_at).toLocaleDateString("ja-JP")}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        {pendingEmail ? (
          <EmailVerifyNotice
            email={pendingEmail}
            onBack={() => {
              setPendingEmail(null);
              setMode("signin");
            }}
          />
        ) : (
          <Card className="w-full p-8 space-y-6">
            <div className="text-center space-y-2">
              <img
                src={logoUrl}
                alt="StudyΩ ロゴ"
                width={64}
                height={64}
                decoding="async"
                fetchPriority="high"
                className="mx-auto h-16 w-16 rounded-2xl shadow-md"
              />
              <h1 className="text-3xl font-bold">StudyΩ</h1>
              <p className="text-sm text-muted-foreground">
                {mode === "signin" ? "ログイン" : "新規登録"}してはじめましょう
              </p>
            </div>

            <Button onClick={google} variant="outline" className="w-full" disabled={busy}>
              <img src={googleLogo.url} alt="" width={18} height={18} className="mr-2 h-[18px] w-[18px]" />
              Googleで{mode === "signin" ? "ログイン" : "登録"}
            </Button>
            <div className="grid gap-2">
              <Button onClick={apple} variant="outline" disabled={busy}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 12.04c-.03-2.6 2.13-3.86 2.23-3.92-1.21-1.77-3.1-2.02-3.77-2.05-1.6-.16-3.13.94-3.94.94-.83 0-2.07-.92-3.41-.9-1.75.03-3.37 1.02-4.27 2.59-1.82 3.16-.46 7.83 1.31 10.39.86 1.26 1.88 2.66 3.22 2.61 1.3-.05 1.79-.84 3.36-.84s2.01.84 3.39.81c1.4-.02 2.28-1.27 3.14-2.53.99-1.45 1.39-2.86 1.41-2.93-.03-.01-2.7-1.04-2.73-4.12zM14.62 4.39c.71-.87 1.2-2.06 1.07-3.27-1.03.04-2.29.69-3.03 1.55-.66.77-1.25 2-1.09 3.16 1.16.09 2.34-.59 3.05-1.44z" />
                </svg>
                Apple
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">または</span>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1">
                <Label>ユーザー名</Label>
                <Input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="omega-voton"
                  autoComplete="username"
                />
              </div>
              {mode === "signup" && (
                <>
                  <div className="space-y-1">
                    <Label>アカウント種別</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setAccountKind("child")}
                        className={`rounded-md border p-2 text-xs sm:text-sm ${accountKind === "child" ? "border-primary bg-primary/10 font-semibold" : ""}`}
                      >
                        通常アカウント
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountKind("parent")}
                        className={`rounded-md border p-2 text-xs sm:text-sm ${accountKind === "parent" ? "border-primary bg-primary/10 font-semibold" : ""}`}
                      >
                        保護者アカウント
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountKind("org")}
                        className={`rounded-md border p-2 text-xs sm:text-sm ${accountKind === "org" ? "border-primary bg-primary/10 font-semibold" : ""}`}
                      >
                        組織アカウント
                      </button>
                    </div>
                    {accountKind === "parent" && (
                      <p className="text-[11px] text-muted-foreground">
                        保護者アカウントは登録後「保護者ダッシュボード」から子供アカウントとリンクできます。
                      </p>
                    )}
                    {accountKind === "org" && (
                      <p className="text-[11px] text-muted-foreground">
                        組織アカウントは学校・塾などの管理用です。学習機能は使えず、組織の管理・導入申請に必要な機能のみ利用できます。
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>
                      表示名 <span className="text-xs text-muted-foreground">任意</span>
                    </Label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={40}
                      placeholder="オメガ君"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>メールアドレス</Label>
                    <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </>
              )}
              <div className="space-y-1">
                <Label>パスワード</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {mode === "signup" && (
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      利用規約
                    </a>
                    {" と "}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      プライバシーポリシー
                    </a>
                    {" に同意します"}
                  </span>
                </label>
              )}
              <Button type="submit" className="w-full" disabled={busy || (mode === "signup" && !agreed)}>
                {mode === "signin" ? "ログイン" : "登録する"}
              </Button>
            </form>

            <div className="text-center text-sm">
              <button
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="text-primary hover:underline"
              >
                {mode === "signin" ? "アカウントを作成する" : "ログインに戻る"}
              </button>
            </div>

            {mode === "signin" && (
              <div className="text-center text-xs">
                <Link to="/forgot" className="text-muted-foreground hover:text-primary hover:underline">
                  パスワード／メールアドレスを忘れた場合
                </Link>
              </div>
            )}

            <div className="text-center text-[11px] text-muted-foreground space-x-3">
              <Link to="/privacy" className="hover:underline">
                プライバシー
              </Link>
              <Link to="/terms" className="hover:underline">
                利用規約
              </Link>
            </div>
          </Card>
        )}
      </div>

      <div className="absolute top-4 right-4">
        <GoogleTranslateWidget />
      </div>
      <Link
        to="/admin-login"
        className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-md border bg-background/80 backdrop-blur px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition"
      >
        <Shield className="h-3.5 w-3.5" /> 管理
      </Link>
      <Link
        to="/help"
        className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-md border bg-background/80 backdrop-blur px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition"
      >
        <span aria-hidden>❓</span> ヘルプ
      </Link>
    </div>
  );
}
