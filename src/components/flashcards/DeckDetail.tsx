import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Upload, Pencil, Trash2, PlayCircle, Shuffle, RotateCcw, Repeat } from "lucide-react";
import { toast } from "sonner";
import {
  createCard,
  deleteCard,
  fetchCardsForDeck,
  fetchDueCardsForDeck,
  updateCard,
  bulkCreateCards,
  resetDeckProgress,
  type Flashcard,
  type FlashcardDeck,
} from "@/lib/flashcards.functions";
import { CardFormDialog } from "@/components/flashcards/CardFormDialog";
import { BulkImportDialog } from "@/components/flashcards/BulkImportDialog";
import { StudySession } from "@/components/flashcards/StudySession";

type Props = {
  userId: string;
  deck: FlashcardDeck;
  onBack: () => void;
};

export function DeckDetail({ userId, deck, onBack }: Props) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [studyCards, setStudyCards] = useState<Flashcard[] | null>(null);
  const [studyShuffled, setStudyShuffled] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchCardsForDeck(userId, deck.id);
      setCards(data);
    } catch {
      toast.error("カードの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [deck.id]);

  const dueCount = cards.filter((c) => new Date(c.next_review_at) <= new Date()).length;

  const handleCreateOrUpdate = async (front: string, back: string) => {
    try {
      if (editingCard) {
        await updateCard(editingCard.id, front, back);
      } else {
        await createCard(userId, deck.id, deck.name, front, back);
      }
      await load();
      toast.success(editingCard ? "カードを更新しました" : "カードを追加しました");
    } catch {
      toast.error("保存に失敗しました");
    }
  };

  const handleDelete = async (card: Flashcard) => {
    try {
      await deleteCard(card.id);
      setCards((cs) => cs.filter((c) => c.id !== card.id));
      toast.success("カードを削除しました");
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const handleImport = async (pairs: { front: string; back: string }[]) => {
    try {
      await bulkCreateCards(userId, deck.id, deck.name, pairs);
      await load();
      toast.success(`${pairs.length}枚のカードを追加しました`);
    } catch {
      toast.error("インポートに失敗しました");
    }
  };

  const startStudy = async (mode: "due" | "all", shuffled: boolean) => {
    try {
      const list = mode === "due" ? await fetchDueCardsForDeck(userId, deck.id) : cards;
      if (list.length === 0) {
        toast.info("学習できるカードがありません");
        return;
      }
      setStudyShuffled(shuffled);
      setStudyCards(list);
    } catch {
      toast.error("読み込みに失敗しました");
    }
  };

  const handleReset = async () => {
    if (!confirm("このデッキの判定（習得度・復習間隔）をすべて初期化しますか？")) return;
    try {
      await resetDeckProgress(userId, deck.id);
      await load();
      toast.success("判定をリセットしました");
    } catch {
      toast.error("リセットに失敗しました");
    }
  };

  if (studyCards !== null) {
    return (
      <StudySession
        deckName={deck.name}
        cards={studyCards}
        shuffled={studyShuffled}
        onExit={() => { setStudyCards(null); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />デッキ一覧</Button>
      </div>

      <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: deck.color }} />
          <div className="min-w-0">
            <div className="font-bold text-lg truncate">{deck.name}</div>
            <div className="text-xs text-muted-foreground truncate">{deck.description || "説明なし"}</div>
          </div>
          <Badge variant="secondary">{deck.subject}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {dueCount > 0 && <Badge className="bg-primary text-primary-foreground">今日 {dueCount}枚</Badge>}
          <Button onClick={startStudy} disabled={dueCount === 0}><PlayCircle className="h-4 w-4 mr-1" />学習を始める</Button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => { setEditingCard(null); setCardDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />カード追加
        </Button>
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-1" />一括インポート
        </Button>
      </div>

      <div className="space-y-2">
        <div className="font-semibold text-sm">カード一覧 ({cards.length})</div>
        {loading ? (
          <div className="text-sm text-muted-foreground">読み込み中...</div>
        ) : cards.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">まだカードがありません</Card>
        ) : (
          cards.map((c) => (
            <Card key={c.id} className="p-3 flex items-center gap-2 text-sm">
              <div className="flex-1 min-w-0 truncate">{c.front} → {c.back}</div>
              <span className="text-xs text-muted-foreground shrink-0">×{c.reviews}</span>
              <Button size="sm" variant="ghost" onClick={() => { setEditingCard(c); setCardDialogOpen(true); }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(c)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </Card>
          ))
        )}
      </div>

      <CardFormDialog
        open={cardDialogOpen}
        onOpenChange={setCardDialogOpen}
        card={editingCard}
        onSubmit={handleCreateOrUpdate}
      />
      <BulkImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={handleImport} />
    </div>
  );
}
