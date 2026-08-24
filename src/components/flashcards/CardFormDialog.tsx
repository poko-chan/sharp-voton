import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Flashcard } from "@/lib/flashcards.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: Flashcard | null;
  onSubmit: (front: string, back: string) => Promise<void>;
};

export function CardFormDialog({ open, onOpenChange, card, onSubmit }: Props) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFront(card?.front ?? "");
      setBack(card?.back ?? "");
    }
  }, [open, card]);

  const handleSubmit = async () => {
    if (!front.trim() || !back.trim()) return;
    setSaving(true);
    try {
      await onSubmit(front.trim(), back.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{card ? "カードを編集" : "新しいカード"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="card-front">表（問題）</Label>
            <Textarea id="card-front" value={front} onChange={(e) => setFront(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-back">裏（答え）</Label>
            <Textarea id="card-back" value={back} onChange={(e) => setBack(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={!front.trim() || !back.trim() || saving}>{card ? "保存" : "追加"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
