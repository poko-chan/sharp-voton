import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Brain } from "lucide-react";
import { toast } from "sonner";
import {
  createDeck,
  deleteDeck,
  fetchDeckCardCounts,
  fetchDecks,
  updateDeck,
  type FlashcardDeck,
} from "@/lib/flashcards.functions";
import { DeckGrid } from "@/components/flashcards/DeckGrid";
import { DeckDialog } from "@/components/flashcards/DeckDialog";
import { DeckDetail } from "@/components/flashcards/DeckDetail";

export const Route = createFileRoute("/_authenticated/flashcards")({ component: FlashcardsPage });

function FlashcardsPage() {
  const { user } = useAuth();
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [counts, setCounts] = useState(new Map<string, { total: number; due: number }>());
  const [loading, setLoading] = useState(true);
  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeck | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<FlashcardDeck | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [deckData, countData] = await Promise.all([
        fetchDecks(user.id),
        fetchDeckCardCounts(user.id),
      ]);
      setDecks(deckData);
      setCounts(countData);
    } catch {
      toast.error("デッキの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleSubmit = async (input: { name: string; description: string; subject: string; color: string }) => {
    if (!user) return;
    try {
      if (editingDeck) {
        await updateDeck(editingDeck.id, input);
        toast.success("デッキを更新しました");
      } else {
        await createDeck(user.id, input);
        toast.success("デッキを作成しました");
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message?.includes("duplicate") ? "同じ名前のデッキが既にあります" : "保存に失敗しました");
    }
  };

  const handleDelete = async (deck: FlashcardDeck) => {
    if (!confirm(`「${deck.name}」を削除しますか？（含まれるカードも削除されます）`)) return;
    try {
      await deleteDeck(deck.id);
      toast.success("デッキを削除しました");
      await load();
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  // keep selectedDeck in sync when returning from detail view after edits
  useEffect(() => {
    if (selectedDeck) {
      const fresh = decks.find((d) => d.id === selectedDeck.id);
      if (fresh) setSelectedDeck(fresh);
    }
  }, [decks]);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Brain className="h-7 w-7" />
        <h1 className="text-2xl sm:text-3xl font-bold">暗記カード</h1>
      </div>

      {selectedDeck ? (
        <DeckDetail userId={user!.id} deck={selectedDeck} onBack={() => { setSelectedDeck(null); load(); }} />
      ) : loading ? (
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      ) : (
        <DeckGrid
          decks={decks}
          counts={counts}
          onOpen={setSelectedDeck}
          onEdit={(deck) => { setEditingDeck(deck); setDialogOpen(true); }}
          onDelete={handleDelete}
          onCreate={() => { setEditingDeck(null); setDialogOpen(true); }}
        />
      )}

      <DeckDialog open={dialogOpen} onOpenChange={setDialogOpen} deck={editingDeck} onSubmit={handleSubmit} />
    </div>
  );
}
