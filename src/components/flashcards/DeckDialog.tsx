import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DECK_COLORS, DECK_SUBJECTS, type FlashcardDeck } from "@/lib/flashcards.functions";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deck: FlashcardDeck | null;
  onSubmit: (input: { name: string; description: string; subject: string; color: string }) => Promise<void>;
};

export function DeckDialog({ open, onOpenChange, deck, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState(DECK_SUBJECTS[0]);
  const [color, setColor] = useState(DECK_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(deck?.name ?? "");
      setDescription(deck?.description ?? "");
      setSubject(deck?.subject ?? DECK_SUBJECTS[0]);
      setColor(deck?.color ?? DECK_COLORS[0]);
    }
  }, [open, deck]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), subject, color });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{deck ? "デッキを編集" : "新しいデッキ"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="deck-name">デッキ名</Label>
            <Input id="deck-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 英単語 中3" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deck-desc">説明</Label>
            <Textarea id="deck-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="デッキの説明（任意）" />
          </div>
          <div className="space-y-1.5">
            <Label>教科</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DECK_SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>カラー</Label>
            <div className="flex flex-wrap gap-2">
              {DECK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-transform",
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || saving}>{deck ? "保存" : "作成"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
