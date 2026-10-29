export type Understanding = "good" | "ok" | "review";

export const UNDERSTANDING: Record<
  Understanding,
  { label: string; emoji: string; cls: string }
> = {
  good: { label: "バッチリ", emoji: "🟢", cls: "bg-success/15 text-success border-success/30" },
  ok: { label: "ふつう", emoji: "🟡", cls: "bg-warning/15 text-warning border-warning/30" },
  review: {
    label: "要復習",
    emoji: "🔴",
    cls: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

export const REFLECTION_TAG_SUGGESTIONS = [
  "定期テスト",
  "模試",
  "受験",
  "宿題",
  "予習",
  "復習",
  "基礎",
  "応用",
  "過去問",
  "暗記",
];

export type ReflectionFields = {
  understanding?: Understanding | null;
  focus_level?: number | null;
  range_text?: string | null;
  next_step?: string | null;
  reflection_tags?: string[];
};

/** 空文字をnullにし、タグを正規化してDB保存用に整える */
export function normalizeReflection(r: ReflectionFields): ReflectionFields {
  const s = (v?: string | null) => (v && v.trim() ? v.trim().slice(0, 500) : null);
  const fl = r.focus_level ?? null;
  return {
    understanding: r.understanding ?? null,
    focus_level: fl && fl >= 1 && fl <= 5 ? Math.round(fl) : null,
    range_text: s(r.range_text),
    next_step: s(r.next_step),
    reflection_tags: Array.from(
      new Set((r.reflection_tags ?? []).map((t) => t.trim()).filter(Boolean)),
    ).slice(0, 10),
  };
}
