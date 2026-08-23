import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MailCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { MAIL_PROVIDERS, providerForEmail } from "@/lib/mail-providers";

/**
 * 登録直後、メール認証が必要なときに表示する案内。
 * ドメインが分かる場合はそのプロバイダを、分からない場合は主要プロバイダ一覧を出す。
 */
export function EmailVerifyNotice({ email, onBack }: { email: string; onBack: () => void }) {
  const [resending, setResending] = useState(false);
  const matched = providerForEmail(email);
  const providers = matched ? [matched] : MAIL_PROVIDERS;

  const resend = async () => {
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    setResending(false);
    if (error) toast.error(error.message);
    else toast.success("確認メールを再送しました");
  };

  return (
    <Card className="w-full p-8 space-y-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <MailCheck className="h-7 w-7 text-primary" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">メール認証をしてください</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{email}</span> 宛に確認メールを送りました。
          メール内のリンクを開くと登録が完了し、ログインできるようになります。
        </p>
        <p className="text-xs text-muted-foreground">
          メールが見つからないときは、迷惑メールフォルダもご確認ください。
        </p>
      </div>

      <div className="space-y-2 text-left">
        <div className="text-xs font-semibold text-muted-foreground">
          {matched ? "受信トレイを開く" : "ご利用のメールサービスを開く"}
        </div>
        <div className={matched ? "" : "grid grid-cols-2 gap-2"}>
          {providers.map((p) => (
            <Button
              key={p.key}
              asChild
              variant="outline"
              className={matched ? "w-full" : "justify-start text-xs"}
            >
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
                {p.name}を開く
                <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-60" />
              </a>
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button variant="secondary" onClick={resend} disabled={resending}>
          {resending ? "再送しています…" : "確認メールを再送する"}
        </Button>
        <Button variant="ghost" onClick={onBack}>ログイン画面に戻る</Button>
      </div>
    </Card>
  );
}
