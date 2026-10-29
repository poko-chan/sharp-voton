import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, X } from "lucide-react";
import {
  REFLECTION_TAG_SUGGESTIONS,
  UNDERSTANDING,
  type ReflectionFields,
  type Understanding,
} from "@/lib/study-reflection";

export function UnderstandingPicker({
  value,
  onChange,
}: {
  value?: Understanding | null;
  onChange: (v: Understanding | null) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(UNDERSTANDING) as Understanding[]).map((k) => {
        const u = UNDERSTANDING[k];
        const on = value === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(on ? null : k)}
            className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition ${on ? u.cls + " ring-2 ring-offset-1 ring-current" : "hover:bg-muted"}`}
          >
            <span className="mr-1">{u.emoji}</span>
            {u.label}
          </button>
        );
      })}
    </div>
  );
}

export function FocusStars({
  value,
  onChange,
}: {
  value?: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`集中度${n}`}
          onClick={() => onChange(value === n ? null : n)}
          className="p-0.5"
        >
          <Star
            className={`h-6 w-6 ${value && n <= value ? "fill-warning text-warning" : "text-muted-foreground"}`}
          />
        </button>
      ))}
    </div>
  );
}

/** 範囲・集中度・次の一歩・タグの詳細入力 */
export function ReflectionDetailFields({
  value,
  onChange,
}: {
  value: ReflectionFields;
  onChange: (v: ReflectionFields) => void;
}) {
  const [tagInput, setTagInput] = useState("");
  const tags = value.reflection_tags ?? [];
  const addTag = (t: string) => {
    const x = t.trim();
    if (!x || tags.includes(x)) return;
    onChange({ ...value, reflection_tags: [...tags, x].slice(0, 10) });
  };
  return (
    <div className="space-y-3 text-left">
      <div>
        <Label className="text-xs">取り組んだ範囲</Label>
        <Input
          value={value.range_text ?? ""}
          onChange={(e) => onChange({ ...value, range_text: e.target.value })}
          placeholder="例：p.24〜30 / 単語 1〜100 / 大問2"
          maxLength={200}
        />
      </div>
      <div>
        <Label className="text-xs">集中度</Label>
        <FocusStars
          value={value.focus_level}
          onChange={(v) => onChange({ ...value, focus_level: v })}
        />
      </div>
      <div>
        <Label className="text-xs">次の一歩（次回どこから始める？）</Label>
        <Input
          value={value.next_step ?? ""}
          onChange={(e) => onChange({ ...value, next_step: e.target.value })}
          placeholder="例：p.31の例題3から"
          maxLength={200}
        />
      </div>
      <div>
        <Label className="text-xs">タグ</Label>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs"
            >
              #{t}
              <button
                type="button"
                onClick={() =>
                  onChange({ ...value, reflection_tags: tags.filter((x) => x !== t) })
                }
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              addTag(tagInput);
              setTagInput("");
            }
          }}
          placeholder="タグを入力してEnter"
          maxLength={20}
        />
        <div className="flex flex-wrap gap-1 mt-1.5">
          {REFLECTION_TAG_SUGGESTIONS.filter((t) => !tags.includes(t)).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addTag(t)}
              className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
            >
              +{t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReflectionBadges({ log }: { log: any }) {
  const u = log.understanding ? UNDERSTANDING[log.understanding as Understanding] : null;
  const tags: string[] = log.reflection_tags ?? [];
  if (!u && !log.focus_level && !log.range_text && !log.next_step && !tags.length) return null;
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {u && (
          <span className={`rounded-full border px-2 py-0.5 font-medium ${u.cls}`}>
            {u.emoji} {u.label}
            {log.understanding === "review" && log.reviewed_at ? "（復習済み）" : ""}
          </span>
        )}
        {log.focus_level ? (
          <span className="text-warning">{"★".repeat(log.focus_level)}</span>
        ) : null}
        {log.range_text && (
          <span className="rounded-full bg-muted px-2 py-0.5">📖 {log.range_text}</span>
        )}
        {tags.map((t) => (
          <span key={t} className="rounded-full bg-primary/10 text-primary px-2 py-0.5">
            #{t}
          </span>
        ))}
      </div>
      {log.next_step && (
        <p className="text-xs text-muted-foreground">➡ 次回：{log.next_step}</p>
      )}
    </div>
  );
}
