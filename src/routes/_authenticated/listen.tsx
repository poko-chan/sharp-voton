import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Play, Square, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { isAiUsable, aiPrompt } from "@/lib/ai-provider";
import { AiUnavailable } from "@/components/AiUnavailable";

export const Route = createFileRoute("/_authenticated/listen")({ component: ListenPage });

function ListenPage() {
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [canAi, setCanAi] = useState<boolean>(false);
  useEffect(() => { isAiUsable().then(setCanAi); }, []);

  const make = async () => {
    if (!topic.trim()) return toast.error("お題を入力してください");
    setLoading(true);
    try {
      const prompt = `「${topic.trim()}」について、中学生でも理解できる優しい要約を400字程度で。読むだけ／聞き流すだけで頭に入る、会話調で。マークダウン記号は使わない。`;
      setText(await aiPrompt(prompt));
    }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const speak = () => {
    if (!("speechSynthesis" in window)) return toast.error("このブラウザは音声に未対応");
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };
  const stop = () => { window.speechSynthesis.cancel(); setSpeaking(false); };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">耳で学ぶ</h1>
        <p className="text-muted-foreground">AI要約を読むだけ / 聞き流すだけ。</p>
      </div>
      <Card className="p-5 space-y-3">
        {!canAi && <AiUnavailable feature="耳で学ぶ" />}
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="お題（例: 三角関数の基本）" maxLength={200} />
        <Button onClick={make} disabled={loading || !canAi}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          要約をもらう
        </Button>
      </Card>
      {text && (
        <Card className="p-5 space-y-3">
          <p className="text-sm whitespace-pre-wrap leading-7">{text}</p>
          <div className="flex gap-2">
            {!speaking ? (
              <Button onClick={speak}><Play className="mr-2 h-4 w-4" />読み上げ</Button>
            ) : (
              <Button variant="destructive" onClick={stop}><Square className="mr-2 h-4 w-4" />停止</Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
