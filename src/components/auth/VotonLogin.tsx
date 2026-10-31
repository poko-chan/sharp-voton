import { Button } from "@/components/ui/button";

const VOTON_URL = "https://voton.app";
const REDIRECT_URI = "https://sharp.voton.app/login/redirect-voton";

const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export async function startVotonAuth(intent: "login" | "link" = "login") {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const state = crypto.randomUUID();
  sessionStorage.setItem("voton_pkce", JSON.stringify({ verifier, state, intent }));
  const challenge = b64url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  const params = new URLSearchParams({
    response_type: "code",
    client_id: "study-sharp",
    redirect_uri: REDIRECT_URI,
    scope: "profile email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
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
      onClick={() => void startVotonAuth("login")}
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
