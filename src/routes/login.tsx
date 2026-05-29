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
import { resolveUsernameToEmail, checkUsernameAvailable } from "@/lib/username.functions";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/login")({
  head: () => {
    const title = "ログイン｜Study+ — 学習を続けやすくする学習プラットフォーム";
    const description = "Study+ にログインして、勉強記録・集中タイマー・AI問題生成・AI家庭教師・学習目標管理などの学習サポート機能を使い始めましょう。新規登録もこちらから。";
    const url = "https://studyplus-voton.lovable.app/login";
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
  component: LoginPage,
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [announcements, setAnnouncements] = useState<Array<{ id: string; title: string; body: string; tag: string; publish_at: string }>>([]);
  const resolveUsername = useServerFn(resolveUsernameToEmail);
  const checkUsername = useServerFn(checkUsernameAvailable);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username: uname, display_name: dname },
          },
        });
        if (error) throw error;
        toast.success("登録完了！自動ログインします");
      } else {
        const uname = username.trim();
        if (!uname) throw new Error("ユーザー名を入力してください");
        const { email: resolvedEmail } = await resolveUsername({ data: { username: uname } });
        const { error } = await supabase.auth.signInWithPassword({
          email: resolvedEmail,
          password,
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
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Googleログインに失敗しました");
    setBusy(false);
  };
  const apple = async () => {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Appleログインに失敗しました");
    setBusy(false);
  };
  const otherProvider = (name: string) => () => {
    toast.info(`${name}ログインは準備中です`);
  };
  const OTHER_PROVIDERS = [
    { name: "Microsoft", bg: "#00A4EF" },
    { name: "GitHub", bg: "#181717" },
    { name: "Facebook", bg: "#1877F2" },
    { name: "LINE", bg: "#06C755" },
    { name: "Yahoo", bg: "#6001D2" },
    { name: "X", bg: "#000000" },
    { name: "Amazon", bg: "#FF9900" },
  ];

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
                  <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(a.publish_at).toLocaleDateString("ja-JP")}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
        <Card className="w-full p-8 space-y-6">
        <div className="text-center space-y-2">
          <img
            src={logoUrl}
            alt="Study+ ロゴ"
            width={64}
            height={64}
            decoding="async"
            // @ts-expect-error fetchpriority is a valid HTML attribute
            fetchpriority="high"
            className="mx-auto h-16 w-16 rounded-2xl shadow-md"
          />
          <h1 className="text-3xl font-bold">Study+</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin" ? "ログイン" : "新規登録"}してはじめましょう
          </p>
        </div>

        <Button onClick={google} variant="outline" className="w-full" disabled={busy}>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.5 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Googleで{mode === "signin" ? "ログイン" : "登録"}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={apple} variant="outline" disabled={busy}>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 12.04c-.03-2.6 2.13-3.86 2.23-3.92-1.21-1.77-3.1-2.02-3.77-2.05-1.6-.16-3.13.94-3.94.94-.83 0-2.07-.92-3.41-.9-1.75.03-3.37 1.02-4.27 2.59-1.82 3.16-.46 7.83 1.31 10.39.86 1.26 1.88 2.66 3.22 2.61 1.3-.05 1.79-.84 3.36-.84s2.01.84 3.39.81c1.4-.02 2.28-1.27 3.14-2.53.99-1.45 1.39-2.86 1.41-2.93-.03-.01-2.7-1.04-2.73-4.12zM14.62 4.39c.71-.87 1.2-2.06 1.07-3.27-1.03.04-2.29.69-3.03 1.55-.66.77-1.25 2-1.09 3.16 1.16.09 2.34-.59 3.05-1.44z"/></svg>
            Apple
          </Button>
          <Button onClick={() => setShowOther((v) => !v)} variant="outline" disabled={busy}>
            {showOther ? "閉じる" : "その他"}
          </Button>
        </div>
        {showOther && (
          <div className="grid grid-cols-3 gap-2">
            {OTHER_PROVIDERS.map((p) => (
              <Button
                key={p.name}
                onClick={otherProvider(p.name)}
                variant="outline"
                size="sm"
                disabled={busy}
                className="text-xs"
              >
                <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ background: p.bg }} />
                {p.name}
              </Button>
            ))}
          </div>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
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
              placeholder="ユーザー名"
              autoComplete="username"
            />
          </div>
          {mode === "signup" && (
            <>
              <div className="space-y-1">
                <Label>表示名 <span className="text-xs text-muted-foreground">(任意・空欄ならユーザー名と同じ)</span></Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} placeholder="表示名" />
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
              <Input type={showPassword ? "text" : "password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} className="pr-10" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {mode === "signup" && (
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
              <span>
                <Link to="/terms" className="text-primary hover:underline">利用規約</Link>
                {" と "}
                <Link to="/privacy" className="text-primary hover:underline">プライバシーポリシー</Link>
                {" に同意します"}
              </span>
            </label>
          )}
          <Button type="submit" className="w-full" disabled={busy || (mode === "signup" && !agreed)}>
            {mode === "signin" ? "ログイン" : "登録する"}
          </Button>
        </form>

        <div className="text-center text-sm">
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-primary hover:underline">
            {mode === "signin" ? "アカウントを作成する" : "ログインに戻る"}
          </button>
        </div>

        <div className="text-center text-[11px] text-muted-foreground space-x-3">
          <Link to="/privacy" className="hover:underline">プライバシー</Link>
          <Link to="/terms" className="hover:underline">利用規約</Link>
        </div>
      </Card>
      </div>

      <Link to="/admin-login" className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-md border bg-background/80 backdrop-blur px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition">
        <Shield className="h-3.5 w-3.5" /> 管理
      </Link>
    </div>
  );
}
