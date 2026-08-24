import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COUNTRIES,
  EMPTY_DRAFT,
  ORG_TYPES,
  PREFECTURES,
  departmentLabel,
  orgNameLabel,
  type OrgApplicationDraft,
  type OrgType,
} from "@/lib/org-application";
import { Check, ChevronLeft, ChevronRight, CircleCheck, LogIn } from "lucide-react";
import { toast } from "sonner";

const STEPS = ["種別", "ログイン", "要項入力", "内容確認"];

/** 「学校・塾の方へ」ページに置く導入申請フォーム（4ステップ）。 */
export function OrgApplyForm() {
  const { user, loading, accountKind } = useAuth();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OrgApplicationDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [existingPending, setExistingPending] = useState(false);

  const set = <K extends keyof OrgApplicationDraft>(k: K, v: OrgApplicationDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  // ログイン済みなら会員情報のメールを初期値に入れる（変更可能）。
  useEffect(() => {
    if (!user) return;
    setDraft((d) => (d.contact_email ? d : { ...d, contact_email: user.email ?? "" }));
    (supabase as any)
      .from("organization_applications")
      .select("id")
      .eq("applicant_id", user.id)
      .eq("status", "pending")
      .limit(1)
      .then(({ data }: any) => setExistingPending((data ?? []).length > 0));
  }, [user?.id]);

  const isJapan = draft.country === "日本";

  const canNext = () => {
    if (step === 0) return !!draft.org_type && (draft.org_type !== "other" || draft.org_type_other.trim().length > 0);
    if (step === 1) return !!user;
    if (step === 2)
      return (
        draft.org_name.trim().length > 0 &&
        draft.rep_last_name.trim().length > 0 &&
        draft.rep_first_name.trim().length > 0 &&
        /.+@.+\..+/.test(draft.contact_email.trim()) &&
        draft.contact_phone.trim().length > 0 &&
        draft.country.trim().length > 0 &&
        (!isJapan || draft.prefecture.trim().length > 0) &&
        draft.address.trim().length > 0
      );
    return true;
  };

  const submit = async () => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("org_application_submit", {
      _payload: {
        ...draft,
        expected_users: draft.expected_users.trim() === "" ? null : draft.expected_users.trim(),
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setDone(true);
    toast.success("導入申請を送信しました");
  };

  if (done) {
    return (
      <div className="surface p-8 text-center">
        <CircleCheck className="mx-auto h-10 w-10 text-primary" />
        <h3 className="mt-3 font-display text-xl font-black">申請を受け付けました</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          運営が内容を確認します。ログイン後の「組織」ページに申請が表示され、運営とのやり取りができます。
          <br />
          承認されると組織の機能が使えるようになります。
        </p>
        <Link to="/organizations" className="cta mt-6">
          組織ページを開く
        </Link>
      </div>
    );
  }

  return (
    <div className="surface p-6 sm:p-8">
      <ol className="mb-6 flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full font-bold ${
                i < step ? "bg-primary/20 text-primary" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={i === step ? "font-bold" : "text-muted-foreground"}>{s}</span>
            {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-3">
          <h3 className="font-bold">1. 種別を選択</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {ORG_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => set("org_type", t.value as OrgType)}
                className={`rounded-xl border p-3 text-left transition ${
                  draft.org_type === t.value ? "border-primary bg-primary/10" : "border-border/60 hover:bg-muted/50"
                }`}
              >
                <div className="text-sm font-bold">{t.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t.hint}</div>
              </button>
            ))}
          </div>
          {draft.org_type === "other" && (
            <div className="space-y-1">
              <Label>種別の内容</Label>
              <Input
                value={draft.org_type_other}
                maxLength={60}
                placeholder="例: 教育委員会"
                onChange={(e) => set("org_type_other", e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="font-bold">2. StudyΩ アカウントでログイン</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">確認中...</p>
          ) : user ? (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">
              <div className="font-bold text-primary">ログイン済み</div>
              <div className="mt-1 text-muted-foreground">{user.email}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                種別: {accountKind === "org" ? "組織アカウント" : accountKind === "parent" ? "保護者アカウント" : "通常アカウント"}
              </div>
              {accountKind === "parent" && (
                <p className="mt-2 text-xs text-destructive">
                  保護者アカウントでは申請できません。通常アカウントまたは組織アカウントでログインしてください。
                </p>
              )}
              {existingPending && (
                <p className="mt-2 text-xs text-amber-600">
                  すでに審査中の申請があります。結果が出るまで新しい申請は送信できません。
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                申請には StudyΩ アカウントが必要です。通常アカウント（学習用）でも、組織の管理だけに使う
                「StudyΩ 組織アカウント」でも申請できます。
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link to="/login" search={{ next: "/for-schools" } as any} className="cta">
                  <LogIn className="mr-1 inline h-4 w-4" />
                  ログイン
                </Link>
                <Link to="/login" search={{ kind: "org", next: "/for-schools" } as any} className="cta-ghost">
                  組織アカウントを作成
                </Link>
              </div>
              <p className="text-xs">
                組織アカウントはメールアドレス（メール認証）・パスワード・ユーザー名で作成でき、組織の管理に必要な機能のみ利用できます。
              </p>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="font-bold">3. 要項入力</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="代表者名（姓）" required value={draft.rep_last_name} onChange={(v) => set("rep_last_name", v)} placeholder="山田" />
            <Field label="代表者名（名）" required value={draft.rep_first_name} onChange={(v) => set("rep_first_name", v)} placeholder="太郎" />
            <Field label="セイ" value={draft.rep_last_kana} onChange={(v) => set("rep_last_kana", v)} placeholder="ヤマダ" />
            <Field label="メイ" value={draft.rep_first_kana} onChange={(v) => set("rep_first_kana", v)} placeholder="タロウ" />
            <Field label={departmentLabel(draft.org_type)} value={draft.department} onChange={(v) => set("department", v)} />
            <Field label={orgNameLabel(draft.org_type)} required value={draft.org_name} onChange={(v) => set("org_name", v)} />
            <Field
              label="ご連絡メールアドレス"
              required
              type="email"
              value={draft.contact_email}
              onChange={(v) => set("contact_email", v)}
            />
            <Field label="ご連絡電話番号" required value={draft.contact_phone} onChange={(v) => set("contact_phone", v)} placeholder="03-0000-0000" />
            <div className="space-y-1">
              <Label>
                所在国 <span className="text-destructive">*</span>
              </Label>
              <Select value={draft.country} onValueChange={(v) => { set("country", v); if (v !== "日本") set("prefecture", ""); }}>
                <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isJapan && (
              <div className="space-y-1">
                <Label>
                  都道府県 <span className="text-destructive">*</span>
                </Label>
                <Select value={draft.prefecture} onValueChange={(v) => set("prefecture", v)}>
                  <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                  <SelectContent>
                    {PREFECTURES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Field label="住所" required value={draft.address} onChange={(v) => set("address", v)} placeholder="千代田区…" />
            <Field label="Webサイト（任意）" value={draft.website} onChange={(v) => set("website", v)} placeholder="https://" />
            <Field label="想定利用人数（任意）" value={draft.expected_users} onChange={(v) => set("expected_users", v.replace(/[^0-9]/g, ""))} placeholder="300" />
          </div>
          <div className="space-y-1">
            <Label>連絡事項（任意）</Label>
            <Textarea rows={4} maxLength={2000} value={draft.note} onChange={(e) => set("note", e.target.value)} placeholder="導入予定時期、利用したい機能、ご質問など" />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="font-bold">4. 内容を確認して送信</h3>
          <dl className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 text-sm">
            {[
              ["種別", draft.org_type === "other" ? `その他（${draft.org_type_other}）` : ORG_TYPES.find((t) => t.value === draft.org_type)?.label ?? "-"],
              ["代表者名", `${draft.rep_last_name} ${draft.rep_first_name}${draft.rep_last_kana || draft.rep_first_kana ? `（${draft.rep_last_kana} ${draft.rep_first_kana}）` : ""}`],
              [departmentLabel(draft.org_type), draft.department || "-"],
              [orgNameLabel(draft.org_type), draft.org_name],
              ["ご連絡メールアドレス", draft.contact_email],
              ["ご連絡電話番号", draft.contact_phone],
              ["所在国", draft.country],
              ...(isJapan ? [["都道府県", draft.prefecture]] : []),
              ["住所", draft.address],
              ["Webサイト", draft.website || "-"],
              ["想定利用人数", draft.expected_users || "-"],
              ["連絡事項", draft.note || "-"],
            ].map(([k, v]) => (
              <div key={k as string} className="grid gap-1 p-3 sm:grid-cols-[11rem_1fr]">
                <dt className="text-xs font-bold text-muted-foreground">{k}</dt>
                <dd className="whitespace-pre-wrap break-words">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            送信すると運営が内容を確認します。承認されるまで組織の機能はご利用いただけません。
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          戻る
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
            次へ
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={busy || !user || existingPending || accountKind === "parent"}>
            この内容で送信する
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input type={type} value={value} placeholder={placeholder} maxLength={200} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
