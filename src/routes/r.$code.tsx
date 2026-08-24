import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/r/$code")({ component: ReferralPage });

function ReferralPage() {
  const { code } = useParams({ from: "/r/$code" });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      try { localStorage.setItem("pending_referral_code", code); } catch {}
      navigate({ to: "/login" });
      return;
    }
    (async () => {
      const { error } = await (supabase as any).rpc("claim_referral", { _code: code });
      if (error) { setStatus("err"); setMsg(error.message); toast.error(error.message); }
      else { setStatus("ok"); toast.success("+10コインを獲得しました！"); try { localStorage.removeItem("pending_referral_code"); } catch {} }
    })();
  }, [user, loading, code]);

  return (
    <div className="container mx-auto p-6 max-w-md">
      <Card className="p-6 text-center space-y-3">
        <h1 className="text-2xl font-bold">招待コード: {code}</h1>
        {status === "idle" && <p>処理中…</p>}
        {status === "ok" && <p className="text-green-600">10コインを受け取りました！</p>}
        {status === "err" && <p className="text-destructive text-sm">{msg}</p>}
        <Button onClick={() => navigate({ to: "/dashboard" })}>ホームへ</Button>
      </Card>
    </div>
  );
}