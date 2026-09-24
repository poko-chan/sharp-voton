import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Volume2, Snail, Flame, CircleCheck, CircleX } from "lucide-react";

/** 単語タイルで文を組み立てる。options にタイル（ダミー含む）、正解は correct_options の並び。 */
export function TilesInput({
  tiles,
  value,
  onChange,
  disabled,
}: {
  tiles: string[];
  value: string[] | undefined;
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const picked = value ?? [];
  // 同じ語が複数あっても扱えるように index で管理
  const pool = useMemo(() => tiles.map((t, i) => ({ t, i })), [tiles]);
  const usedCount: Record<string, number> = {};
  for (const p of picked) usedCount[p] = (usedCount[p] ?? 0) + 1;
  const seen: Record<string, number> = {};
  return (
    <div className="space-y-4">
      <div className="min-h-[64px] rounded-2xl border-2 border-dashed border-primary/40 p-3 flex flex-wrap gap-2 items-start">
        {picked.length === 0 && (
          <span className="text-xs text-muted-foreground">下のタイルをタップして文を作ろう</span>
        )}
        {picked.map((t, i) => (
          <button
            key={i}
            disabled={disabled}
            onClick={() => onChange(picked.filter((_, j) => j !== i))}
            className="px-3 py-2 rounded-xl border-2 border-b-4 border-primary/50 bg-primary/10 font-semibold text-sm active:translate-y-0.5 transition"
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {pool.map(({ t, i }) => {
          seen[t] = (seen[t] ?? 0) + 1;
          const used = seen[t] <= (usedCount[t] ?? 0);
          return (
            <button
              key={i}
              disabled={disabled || used}
              onClick={() => onChange([...picked, t])}
              className={`px-3 py-2 rounded-xl border-2 border-b-4 text-sm font-semibold transition active:translate-y-0.5 ${used ? "opacity-25 bg-muted" : "bg-card hover:border-primary"}`}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function speak(text: string, rate = 1) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  // 英字が多ければ英語、それ以外は日本語で読む
  u.lang = /[a-zA-Z]/.test(text) && !/[ぁ-んァ-ン一-龥]/.test(text) ? "en-US" : "ja-JP";
  window.speechSynthesis.speak(u);
}

/** 読み上げを聞いて答える。読み上げる文は audio_text（無ければ正解の最初の要素） */
export function ListenInput({
  speakText,
  value,
  onChange,
  disabled,
}: {
  speakText: string;
  value: string | undefined;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3 justify-center">
        <button
          type="button"
          onClick={() => speak(speakText)}
          className="h-20 w-20 rounded-3xl bg-primary text-primary-foreground grid place-items-center border-b-4 border-primary/60 active:translate-y-0.5"
          aria-label="再生"
        >
          <Volume2 className="h-9 w-9" />
        </button>
        <button
          type="button"
          onClick={() => speak(speakText, 0.55)}
          className="h-14 w-14 self-end rounded-2xl bg-secondary grid place-items-center border-b-4 active:translate-y-0.5"
          aria-label="ゆっくり再生"
        >
          <Snail className="h-6 w-6" />
        </button>
      </div>
      <Input
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="聞こえたとおりに入力"
      />
    </div>
  );
}

export function TrueFalseInput({
  value,
  onChange,
  disabled,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {["○", "×"].map((v) => (
        <button
          key={v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={`h-24 rounded-2xl border-2 border-b-4 text-4xl font-black transition active:translate-y-0.5 ${value === v ? "border-primary bg-primary/15 text-primary" : "bg-card"}`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/** 一問ごと採点の結果シート（画面下からスライド） */
export function ResultSheet({
  correct,
  correctAnswer,
  explanation,
  combo,
  onNext,
  nextLabel,
}: {
  correct: boolean | null;
  correctAnswer?: string;
  explanation?: string | null;
  combo: number;
  onNext: () => void;
  nextLabel: string;
}) {
  const good = correct === true;
  const bad = correct === false;
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t-2 animate-in slide-in-from-bottom duration-300 ${good ? "bg-success/15 border-success" : bad ? "bg-destructive/10 border-destructive" : "bg-muted border-border"} backdrop-blur`}
    >
      <div className="max-w-3xl mx-auto p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 space-y-1">
          <div
            className={`flex items-center gap-2 text-lg font-extrabold ${good ? "text-success" : bad ? "text-destructive" : ""}`}
          >
            {good ? <CircleCheck className="h-6 w-6" /> : bad ? <CircleX className="h-6 w-6" /> : null}
            {good ? pickPraise(combo) : bad ? "ここを押さえよう" : "採点結果"}
            {good && combo >= 2 && (
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-warning/20 text-warning px-2 py-0.5 text-xs">
                <Flame className="h-3.5 w-3.5" />
                {combo}連続
              </span>
            )}
          </div>
          {!good && correctAnswer && (
            <div className="text-sm">
              <span className="font-semibold">正解：</span>
              {correctAnswer}
            </div>
          )}
          {explanation && (
            <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
              {explanation}
            </div>
          )}
        </div>
        <Button
          size="lg"
          onClick={onNext}
          className={`sm:w-40 font-bold ${bad ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}`}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}

function pickPraise(combo: number) {
  if (combo >= 10) return "止まらない！";
  if (combo >= 5) return "絶好調！";
  if (combo >= 3) return "いい流れ！";
  return ["正解！", "ナイス！", "その通り！"][combo % 3];
}
