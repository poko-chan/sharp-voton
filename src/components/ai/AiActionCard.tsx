import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, ClipboardCheck, Loader2 } from "lucide-react";
import type { AiAction } from "@/lib/ai-actions";

/** AI が提案した操作を、ユーザーが内容を確認・修正して許可するカード */
export function AiActionCard({
  action, onApprove, onCancel,
}: {
  action: AiAction;
  onApprove: (a: AiAction) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<AiAction>(action);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<AiAction>) => setDraft((d) => ({ ...d, ...patch } as AiAction));

  const approve = async () => {
    setBusy(true);
    try { await onApprove(draft); } finally { setBusy(false); }
  };

  return (
    <div className="not-prose rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2 text-sm">
      <div className="flex items-center gap-1.5 font-semibold text-primary">
        <ClipboardCheck className="h-4 w-4" />
        {draft.kind === "add_study_log" ? "この学習記録を登録していいですか？" : "この学習目標を作成していいですか？"}
      </div>

      {draft.kind === "add_study_log" ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="日付"><Input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value } as any)} className="h-8" /></Field>
          <Field label="教科"><Input value={draft.subject} onChange={(e) => set({ subject: e.target.value } as any)} className="h-8" /></Field>
          <Field label="時間（分）"><Input type="number" min={1} max={400} value={draft.minutes} onChange={(e) => set({ minutes: Number(e.target.value) } as any)} className="h-8" /></Field>
          <Field label="教材（任意）"><Input value={draft.material ?? ""} placeholder="未指定" onChange={(e) => set({ material: e.target.value || null } as any)} className="h-8" /></Field>
          <div className="col-span-2">
            <Field label="内容"><Input value={draft.content} onChange={(e) => set({ content: e.target.value } as any)} className="h-8" /></Field>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <Field label="目標"><Input value={draft.title} onChange={(e) => set({ title: e.target.value } as any)} className="h-8" /></Field>
          </div>
          <Field label="目標時間（分）"><Input type="number" min={1} value={draft.target_minutes} onChange={(e) => set({ target_minutes: Number(e.target.value) } as any)} className="h-8" /></Field>
          <Field label="期限（任意）"><Input type="date" value={draft.deadline ?? ""} onChange={(e) => set({ deadline: e.target.value || null } as any)} className="h-8" /></Field>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={approve} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}許可して登録
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}><X className="h-3.5 w-3.5 mr-1" />やめる</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
