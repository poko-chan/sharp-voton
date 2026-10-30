import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { exchangeVotonToken, linkVotonAccount } from "@/lib/voton.functions";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/login_/redirect-voton")({
  head: () => ({ meta: [{ title: "Voton認証中｜Study#" }] }),
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

    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const state = params.get("state");
    const authError = params.get("error");
    window.history.replaceState(null, "", window.location.pathname);

    const savedState = sessionStorage.getItem("voton_state");
    const intent = sessionStorage.getItem("voton_intent") ?? "login";
    sessionStorage.removeItem("voton_state");
    sessionStorage.removeItem("voton_intent");

    if (authError) {
      setErrorMessage("Votonでの認証がキャンセルされました。");
      return;
    }
    if (!savedState || state !== savedState || !accessToken) {
      setErrorMessage("認証情報が無効または期限切れです。もう一度お試しください。");
      return;
    }

    void (async () => {
      try {
        if (intent === "link") {
          const result = await linkAccount({ data: { accessToken } });
          if ("error" in result && result.error) throw new Error(result.error);
          toast.success("Votonアカウントと連携しました");
          navigate({ to: "/settings", replace: true });
          return;
        }

        const result = await exchange({ data: { accessToken } });
        if ("error" in result && result.error) throw new Error(result.error);
        const { error } = await supabase.auth.verifyOtp({
          token_hash: result.tokenHash,
          type: "magiclink",
        });
        if (error) throw error;
        toast.success("ログインしました");
        navigate({ to: "/dashboard", replace: true });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "ログイン処理に失敗しました。");
      }
    })();
  }, [exchange, linkAccount, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0d12] p-4 text-white">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-[#00F5A0] via-[#00D2FF] to-[#0062FF] opacity-70 blur-md" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-[#0b0d12]">
            <span className="bg-gradient-to-r from-[#00F5A0] via-[#00D2FF] to-[#0062FF] bg-clip-text text-2xl font-black text-transparent">
              V
            </span>
          </div>
        </div>
        {errorMessage ? (
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 font-semibold text-rose-400">
              <AlertCircle className="h-5 w-5" /> 認証エラー
            </div>
            <p className="text-sm text-white/70">{errorMessage}</p>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/login", replace: true })}
              className="w-full border-white/20 text-white hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> ログイン画面に戻る
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className="text-lg font-bold">Votonアカウントを認証中…</h2>
            <p className="text-xs text-white/60">安全にStudy#へ接続しています。少々お待ちください。</p>
          </div>
        )}
      </div>
    </div>
  );
}
