import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Factor = { id: string; friendly_name?: string; status: string };

export function MfaCard() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(((data?.totp ?? []) as Factor[]).filter((f) => f.status === "verified"));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    setBusy(true);
    // 途中で放棄された未確認の要素を掃除
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of (all?.all ?? []) as Factor[])
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Study# ${new Date().toLocaleDateString("ja-JP")}`,
    });
    setBusy(false);
    if (error || !data) return toast.error(error?.message ?? "開始できませんでした");
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const verify = async () => {
    if (!enroll) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enroll.id,
      code: code.trim(),
    });
    setBusy(false);
    if (error) return toast.error("コードが違います");
    toast.success("二段階認証をオンにしました");
    setEnroll(null);
    setCode("");
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("二段階認証をオフにしますか？")) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (error) return toast.error("オフにするには、先にログイン時の認証コード入力が必要です");
    toast.success("二段階認証をオフにしました");
    await load();
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="h-4 w-4" /> 二段階認証（認証アプリ）
      </div>
      <p className="text-sm text-muted-foreground">
        ログイン時に、Google Authenticator や iPhone のパスワードアプリなどに表示される6桁のコードも求めます。
      </p>
      {factors.length > 0 ? (
        factors.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-xl border p-3">
            <div className="text-sm">
              <div className="font-medium">オン</div>
              <div className="text-xs text-muted-foreground">{f.friendly_name ?? "認証アプリ"}</div>
            </div>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => remove(f.id)}>
              オフにする
            </Button>
          </div>
        ))
      ) : enroll ? (
        <div className="space-y-3">
          <p className="text-sm">認証アプリでこのQRコードを読み取ってください。</p>
          <img src={enroll.qr} alt="二段階認証のQRコード" className="h-44 w-44 rounded-lg bg-card p-2" />
          <p className="break-all text-xs text-muted-foreground">手入力用キー: {enroll.secret}</p>
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="6桁のコード"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <Button disabled={busy || code.length !== 6} onClick={verify}>
              確認してオン
            </Button>
          </div>
        </div>
      ) : (
        <Button disabled={busy} onClick={start}>
          二段階認証を設定する
        </Button>
      )}
    </Card>
  );
}
