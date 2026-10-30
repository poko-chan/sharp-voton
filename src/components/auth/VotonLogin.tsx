import { Button } from "@/components/ui/button";

const VOTON_URL = "https://voton.app";
const REDIRECT_URI = "https://sharp.voton.app/login/redirect-voton";

export function startVotonAuth(intent: "login" | "link" = "login") {
  const state = crypto.randomUUID();
  sessionStorage.setItem("voton_state", state);
  sessionStorage.setItem("voton_intent", intent);

  const params = new URLSearchParams({
    client_id: "study-sharp",
    redirect_uri: REDIRECT_URI,
    scope: "profile email",
    state,
  });
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
