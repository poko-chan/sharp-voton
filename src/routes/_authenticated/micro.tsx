import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { chromeAiStatus, chromeAiJSON } from "@/lib/chrome-ai";
import { AiUnavailable } from "@/components/AiUnavailable";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/micro")({ component: MicroPage });

type Q = { question: string; choices: string[]; answer: number; explanation: string };

function MicroPage() {
  const [topic, setTopic] = useState("");
  const [q, setQ] = useState<Q | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<string>("checking");
  useEffect(() => { chromeAiStatus().then(setAiStatus); }, []);
  const canAi = aiStatus === "available" || aiStatus === "downloadable" || aiStatus === "downloading";

  const next = async () => {
    setLoading(true); setPicked(null); setQ(null);
    try {
      const t = topic || "中学・高校レベルの基礎一般教養";
      const prompt = `「${t}」から、1分で解ける4択クイズを1問作成。出力は厳密なJSONのみ:
{"question":"問題文","choices":["A","B","C","D"],"answer":0,"explanation":"解説"}
answer は 0〜3 の正解インデックス。`;
      setQ(await chromeAiJSON<Q>(prompt));
    }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">マイクロ学習</h1>
        <p className="text-muted-foreground">1問1分。0分の日を作らないため。</p>
      </div>
      <Card className="p-5 space-y-3">
        {!canAi && aiStatus !== "checking" && <AiUnavailable feature="マイクロ学習" />}
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="お題（空欄なら基礎一般教養）" maxLength={100} />
        <Button onClick={next} disabled={loading || !canAi}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          1問もらう
        </Button>
      </Card>
      {q && (
        <Card className="p-5 space-y-3">
          <div className="font-semibold">{q.question}</div>
          <div className="grid gap-2">
            {q.choices.map((c, i) => (
              <Button
                key={i}
                variant={picked === null ? "outline" : i === q.answer ? "default" : picked === i ? "destructive" : "outline"}
                onClick={() => picked === null && setPicked(i)}
                className="justify-start"
              >
                {String.fromCharCode(65 + i)}. {c}
              </Button>
            ))}
          </div>
          {picked !== null && (
            <div className="text-sm rounded border bg-muted/30 p-3 whitespace-pre-wrap">{q.explanation}</div>
          )}
        </Card>
      )}
    </div>
  );
}
