// サーバー専用：WebAuthn 検証（クライアントバンドルに含めない）
export async function verifyRegistration(args: {
  response: unknown;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
}) {
  const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
  return verifyRegistrationResponse({ ...args, response: args.response as never });
}

export async function verifyAuthentication(args: {
  response: unknown;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
  credential: { id: string; publicKey: Uint8Array; counter: number; transports?: string[] };
}) {
  const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
  return verifyAuthenticationResponse({
    ...args,
    response: args.response as never,
    credential: args.credential as never,
  });
}

export function b64urlFromBytes(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function bytesFromB64url(str: string) {
  const b = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b + "===".slice((b.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
