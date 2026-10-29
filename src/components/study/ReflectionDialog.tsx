import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight } from "lucide-react";
import { normalizeReflection, type ReflectionFields } from "@/lib/study-reflection";
import { ReflectionDetailFields, UnderstandingPicker } from "./ReflectionFields";

const DETAIL_KEY = "studysharp.reflection.detailOpen";

export type PendingReflection = { logId: string; minutes: number; content: string };

/** タイマー終了後に表示する振り返り。スキップしても記録（時間）は保存済み。 */
export function ReflectionDialog({
  pending,
  onClose,
}: {
  pending: PendingReflection | null;
  onClose: () => void;
}) {
  const [r, setR] = useState<ReflectionFields>({});
  const [memo, setMemo] = useState("");
  const [detail, setDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pending) return;
    setR({});
    setMemo(pending.content);
    setDetail(localStorage.getItem(DETAIL_KEY) === "1");
  }, [pending?.logId]);

  const toggleDetail = () => {
    const n = !detail;
    setDetail(n);
    localStorage.setItem(DETAIL_KEY, n ? "1" : "0");
  };

  const save = async () => {
    if (!pending) return;
    setSaving(true);
    const { error } = await supabase
      .from("study_logs")
      .update({ ...normalizeReflection(r), content: memo.trim() || pending.content } as never)
      .eq("id", pending.logId);
    setSaving(false);
    if (error) return toast.error("振り返りを保存できませんでした");
    toast.success("振り返りを保存しました");
    onClose();
  };

  return (
    <Dialog open={!!pending} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>おつかれさま！{pending?.minutes}分 記録しました</DialogTitle>
          <DialogDescription>手応えを残すと、次回の勉強と復習に役立ちます。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs mb-1.5 block">今回の手応え</Label>
            <UnderstandingPicker
              value={r.understanding}
              onChange={(v) => setR({ ...r, understanding: v })}
            />
          </div>
          <div>
            <Label className="text-xs">やったこと・気づき・疑問点</Label>
            <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} />
          </div>
          <button
            type="button"
            onClick={toggleDetail}
            className="flex items-center gap-1 text-sm font-medium text-primary"
          >
            {detail ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            詳しく記録する（範囲・集中度・次の一歩・タグ）
          </button>
          {detail && <ReflectionDetailFields value={r} onChange={setR} />}
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              スキップ
            </Button>
            <Button className="flex-1" onClick={save} disabled={saving}>
              保存する
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
