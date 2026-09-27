import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loginWithChildCode } from "@/lib/parent.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, QrCode } from "lucide-react";

function QrLoginPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const started = useRef(false);

  const submit = async (value: string) => {
    setPhase("loading");
    try {
      const res: any = await loginWithChildCode({ data: { code: value } });
      const { error } = await supabase.auth.verifyOtp({
        token_hash: res.tokenHash,
        type: "magiclink",
      });
      if (error) throw new Error("ログインに失敗しました");
      navigate({ to: "/dashboard" });
    } catch (e) {
      setPhase("error");
      setMessage(e instanceof Error ? e.message : "ログインに失敗しました");
    }
  };

  useEffect(() => {
    if (started.current || typeof window === "undefined") return;
    started.current = true;
    const c = new URLSearchParams(window.location.search).get("c");
    if (c) submit(c);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 px-4 py-12">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <QrCode className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">カードでログイン</h1>
        </div>

        {phase === "loading" ? (
          <Card className="flex items-center justify-center gap-3 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> ログインしています…
          </Card>
        ) : (
          <Card className="space-y-3 p-6">
            {phase === "error" && <p className="text-sm text-destructive">{message}</p>}
            <p className="text-sm text-muted-foreground">
              ログインカードのQRをカメラで読み取るか、カードの文字を入力してください。
            </p>
            <Input value={code} onChange={(e) => setCode(e.target.value.trim())} placeholder="ログインコード" />
            <Button className="w-full" disabled={code.length < 10} onClick={() => submit(code)}>
              ログイン
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate({ to: "/login" })}>
              通常のログイン画面へ
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/qr-login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "カードでログイン｜Study#" },
      { name: "description", content: "保護者が発行したQRログインカードでStudy#にログインします。" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: QrLoginPage,
});
