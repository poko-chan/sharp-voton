import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  completeLineLogin,
  createAccountFromLine,
  getLineAuthUrl,
  linkLineToCurrentUser,
  linkLineToExistingAccount,
} from "@/lib/line.functions";

type Pending = {
  token: string;
  lineName: string | null;
  linePicture: string | null;
};

const STATE_KEY = "study-hash.line.state";
const AFTER_KEY = "study-hash.line.after";

function LineLoginPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"loading" | "setup" | "error">("loading");
  const [message, setMessage] = useState("LINEでログインしています…");
  const [pending, setPending] = useState<Pending | null>(null);
  const [mode, setMode] = useState<"choose" | "existing" | "new">("choose");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionUser, setSessionUser] = useState<string | null>(null);
  const started = useRef(false);

  const redirectUri =
    typeof window !== "undefined" ? `${window.location.origin}/line-liff/login` : "";

  const finish = useCallback(
    async (tokenHash: string) => {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (error) {
        setPhase("error");
        setMessage("ログインに失敗しました。もう一度お試しください。");
        return;
      }
      const after = sessionStorage.getItem(AFTER_KEY);
      sessionStorage.removeItem(AFTER_KEY);
      navigate({ to: after === "settings" ? "/settings" : "/dashboard" });
    },
    [navigate],
  );

  useEffect(() => {
    if (started.current || typeof window === "undefined") return;
    started.current = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const oauthError = params.get("error_description") || params.get("error");

      const { data: sess } = await supabase.auth.getSession();
      setSessionUser(sess.session?.user?.id ?? null);

      if (oauthError) {
        setPhase("error");
        setMessage("LINEの認証がキャンセルされました。");
        return;
      }

      if (!code) {
        // Already signed in and arriving from the rich menu: go straight in.
        if (sess.session && params.get("mode") !== "link") {
          navigate({ to: "/dashboard" });
          return;
        }
        if (params.get("mode") === "link") sessionStorage.setItem(AFTER_KEY, "settings");
        const newState = crypto.randomUUID();
        sessionStorage.setItem(STATE_KEY, newState);
        try {
          const { url } = await getLineAuthUrl({ data: { redirectUri, state: newState } });
          window.location.href = url;
        } catch (e) {
          setPhase("error");
          setMessage(e instanceof Error ? e.message : "LINEログインを開始できませんでした。");
        }
        return;
      }

      const saved = sessionStorage.getItem(STATE_KEY);
      if (saved && state && saved !== state) {
        setPhase("error");
        setMessage("セキュリティ確認に失敗しました。最初からやり直してください。");
        return;
      }
      sessionStorage.removeItem(STATE_KEY);

      try {
        const res = await completeLineLogin({ data: { code, redirectUri } });
        if (res.mode === "session") {
          setMessage("ログインしています…");
          await finish(res.tokenHash);
          return;
        }
        setPending({ token: res.token, lineName: res.lineName, linePicture: res.linePicture });
        setDisplayName(res.lineName ?? "");
        setPhase("setup");
      } catch (e) {
        setPhase("error");
        setMessage(e instanceof Error ? e.message : "LINEログインに失敗しました。");
      }
    })();
  }, [finish, navigate, redirectUri]);

  const restart = () => {
    window.location.href = "/line-liff/login";
  };

  const doExisting = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await linkLineToExistingAccount({
        data: { token: pending.token, username, password },
      });
      await finish(res.tokenHash);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "連携に失敗しました");
    }
    setBusy(false);
  };

  const doCreate = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await createAccountFromLine({
        data: { token: pending.token, username, displayName },
      });
      await finish(res.tokenHash);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "アカウントを作成できませんでした");
    }
    setBusy(false);
  };

  const doLinkCurrent = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await linkLineToCurrentUser({ data: { token: pending.token } });
      toast.success("LINEを連携しました");
      navigate({ to: "/settings" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "連携に失敗しました");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 px-4 py-12">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#06C755]/15 text-[#06C755]">
            <MessageCircle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">LINEでログイン</h1>
            <p className="text-sm text-muted-foreground">Study# をLINEアカウントで使えます</p>
          </div>
        </div>

        {phase === "loading" && (
          <Card className="flex items-center justify-center gap-3 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {message}
          </Card>
        )}

        {phase === "error" && (
          <Card className="space-y-4 p-6 text-center">
            <p className="text-sm">{message}</p>
            <Button className="w-full" onClick={restart}>
              もう一度LINEでログイン
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate({ to: "/login" })}>
              通常のログイン画面へ
            </Button>
          </Card>
        )}

        {phase === "setup" && pending && (
          <Card className="space-y-5 p-6">
            <div className="flex items-center gap-3 rounded-xl border p-3">
              {pending.linePicture ? (
                <img src={pending.linePicture} alt="" className="h-10 w-10 rounded-full" />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-full bg-muted">
                  <MessageCircle className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {pending.lineName ?? "LINEユーザー"}
                </div>
                <div className="text-xs text-muted-foreground">まだStudy#と連携されていません</div>
              </div>
            </div>

            {sessionUser && mode === "choose" && (
              <Button className="w-full" disabled={busy} onClick={doLinkCurrent}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                今ログイン中のアカウントに連携する
              </Button>
            )}

            {mode === "choose" && (
              <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={() => setMode("existing")}>
                  すでにStudy#のアカウントがある
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setMode("new")}>
                  新しくアカウントを作る
                </Button>
              </div>
            )}

            {mode === "existing" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>ユーザー名またはメールアドレス</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>パスワード</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <Button className="w-full" disabled={busy} onClick={doExisting}>
                  連携してログイン
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setMode("choose")}>
                  戻る
                </Button>
              </div>
            )}

            {mode === "new" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>ユーザー名（半角英数字）</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="study_taro"
                  />
                </div>
                <div className="space-y-1">
                  <Label>表示名</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <Button className="w-full" disabled={busy} onClick={doCreate}>
                  この内容で始める
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setMode("choose")}>
                  戻る
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/line-liff/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "LINEでログイン｜Study#" },
      {
        name: "description",
        content: "LINE公式アカウントからStudy#にログインし、学習画面へそのまま進めます。",
      },
      { property: "og:title", content: "LINEでログイン｜Study#" },
      { property: "og:description", content: "LINEアカウントでStudy#にログインできます。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LineLoginPage,
});
