import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

/** 新しい答え方の「かんたん入力」。draft の options / correct_options / accepted_answers を組み立てる。 */
export const EXTRA_TYPES = [
  { v: "true_false", l: "○×" },
  { v: "tiles", l: "単語タイル（文を組み立て）" },
  { v: "ordering", l: "並べ替え" },
  { v: "matching", l: "ペア合わせ" },
  { v: "fill_blank", l: "穴埋め（複数空欄）" },
  { v: "listen", l: "聞いて答える" },
  { v: "numeric", l: "数値" },
] as const;

export const AUTO_TYPES = [
  "single", "multi", "text", "ocr", "true_false", "tiles", "ordering", "matching",
  "fill_blank", "listen", "numeric",
];

function shuffle<T>(a: T[]) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function QuestionTypeEditor({ draft, setDraft }: { draft: any; setDraft: (d: any) => void }) {
  const t = draft.type;
  const co: string[] = draft.correct_options ?? [];
  const acc: string[] = draft.accepted_answers ?? [];
  const opts: string[] = draft.options ?? [];

  if (t === "true_false")
    return (
      <div className="space-y-1">
        <label className="text-xs">正解</label>
        <div className="flex gap-2">
          {["○", "×"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setDraft({ ...draft, options: ["○", "×"], correct_options: [v] })}
              className={`h-12 w-20 rounded-xl border-2 text-2xl font-black ${co[0] === v ? "border-primary bg-primary/10" : ""}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    );

  if (t === "tiles") {
    const dummies = opts.filter((o) => !co.includes(o));
    const rebuild = (correctText: string, dummyText: string) => {
      const c = correctText.split(/\s+/).filter(Boolean);
      const d = dummyText.split(/\s+/).filter(Boolean);
      setDraft({ ...draft, correct_options: c, options: shuffle([...c, ...d]) });
    };
    return (
      <div className="space-y-2">
        <div>
          <label className="text-xs">正解の文（タイルごとにスペースで区切る）</label>
          <Input
            defaultValue={co.join(" ")}
            placeholder="例: I have a pen"
            onBlur={(e) => rebuild(e.target.value, dummies.join(" "))}
          />
        </div>
        <div>
          <label className="text-xs">ひっかけタイル（任意・スペース区切り）</label>
          <Input
            defaultValue={dummies.join(" ")}
            placeholder="例: has an"
            onBlur={(e) => rebuild(co.join(" "), e.target.value)}
          />
        </div>
      </div>
    );
  }

  if (t === "ordering")
    return (
      <div>
        <label className="text-xs">正しい順番で1行ずつ入力（出題時はシャッフル）</label>
        <Textarea
          rows={4}
          defaultValue={co.join("\n")}
          onBlur={(e) => {
            const c = lines(e.target.value);
            setDraft({ ...draft, correct_options: c, options: shuffle(c) });
          }}
        />
      </div>
    );

  if (t === "matching")
    return (
      <div>
        <label className="text-xs">1行に「左 =&gt; 右」の形でペアを入力</label>
        <Textarea
          rows={4}
          placeholder={"りんご => apple\nねこ => cat"}
          defaultValue={acc.join("\n")}
          onBlur={(e) => {
            const pairs = lines(e.target.value).filter((l) => l.includes("=>"));
            setDraft({
              ...draft,
              accepted_answers: pairs,
              options: pairs.map((p) => p.split("=>")[0].trim()),
              correct_options: [],
            });
          }}
        />
      </div>
    );

  if (t === "fill_blank")
    return (
      <div>
        <label className="text-xs">
          問題文の空欄を「___」（アンダーバー2つ以上）で書き、答えを空欄の順に1行ずつ
        </label>
        <Textarea
          rows={3}
          defaultValue={acc.join("\n")}
          onBlur={(e) => setDraft({ ...draft, accepted_answers: lines(e.target.value), options: [], correct_options: [] })}
        />
      </div>
    );

  if (t === "listen")
    return (
      <div className="space-y-2">
        <div>
          <label className="text-xs">読み上げる文</label>
          <Input
            value={opts[0] ?? ""}
            onChange={(e) => setDraft({ ...draft, options: [e.target.value] })}
          />
        </div>
        <div>
          <label className="text-xs">正答（1行1つ。空白・句読点は無視。空なら読み上げ文が正解）</label>
          <Textarea
            rows={2}
            defaultValue={acc.join("\n")}
            onBlur={(e) => setDraft({ ...draft, accepted_answers: lines(e.target.value) })}
          />
        </div>
      </div>
    );

  if (t === "numeric")
    return (
      <div>
        <label className="text-xs">正解の数値（複数可、1行1つ）</label>
        <Textarea
          rows={2}
          defaultValue={acc.join("\n")}
          onBlur={(e) => setDraft({ ...draft, accepted_answers: lines(e.target.value) })}
        />
      </div>
    );

  return null;
}

/** 保存前の最終整形（聞いて答えるの正答補完など） */
export function finalizeDraft(d: any) {
  if (d.type === "listen" && !(d.accepted_answers ?? []).filter(Boolean).length && d.options?.[0])
    return { ...d, accepted_answers: [d.options[0]] };
  return d;
}
