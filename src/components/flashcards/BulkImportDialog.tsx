import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseBulkImport } from "@/lib/flashcards.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (pairs: { front: string; back: string }[]) => Promise<void>;
};

export function BulkImportDialog({ open, onOpenChange, onImport }: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const pairs = useMemo(() => parseBulkImport(text), [text]);

  const handleImport = async () => {
    if (pairs.length === 0) return;
    setSaving(true);
    try {
      await onImport(pairs);
      setText("");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setText(""); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>カードを一括インポート</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            1行につき1枚、「表{"\t"}裏」または「表,裏」の形式で貼り付けてください。
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"apple,りんご\nbanana,バナナ"}
            className="min-h-[160px] font-mono text-sm"
          />
          <div className="border rounded-md max-h-48 overflow-y-auto">
            {pairs.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">プレビューはここに表示されます</div>
            ) : (
              <div className="divide-y">
                {pairs.map((p, i) => (
                  <div key={i} className="p-2 text-sm flex gap-2 items-center">
                    <span className="flex-1 truncate">{p.front}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="flex-1 truncate">{p.back}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{pairs.length}枚を検出</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
          <Button onClick={handleImport} disabled={pairs.length === 0 || saving}>{pairs.length}枚を登録</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
