import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { useLocalPrefs } from "@/lib/user-prefs";

/** 複数行入力・Enter送信切替に対応した共通コンポーザー */
export function ChatComposer({
  value,
  onChange,
  onSend,
  placeholder = "メッセージを入力",
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder?: string;
}) {
  const { prefs } = useLocalPrefs();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(160, el.scrollHeight)}px`;
  }, [value]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const withMod = e.metaKey || e.ctrlKey;
    if (e.key !== "Enter") return;
    if (prefs.chat_enter_send ? !e.shiftKey && !withMod : withMod) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border-t p-2 sm:p-3 flex gap-2 items-end">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        aria-label="メッセージ"
        className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button onClick={onSend} size="icon" aria-label="送信" disabled={!value.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** メッセージ検索バー */
export function ChatSearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="メッセージを検索"
      aria-label="メッセージを検索"
      className="h-8 w-32 sm:w-48 rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}
