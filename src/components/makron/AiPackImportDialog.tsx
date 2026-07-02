import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Sparkles, Loader2, ClipboardPaste, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { chromeAiStatus, createChromeAiSession, extractJSON } from "@/lib/chrome-ai";
import { ChromeAiStatusBadge } from "@/components/ChromeAiStatusBadge";

type Mode = "new" | "add";
type Unit = { id: string; title?: string; subject?: string; field?: string; unit?: string };

type GeneratedQuestion = {
  type?: "single" | "multi" | "text";
  prompt: string;
  options?: string[];
  correct_options?: string[];
  accepted_answers?: string[];
  explanation?: string;
  hint_text?: string;
  points?: number;
};
type GeneratedPayload = {
  pack?: { title?: string; description?: string };
  questions: GeneratedQuestion[];
};

export function AiPackImportDialog({
  open, onOpenChange, mode, unit, packId, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: Mode;
  unit: Unit | null;
  packId?: string;
  onDone?: () => void;
}) {
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("基礎");
  const [qType, setQType] = useState<"single" | "multi" | "text" | "mixed">("single");
  const [extra, setExtra] = useState("");
  const [packTitle, setPackTitle] = useState("");
  const [packDesc, setPackDesc] = useState("");
  const [aiStatus, setAiStatus] = useState<string>("checking");
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    chromeAiStatus().then(setAiStatus);
    setResponse(""); setCopied(false);
  }, [open]);

  const ctx = [unit?.subject, unit?.field, unit?.unit].filter(Boolean).join(" / ") || unit?.title || "";

  const prompt = buildPrompt({
    mode, ctx, count, difficulty, qType, extra,
    packTitleHint: mode === "new" ? packTitle.trim() : undefined,
  });

  const importPayload = async (payload: GeneratedPayload) => {
    if (!unit?.id) throw new Error("単元が不明です");
    if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
      throw new Error("questions が空です");
    }
    let targetPackId = packId;
    if (mode === "new") {
      const title = (payload.pack?.title || packTitle || `AI生成パック ${new Date().toLocaleDateString()}`).slice(0, 100);
      const description = (payload.pack?.description || packDesc || "AI で自動生成された問題パック").slice(0, 500);
      const { data: p, error } = await (supabase as any).from("makron_packs")
        .insert({ unit_id: unit.id, title, description })
        .select("id").single();
      if (error) throw new Error(error.message);
      targetPackId = p.id;
    }
    if (!targetPackId) throw new Error("対象パックがありません");

    const rows = payload.questions.slice(0, 50).map((q, i) => normalizeQuestion(q, targetPackId!, unit.id, i));
    const { error: insErr } = await (supabase as any).from("makron_questions").insert(rows);
    if (insErr) throw new Error(insErr.message);
    toast.success(`${rows.length} 問をインポートしました`);
    onDone?.();
    onOpenChange(false);
  };

  const runChromeAi = async () => {
    setBusy(true);
    try {
      const session = await createChromeAiSession({
        system: "あなたは日本の学習問題を作るアシスタントです。出力は必ず厳密な JSON のみ。コードブロックや前置きは禁止。",
        temperature: 0.7,
      });
      try {
        const out = await session.prompt(prompt);
        const parsed = extractJSON<GeneratedPayload>(out);
        await importPayload(parsed);
      } finally { session.destroy(); }
    } catch (e: any) {
      toast.error(e.message ?? "AI 生成に失敗");
    } finally { setBusy(false); }
  };

  const applyManualResponse = async () => {
    setBusy(true);
    try {
      const parsed = extractJSON<GeneratedPayload>(response);
      await importPayload(parsed);
    } catch (e: any) {
      toast.error(e.message ?? "解析失敗");
    } finally { setBusy(false); }
  };

  const canChrome = aiStatus === "available" || aiStatus === "downloadable" || aiStatus === "downloading";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI で問題を{mode === "new" ? "一括作成（新規パック）" : "一括追加"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {ctx && <div className="text-xs text-muted-foreground">単元: {ctx}</div>}

          {mode === "new" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="text-xs">パック名（任意・空欄ならAIが命名）</label>
                <Input value={packTitle} onChange={(e) => setPackTitle(e.target.value)} placeholder="例: 二次関数 基礎 10問" />
              </div>
              <div className="col-span-2">
                <label className="text-xs">パック説明（任意）</label>
                <Input value={packDesc} onChange={(e) => setPackDesc(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs">問題数</label>
              <Input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
            </div>
            <div>
              <label className="text-xs">難易度</label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="基礎">基礎</SelectItem>
                  <SelectItem value="標準">標準</SelectItem>
                  <SelectItem value="応用">応用</SelectItem>
                  <SelectItem value="入試レベル">入試レベル</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs">形式</label>
              <Select value={qType} onValueChange={(v) => setQType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">4択（単一選択）</SelectItem>
                  <SelectItem value="multi">複数選択</SelectItem>
                  <SelectItem value="text">記述（短答）</SelectItem>
                  <SelectItem value="mixed">ミックス</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs">AI への追加指示（任意）</label>
            <Textarea rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="例: 計算過程を解説で丁寧に。引っ掛けの選択肢を入れる。" />
          </div>

          <Tabs defaultValue={canChrome ? "auto" : "manual"}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="auto" disabled={!canChrome}>
                自動生成 {canChrome ? "" : "(Chrome AI 未対応)"}
              </TabsTrigger>
              <TabsTrigger value="manual">外部AIに依頼してコピペ</TabsTrigger>
            </TabsList>

            <TabsContent value="auto" className="space-y-2 pt-2">
              <ChromeAiStatusBadge />
              <Button onClick={runChromeAi} disabled={busy || !canChrome} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                AI に生成させてインポート
              </Button>
            </TabsContent>

            <TabsContent value="manual" className="space-y-2 pt-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold">① このプロンプトを ChatGPT / Claude / Gemini などにコピペ</label>
                  <Button size="sm" variant="outline" onClick={() => {
                    navigator.clipboard.writeText(prompt);
                    setCopied(true); setTimeout(() => setCopied(false), 1500);
                  }}>
                    {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copied ? "コピー済み" : "プロンプトをコピー"}
                  </Button>
                </div>
                <Textarea readOnly value={prompt} rows={8} className="font-mono text-[11px]" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold">② AI が返した JSON をここに貼り付け</label>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    try { setResponse(await navigator.clipboard.readText()); } catch { /* ignore */ }
                  }}>
                    <ClipboardPaste className="h-3 w-3 mr-1" />クリップボードから貼り付け
                  </Button>
                </div>
                <Textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={8} className="font-mono text-[11px]" placeholder='{ "pack": {...}, "questions": [...] }' />
              </div>
              <Button onClick={applyManualResponse} disabled={busy || !response.trim()} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                解析してインポート
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildPrompt(args: {
  mode: Mode; ctx: string; count: number; difficulty: string;
  qType: "single" | "multi" | "text" | "mixed"; extra: string; packTitleHint?: string;
}): string {
  const typeInstr =
    args.qType === "single" ? '全問 type は "single"（4択・1つ正解）。' :
    args.qType === "multi" ? '全問 type は "multi"（複数選択）。' :
    args.qType === "text" ? '全問 type は "text"（短答記述）。' :
    'type は "single" / "multi" / "text" を適度に混在。';

  const schema = args.mode === "new"
    ? `{
  "pack": { "title": "パック名", "description": "概要（1〜2行）" },
  "questions": [
    {
      "type": "single",
      "prompt": "問題文",
      "options": ["選択肢A","選択肢B","選択肢C","選択肢D"],
      "correct_options": ["選択肢A"],
      "accepted_answers": [],
      "explanation": "解説",
      "hint_text": "ヒント",
      "points": 10
    }
  ]
}`
    : `{
  "questions": [
    {
      "type": "single",
      "prompt": "問題文",
      "options": ["選択肢A","選択肢B","選択肢C","選択肢D"],
      "correct_options": ["選択肢A"],
      "accepted_answers": [],
      "explanation": "解説",
      "hint_text": "ヒント",
      "points": 10
    }
  ]
}`;

  return `次の条件で日本語の学習問題を生成してください。

【単元】${args.ctx || "（指定なし）"}
${args.packTitleHint ? `【希望パック名】${args.packTitleHint}\n` : ""}【問題数】${args.count}
【難易度】${args.difficulty}
【形式】${typeInstr}
${args.extra ? `【追加指示】${args.extra}\n` : ""}
【ルール】
- 出力は厳密な JSON のみ。前置き・コードブロック・補足文は禁止。
- type "single" は correct_options に1つだけ、"multi" は2つ以上、"text" は options と correct_options を空配列にして accepted_answers に許容解（複数可）を入れる。
- explanation は1〜3文。hint_text は1文の短いヒント。
- points は 5〜20 の整数。

【出力フォーマット】
${schema}

上記のフォーマットに従って JSON のみを返してください。`;
}

const ALLOWED_TYPES = new Set(["single", "multi", "text"]);

function normalizeQuestion(q: GeneratedQuestion, packId: string, unitId: string, idx: number) {
  const type = ALLOWED_TYPES.has(q.type as string) ? q.type! : "single";
  const options = Array.isArray(q.options) ? q.options.filter((o) => typeof o === "string" && o.trim()) : [];
  const correct = Array.isArray(q.correct_options) ? q.correct_options.filter((o) => typeof o === "string" && o.trim()) : [];
  const accepted = Array.isArray(q.accepted_answers) ? q.accepted_answers.filter((o) => typeof o === "string" && o.trim()) : [];
  return {
    pack_id: packId,
    unit_id: unitId,
    prompt: String(q.prompt ?? "").slice(0, 2000),
    type,
    options: type === "text" ? [] : options,
    correct_options: type === "text" ? [] : correct,
    accepted_answers: type === "text" ? accepted : [],
    explanation: q.explanation ? String(q.explanation).slice(0, 2000) : null,
    hint_text: q.hint_text ? String(q.hint_text).slice(0, 500) : null,
    points: Number.isFinite(q.points) ? Math.max(0, Math.min(100, Number(q.points))) : 10,
    grading: "auto",
    is_active: true,
    order_idx: 100 + idx,
  };
}