import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { checkUsernameAvailable } from "@/lib/username.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { emitProfileChange } from "@/lib/profile-events";

const KINDS: Array<{ id: "child" | "parent"; label: string; desc: string }> = [
  { id: "child", label: "学習者", desc: "勉強記録・演習・タイマーなどを使う" },
  { id: "parent", label: "保護者", desc: "お子さまの学習状況を見守る" },
];

/**
 * Google / Apple などメールとパスワードだけで作成されたアカウント向けの
 * 追加項目入力フォーム。完了するまでアプリ本体は使えない。
 */
export function ProfileSetup({ onDone }: { onDone: () => void }) {
  const { user, refresh } = useAuth();
  const check = useServerFn(checkUsernameAvailable);
  const guess = (user?.user_metadata as any)?.full_name || user?.email?.split("@")[0] || "";
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(guess);
  const [kind, setKind] = useState<"child" | "parent">("child");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const uname = username.trim();
      const dname = displayName.trim() || uname;
      if (!/^[A-Za-z0-9_.\-]{2,32}$/.test(uname)) {
        throw new Error("ユーザー名は2〜32文字の英数字・_.- のみです");
      }
      if (dname.length > 40) throw new Error("表示名は40文字以内で入力してください");
      if (!agreed) throw new Error("利用規約とプライバシーポリシーに同意してください");
      const avail = await check({ data: { username: uname } });
      if (!avail.available) throw new Error("そのユーザー名はすでに使われています");
      const { error } = await supabase
        .from("profiles")
        .update({
          username: uname,
          display_name: dname,
          account_kind: kind,
          onboarded_at: new Date().toISOString(),
        } as any)
        .eq("id", user.id);
      if (error) throw error;
      emitProfileChange();
      await refresh();
      toast.success("登録が完了しました！");
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-background/95 backdrop-blur p-4 flex items-start sm:items-center justify-center">
      <Card className="w-full max-w-lg p-6 sm:p-8 space-y-6 my-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">あと少しで登録完了です</h1>
          <p className="text-sm text-muted-foreground">
            Study# を使うために、いくつかの項目を入力してください。
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1">
            <Label>ユーザー名（半角英数字）</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="study_taro"
              maxLength={32}
              required
            />
            <p className="text-xs text-muted-foreground">ログインやフレンド検索に使います。あとから変更できません。</p>
          </div>

          <div className="space-y-1">
            <Label>表示名</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
          </div>

          <div className="space-y-2">
            <Label>アカウントの種類</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {KINDS.map((k) => (
                <button
                  type="button"
                  key={k.id}
                  onClick={() => setKind(k.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    kind === k.id ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="font-medium text-sm">{k.label}</div>
                  <div className="text-xs text-muted-foreground">{k.desc}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              学校・塾でのご利用は「学校・塾の方へ」ページからお問い合わせください。
            </p>
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
            <span>
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                利用規約
              </a>
              {" と "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                プライバシーポリシー
              </a>
              {" に同意します"}
            </span>
          </label>

          <Button type="submit" className="w-full" disabled={busy || !agreed}>
            {busy ? "保存中…" : "登録を完了する"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default ProfileSetup;
