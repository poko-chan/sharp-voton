import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const REPORT_CATEGORIES = [
  "問題が不正確","誤字脱字","画像が表示されない/不鮮明","答えが間違っている","模範解答が不足",
  "解説が不足","問題の重複","カテゴリ違い","難易度設定がおかしい","不適切な内容",
  "古い情報","著作権の懸念","その他",
] as const;

export function ReportDialog({ questionId, questionLabel, open: openProp, onOpenChange, hideTrigger }: { questionId: string; questionLabel?: string; open?: boolean; onOpenChange?: (v: boolean) => void; hideTrigger?: boolean }) {
  const { user } = useAuth();
  const [openInner, setOpenInner] = useState(false);
  const open = openProp ?? openInner;
  const setOpen = (v: boolean) => { onOpenChange ? onOpenChange(v) : setOpenInner(v); };
  const [category, setCategory] = useState<string>(REPORT_CATEGORIES[0]);
  const [suggested, setSuggested] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await (supabase as any).from("makron_reports").insert({
      user_id: user.id, question_id: questionId, category,
      suggested_answer: suggested || null, note: note || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("報告ありがとうございます");
    setOpen(false); setSuggested(""); setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Flag className="h-4 w-4 mr-1" />問題を報告</Button>
      </DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>問題を報告</DialogTitle>
          {questionLabel && <div className="text-xs text-muted-foreground truncate">{questionLabel}</div>}
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">カテゴリ</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">正しいと思う答え（任意）</label>
            <Input value={suggested} onChange={(e) => setSuggested(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium">補足（任意）</label>
            <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>キャンセル</Button>
          <Button onClick={submit} disabled={saving}>送信</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}