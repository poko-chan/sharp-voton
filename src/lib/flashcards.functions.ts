import { supabase } from "@/integrations/supabase/client";

export type FlashcardDeck = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  subject: string;
  color: string;
  created_at: string;
  updated_at: string;
};

export type Flashcard = {
  id: string;
  user_id: string;
  deck: string;
  deck_id: string | null;
  front: string;
  back: string;
  ease: number;
  interval_days: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  reviews: number;
  created_at: string;
  updated_at: string;
};

export const DECK_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#f59e0b", "#84cc16", "#10b981", "#06b6d4", "#0ea5e9",
];

export const DECK_SUBJECTS = [
  "国語", "数学", "英語", "理科", "社会", "その他",
];

export type Grade = "again" | "hard" | "good" | "easy";

// ---------- Decks ----------

export async function fetchDecks(userId: string) {
  const { data, error } = await supabase
    .from("flashcard_decks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FlashcardDeck[];
}

export async function fetchDeckCardCounts(userId: string) {
  const { data, error } = await supabase
    .from("flashcards")
    .select("deck_id, next_review_at")
    .eq("user_id", userId);
  if (error) throw error;
  const counts = new Map<string, { total: number; due: number }>();
  const now = new Date();
  for (const row of data ?? []) {
    const id = (row as any).deck_id as string | null;
    if (!id) continue;
    const entry = counts.get(id) ?? { total: 0, due: 0 };
    entry.total += 1;
    if (new Date((row as any).next_review_at) <= now) entry.due += 1;
    counts.set(id, entry);
  }
  return counts;
}

export async function createDeck(userId: string, input: { name: string; description: string; subject: string; color: string }) {
  const { data, error } = await supabase
    .from("flashcard_decks")
    .insert({ user_id: userId, ...input })
    .select("*")
    .single();
  if (error) throw error;
  return data as FlashcardDeck;
}

export async function updateDeck(id: string, input: { name: string; description: string; subject: string; color: string }) {
  const { data, error } = await supabase
    .from("flashcard_decks")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as FlashcardDeck;
}

export async function deleteDeck(id: string) {
  const { error } = await supabase.from("flashcard_decks").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Cards ----------

export async function fetchCardsForDeck(userId: string, deckId: string) {
  const { data, error } = await supabase
    .from("flashcards")
    .select("*")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Flashcard[];
}

export async function fetchDueCardsForDeck(userId: string, deckId: string) {
  const { data, error } = await supabase
    .from("flashcards")
    .select("*")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Flashcard[];
}

export async function createCard(userId: string, deckId: string, deckName: string, front: string, back: string) {
  const { data, error } = await supabase
    .from("flashcards")
    .insert({ user_id: userId, deck_id: deckId, deck: deckName, front, back })
    .select("*")
    .single();
  if (error) throw error;
  return data as Flashcard;
}

export async function bulkCreateCards(userId: string, deckId: string, deckName: string, pairs: { front: string; back: string }[]) {
  if (pairs.length === 0) return [];
  const rows = pairs.map((p) => ({ user_id: userId, deck_id: deckId, deck: deckName, front: p.front, back: p.back }));
  const { data, error } = await supabase.from("flashcards").insert(rows).select("*");
  if (error) throw error;
  return (data ?? []) as Flashcard[];
}

export async function updateCard(id: string, front: string, back: string) {
  const { data, error } = await supabase
    .from("flashcards")
    .update({ front, back, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Flashcard;
}

export async function deleteCard(id: string) {
  const { error } = await supabase.from("flashcards").delete().eq("id", id);
  if (error) throw error;
}

/** デッキ内の全カードの判定（習得度・復習間隔）を初期状態に戻す */
export async function resetDeckProgress(userId: string, deckId: string) {
  const { error } = await supabase
    .from("flashcards")
    .update({
      ease: 2.5,
      interval_days: 0,
      next_review_at: new Date().toISOString(),
      last_reviewed_at: null,
      reviews: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("deck_id", deckId);
  if (error) throw error;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- SRS ----------

const GRADE_Q: Record<Grade, 0 | 3 | 4 | 5> = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
};

export function computeNextReview(card: Pick<Flashcard, "ease" | "interval_days">, grade: Grade) {
  const q = GRADE_Q[grade];
  let ease = card.ease;
  let interval = card.interval_days;
  if (q < 3) {
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    if (interval === 0) interval = 1;
    else if (interval === 1) interval = 6;
    else interval = Math.round(interval * ease);
    ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  }
  const next = new Date();
  next.setDate(next.getDate() + interval);
  return { ease, interval_days: interval, next_review_at: next.toISOString() };
}

export async function gradeCard(card: Flashcard, grade: Grade) {
  const { ease, interval_days, next_review_at } = computeNextReview(card, grade);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("flashcards")
    .update({
      ease,
      interval_days,
      next_review_at,
      last_reviewed_at: now,
      updated_at: now,
      reviews: card.reviews + 1,
    })
    .eq("id", card.id);
  if (error) throw error;
}

// ---------- Bulk import parsing ----------

export function parseBulkImport(text: string): { front: string; back: string }[] {
  const lines = text.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim().length > 0);
  const pairs: { front: string; back: string }[] = [];
  for (const line of lines) {
    let parts: string[];
    if (line.includes("\t")) parts = line.split("\t");
    else parts = line.split(",");
    if (parts.length < 2) continue;
    const front = parts[0].trim();
    const back = parts.slice(1).join(",").trim();
    if (front && back) pairs.push({ front, back });
  }
  return pairs;
}
