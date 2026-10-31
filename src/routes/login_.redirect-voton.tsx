import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exchangeVotonToken, linkVotonAccount } from "@/lib/voton.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login_/redirect-voton")({
  head: () => ({ meta: [{ title: "Votonでログイン中｜Study#" }] }),
  component: RedirectVotonPage,
});

function RedirectVotonPage() {
  const navigate = useNavigate();
  const exchange = useServerFn(exchangeVotonToken);
  const linkAccount = useServerFn(linkVotonAccount);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const p = new URLSearchParams(window.location.search);
    const code = p.get("code");
    const state = p.get("state");
    window.history.replaceState(null, "", window.location.pathname);

    let saved: { verifier?: string; state?: string; intent?: string } = {};
    try {
      saved = JSON.parse(sessionStorage.getItem("voton_pkce") ?? "{}");
    } catch {
      /* ignore */
    }
    sessionStorage.removeItem("voton_pkce");

    if (p.get("error")) return setErrorMessage("Votonでの認証がキャンセルされました。");
    if (!code || !saved.verifier || !saved.state || state !== saved.state) {
      return setErrorMessage("認証情報が無効または期限切れです。もう一度お試しください。");
    }
    const input = { data: { code, codeVerifier: saved.verifier } };

    void (async () => {
      try {
        if (saved.intent === "link") {
          const r = await linkAccount(input);
          if ("error" in r && r.error) throw new Error(r.error);
          toast.success("Votonアカウントと連携しました");
          navigate({ to: "/settings", replace: true });
          return;
        }
        const r = await exchange(input);
        if ("error" in r && r.error) throw new Error(r.error);
        const { error } = await supabase.auth.verifyOtp({
          token_hash: (r as { tokenHash: string }).tokenHash,
          type: "magiclink",
        });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "ログインに失敗しました。");
      }
    })();
  }, [exchange, linkAccount, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        {errorMessage ? (
          <>
            <p className="font-semibold text-destructive">ログインできませんでした</p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/login", replace: true })}>
              ログイン画面に戻る
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Votonでログインしています…</p>
          </>
        )}
      </div>
    </div>
  );
}
