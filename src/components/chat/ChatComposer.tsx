import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, Plus, Send, Timer, Video, X } from "lucide-react";
import { useLocalPrefs } from "@/lib/user-prefs";
import { makeMeetingCard, makeTimerCard } from "./ChatRichCard";

/** 複数行入力・Enter送信切替・画像貼り付け・招待カードに対応した共通コンポーザー */
export function ChatComposer({
  value,
  onChange,
  onSend,
  onSendImage,
  onSendRaw,
  onTyping,
  placeholder = "メッセージを入力",
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onSendImage?: (file: File) => Promise<void> | void;
  onSendRaw?: (body: string) => Promise<void> | void;
  onTyping?: (stop?: boolean) => void;
  placeholder?: string;
}) {
  const { prefs } = useLocalPrefs();
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pasted, setPasted] = useState<{ file: File; url: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(160, el.scrollHeight)}px`;
  }, [value]);

  useEffect(() => () => {
    if (pasted) URL.revokeObjectURL(pasted.url);
  }, [pasted]);

  const doSend = () => {
    onSend();
    onTyping?.(true);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const withMod = e.metaKey || e.ctrlKey;
    if (e.key !== "Enter") return;
    if (pasted && !e.shiftKey) {
      e.preventDefault();
      void sendPasted();
      return;
    }
    if (prefs.chat_enter_send ? !e.shiftKey && !withMod : withMod) {
      e.preventDefault();
      doSend();
    }
  };

  const pickImage = async (file: File | undefined) => {
    if (!file || !onSendImage) return;
    setUploading(true);
    try {
      await onSendImage(file);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!onSendImage) return;
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (!file) return;
    e.preventDefault();
    setPasted({ file, url: URL.createObjectURL(file) });
  };

  const sendPasted = async () => {
    if (!pasted) return;
    const f = pasted.file;
    setPasted(null);
    await pickImage(f);
  };

  const sendMeeting = async () => {
    setMenuOpen(false);
    const code = window.prompt("会議コードを入力（空欄なら会議ページへの案内）", "") ?? null;
    if (code === null) return;
    await onSendRaw?.(makeMeetingCard(code.trim()));
  };
  const sendTimer = async () => {
    setMenuOpen(false);
    const v = window.prompt("何分集中しますか？", "25");
    if (v === null) return;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return;
    await onSendRaw?.(makeTimerCard(n));
  };

  return (
    <div className="border-t">
      {pasted && (
        <div className="flex items-center gap-2 px-3 pt-2">
          <img src={pasted.url} alt="貼り付けた画像" className="h-16 w-16 rounded-md object-cover border" />
          <span className="text-xs text-muted-foreground flex-1">この画像を送信しますか？（Enterで送信）</span>
          <Button size="sm" onClick={sendPasted} disabled={uploading}>送信</Button>
          <Button size="icon" variant="ghost" aria-label="キャンセル" onClick={() => setPasted(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      {menuOpen && onSendRaw && (
        <div className="flex gap-2 px-3 pt-2">
          <Button size="sm" variant="outline" onClick={sendMeeting}>
            <Video className="h-4 w-4 mr-1" />自習室に招待
          </Button>
          <Button size="sm" variant="outline" onClick={sendTimer}>
            <Timer className="h-4 w-4 mr-1" />集中タイマーに誘う
          </Button>
        </div>
      )}
      <div className="p-2 sm:p-3 flex gap-2 items-end">
        {onSendRaw && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="招待メニュー"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Plus className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-45" : ""}`} />
          </Button>
        )}
        {onSendImage && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="画像を送る"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
          </>
        )}
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            onTyping?.(e.target.value.length === 0);
          }}
          onKeyDown={handleKey}
          onPaste={handlePaste}
          onBlur={() => onTyping?.(true)}
          placeholder={placeholder}
          aria-label="メッセージ"
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button onClick={doSend} size="icon" aria-label="送信" disabled={!value.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** メッセージ検索バー */
export function ChatSearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
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
