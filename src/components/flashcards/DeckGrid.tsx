import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Layers, Pencil, Trash2 } from "lucide-react";
import type { FlashcardDeck } from "@/lib/flashcards.functions";

type Props = {
  decks: FlashcardDeck[];
  counts: Map<string, { total: number; due: number }>;
  onOpen: (deck: FlashcardDeck) => void;
  onEdit: (deck: FlashcardDeck) => void;
  onDelete: (deck: FlashcardDeck) => void;
  onCreate: () => void;
};

export function DeckGrid({ decks, counts, onOpen, onEdit, onDelete, onCreate }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {decks.map((deck) => {
        const c = counts.get(deck.id) ?? { total: 0, due: 0 };
        return (
          <Card
            key={deck.id}
            className="p-4 space-y-3 cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden"
            onClick={() => onOpen(deck)}
          >
            <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: deck.color }} />
            <div className="flex items-start justify-between gap-2 pt-1">
              <div className="min-w-0">
                <div className="font-semibold truncate">{deck.name}</div>
                <div className="text-xs text-muted-foreground truncate">{deck.description || "説明なし"}</div>
              </div>
              <Badge variant="secondary" className="shrink-0">{deck.subject}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{c.total}枚</span>
              {c.due > 0 && <Badge className="bg-primary text-primary-foreground">今日 {c.due}枚</Badge>}
            </div>
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="ghost" onClick={() => onEdit(deck)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(deck)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>
        );
      })}
      <Card
        className="p-4 flex flex-col items-center justify-center gap-2 min-h-[150px] cursor-pointer border-dashed hover:bg-muted/50 transition-colors"
        onClick={onCreate}
      >
        <Plus className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">新しいデッキを作成</span>
      </Card>
    </div>
  );
}
