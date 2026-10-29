<<<<<<< HEAD
<<<<<<< HEAD
import { Button } from "@/components/ui/button";

const VOTON_URL = "https://voton.app";
const REDIRECT_URI = "https://sharp.voton.app/login/redirect-voton";

export function startVotonAuth(intent: "login" | "link" = "login") {
  const state = crypto.randomUUID();
  sessionStorage.setItem("voton_state", state);
  sessionStorage.setItem("voton_intent", intent);

  const params = new URLSearchParams({
=======
=======
>>>>>>> b23be19da64131c89d3a8a56ef1fa3a06ad7b83b
import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { exchangeVotonToken } from "@/lib/voton.functions";

const VOTON = "https://voton.app";
const REDIRECT_URI = "https://sharp.voton.app";

export function startVotonLogin() {
  const state = crypto.randomUUID();
  sessionStorage.setItem("voton_state", state);
  const q = new URLSearchParams({
<<<<<<< HEAD
>>>>>>> b23be19da64131c89d3a8a56ef1fa3a06ad7b83b
=======
>>>>>>> b23be19da64131c89d3a8a56ef1fa3a06ad7b83b
    client_id: "study-sharp",
    redirect_uri: REDIRECT_URI,
    scope: "profile email",
    state,
  });
<<<<<<< HEAD
<<<<<<< HEAD
  window.location.assign(`${VOTON_URL}/oauth/authorize?${params.toString()}`);
}

export function VotonLoginButton({
  label = "Voton アカウントでログイン",
  disabled = false,
}: {
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={() => startVotonAuth("login")}
      disabled={disabled}
      className="w-full rounded-xl py-3 font-bold text-[#0b0d12] shadow-md transition-all hover:opacity-90"
      style={{ background: "linear-gradient(90deg, #00F5A0, #00D2FF, #0062FF)" }}
    >
      <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0b0d12] text-[11px] font-black text-[#00F5A0]">
        V
      </span>
      {label}
    </Button>
  );
}
=======
=======
>>>>>>> b23be19da64131c89d3a8a56ef1fa3a06ad7b83b
  location.href = `${VOTON}/oauth/authorize?${q}`;
}

export function VotonLoginButton({ label = "Voton アカウントでログイン", disabled }: { label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={startVotonLogin}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 font-semibold text-[#0b0d12] shadow-md transition hover:opacity-90 disabled:opacity-50"
      style={{ background: "linear-gradient(90deg,#00F5A0,#00D2FF,#0062FF)" }}
    >
      <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0b0d12] text-[11px] font-black text-[#00F5A0]">V</span>
      {label}
    </button>
  );
}

/** 戻り先（#access_token=...）を受け取りログインを完了させる。ルートに常設。 */
export function VotonCallbackHandler() {
  const exchange = useServerFn(exchangeVotonToken);
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    const hash = location.hash.slice(1);
    if (!hash.includes("voton_user_id") && !hash.includes("access_token")) return;
    const p = new URLSearchParams(hash);
    if (!p.get("access_token") && !p.get("error")) return;
    // Lovable Cloud 自体のハッシュ(type=recovery 等)は対象外
    if (p.get("type")) return;
    done.current = true;
    history.replaceState(null, "", location.pathname + location.search);

    if (p.get("error")) {
      toast.message("Votonでのログインをキャンセルしました");
      return;
    }
    const saved = sessionStorage.getItem("voton_state");
    sessionStorage.removeItem("voton_state");
    if (!saved || p.get("state") !== saved) {
      toast.error("ログイン情報が一致しません。もう一度お試しください");
      return;
    }
    const accessToken = p.get("access_token")!;
    const t = toast.loading("Votonアカウントでログイン中…");
    (async () => {
      try {
        const r = await exchange({ data: { accessToken } });
        if ("error" in r) throw new Error(r.error);
        const { error } = await supabase.auth.verifyOtp({ token_hash: r.tokenHash, type: "magiclink" });
        if (error) throw error;
        toast.success("ログインしました", { id: t });
        navigate({ to: "/dashboard", replace: true });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "ログインに失敗しました", { id: t });
      }
    })();
  }, [exchange, navigate]);

  return null;
}
<<<<<<< HEAD
>>>>>>> b23be19da64131c89d3a8a56ef1fa3a06ad7b83b
=======
>>>>>>> b23be19da64131c89d3a8a56ef1fa3a06ad7b83b
