import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Brain } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createDeck,
  deleteDeck,
  fetchDeckCardCounts,
  fetchDecks,
  updateDeck,
  setDeckArchived,
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
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

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

  useEffect(() => {
    load();
  }, [user?.id]);

  const seriesOptions = [...new Set(decks.map((deck) => deck.series.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "ja"),
  );
  const visibleDecks = decks.filter((deck) => {
    if (!!deck.archived !== showArchived) return false;
    if (seriesFilter === "all") return true;
    if (seriesFilter === "__none__") return !deck.series.trim();
    return deck.series === seriesFilter;
  });

  const handleSubmit = async (input: {
    name: string;
    description: string;
    subject: string;
    series: string;
    color: string;
  }) => {
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
      toast.error(
        e?.message?.includes("duplicate") ? "同じ名前のデッキが既にあります" : "保存に失敗しました",
      );
    }
  };

  const handleArchive = async (deck: FlashcardDeck) => {
    try {
      await setDeckArchived(deck.id, !deck.archived);
      toast.success(deck.archived ? "デッキを復元しました" : "デッキをアーカイブしました");
      await load();
    } catch {
      toast.error("更新に失敗しました");
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
        <DeckDetail
          userId={user!.id}
          deck={selectedDeck}
          onEdit={() => {
            setEditingDeck(selectedDeck);
            setDialogOpen(true);
          }}
          onBack={() => {
            setSelectedDeck(null);
            load();
          }}
        />
      ) : loading ? (
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      ) : (
        <>
          {decks.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-md border p-0.5">
                <Button size="sm" variant={showArchived ? "ghost" : "secondary"} onClick={() => setShowArchived(false)}>
                  使用中
                </Button>
                <Button size="sm" variant={showArchived ? "secondary" : "ghost"} onClick={() => setShowArchived(true)}>
                  アーカイブ ({decks.filter((d) => d.archived).length})
                </Button>
              </div>
              <Label htmlFor="series-filter">シリーズ</Label>
              <Select value={seriesFilter} onValueChange={setSeriesFilter}>
                <SelectTrigger id="series-filter" className="w-[240px] max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべてのシリーズ</SelectItem>
                  <SelectItem value="__none__">シリーズ未設定</SelectItem>
                  {seriesOptions.map((series) => (
                    <SelectItem key={series} value={series}>
                      {series}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DeckGrid
            decks={visibleDecks}
            counts={counts}
            onOpen={setSelectedDeck}
            onEdit={(deck) => {
              setEditingDeck(deck);
              setDialogOpen(true);
            }}
            onDelete={handleDelete}
            onArchive={handleArchive}
            showCreate={!showArchived}
            onCreate={() => {
              setEditingDeck(null);
              setDialogOpen(true);
            }}
          />
        </>
      )}

      <DeckDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        deck={editingDeck}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
