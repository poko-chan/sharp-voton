import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type SR = any;

export function VoiceMicButton({ onResult, lang = "ja-JP" }: { onResult: (text: string) => void; lang?: string }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SR | null>(null);

  useEffect(() => () => { recRef.current?.stop?.(); }, []);

  const toggle = () => {
    const w = window as any;
    const SRClass = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SRClass) {
      toast.error("このブラウザは音声入力に対応していません（Chrome推奨）");
      return;
    }
    if (listening) { recRef.current?.stop?.(); setListening(false); return; }
    const r: SR = new SRClass();
    r.lang = lang; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (ev: any) => {
      const text = Array.from(ev.results).map((x: any) => x[0].transcript).join(" ");
      if (text) onResult(text);
    };
    r.onerror = (ev: any) => { toast.error("音声入力エラー: " + (ev.error || "")); setListening(false); };
    r.onend = () => setListening(false);
    r.start(); recRef.current = r; setListening(true);
  };

  return (
    <Button type="button" variant={listening ? "default" : "outline"} size="icon" onClick={toggle} title="音声入力">
      {listening ? <MicOff className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}