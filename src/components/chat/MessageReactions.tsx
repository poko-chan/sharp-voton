import { useState } from "react";
import { SmilePlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { REACTION_EMOJIS, type ChatReaction, type ChatScope } from "@/lib/chat.functions";

export function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="opacity-70 hover:opacity-100" aria-label="リアクションを追加">
          <SmilePlus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1.5 flex gap-1">
        {REACTION_EMOJIS.map((e) => (
          <button
            key={e}
            aria-label={`リアクション ${e}`}
            className="text-lg leading-none rounded-md px-1.5 py-1 hover:bg-muted"
            onClick={() => { onPick(e); setOpen(false); }}
          >
            {e}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function ReactionBar({
  reactions,
  messageId,
  scope,
  userId,
  onToggle,
}: {
  reactions: ChatReaction[];
  messageId: string;
  scope: ChatScope;
  userId: string;
  onToggle: (emoji: string) => void;
}) {
  const mine = reactions.filter((r) => r.message_id === messageId && r.scope === scope);
  if (mine.length === 0) return null;
  const counts = new Map<string, { n: number; me: boolean }>();
  for (const r of mine) {
    const c = counts.get(r.emoji) ?? { n: 0, me: false };
    counts.set(r.emoji, { n: c.n + 1, me: c.me || r.user_id === userId });
  }
  return (
    <div className="flex flex-wrap gap-1 px-1">
      {Array.from(counts.entries()).map(([emoji, c]) => (
        <button
          key={emoji}
          onClick={() => onToggle(emoji)}
          aria-label={`${emoji} ${c.n}件${c.me ? "（自分もリアクション済み）" : ""}`}
          className={`rounded-full border px-1.5 py-0.5 text-[11px] leading-none flex items-center gap-1 ${
            c.me ? "border-primary bg-primary/10 text-foreground" : "bg-background text-muted-foreground"
          }`}
        >
          <span>{emoji}</span>
          <span>{c.n}</span>
        </button>
      ))}
    </div>
  );
}
