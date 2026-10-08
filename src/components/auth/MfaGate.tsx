import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

/** 二段階認証が有効なのに未確認（aal1）のセッションなら、コード入力を求める全画面ゲート。 */
export function MfaGate() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (data?.nextLevel === "aal2" && data.currentLevel !== "aal2") {
        const { data: f } = await supabase.auth.mfa.listFactors();
        setFactorId(f?.totp?.[0]?.id ?? null);
      } else setFactorId(null);
    };
    void check();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT" || e === "MFA_CHALLENGE_VERIFIED") void check();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!factorId || typeof document === "undefined") return null;

  const verify = async () => {
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (error) return toast.error("コードが違います");
    setFactorId(null);
    window.location.reload();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-lg">
        <div className="flex items-center gap-2 text-lg font-bold">
          <ShieldCheck className="h-5 w-5 text-primary" /> 二段階認証
        </div>
        <p className="text-sm text-muted-foreground">認証アプリに表示されている6桁のコードを入力してください。</p>
        <Input
          autoFocus
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && code.length === 6 && verify()}
        />
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy || code.length !== 6} onClick={verify}>
            確認
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
          >
            ログアウト
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
