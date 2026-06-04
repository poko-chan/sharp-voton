import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pencil, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const KEY = "quick-memo-draft";

export function QuickMemo() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setText(localStorage.getItem(KEY) ?? "");
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(KEY, text);
  }, [text]);

  if (!user) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="fixed bottom-24 right-5 z-[120] h-12 w-12 rounded-full bg-amber-400 text-amber-950 shadow-lg hover:scale-105 transition grid place-items-center"
          aria-label="クイックメモ"
          title="クイックメモ"
        >
          <Pencil className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" align="end" className="w-80 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-700">クイックメモ</span>
          {saved && <span className="text-[10px] text-emerald-600 inline-flex items-center gap-1"><Check className="h-3 w-3" />保存済</span>}
        </div>
        <Textarea
          rows={8}
          value={text}
          onChange={(e) => { setText(e.target.value); setSaved(true); }}
          placeholder="思いついたことをサッとメモ…（自動保存）"
          className="resize-none"
        />
        <p className="text-[10px] text-muted-foreground">この端末に自動保存されます。</p>
      </PopoverContent>
    </Popover>
  );
}