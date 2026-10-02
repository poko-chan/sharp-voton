import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicAmbient, PublicFooter, PublicHeader } from "@/components/public/PublicShell";

const URL = "https://sharp-voton.lovable.app/ai-vision";
const TITLE = "これからのAI｜ひとつのプラットフォームが、ひとつの情報をつくる｜Study#";
const DESC =
  "Study# に蓄積された学習時間・演習・教材・目標・連絡のすべてを、将来AIが横断して分析します。現在AI機能を一時停止している理由と、今後の構想をお伝えします。";

export const Route = createFileRoute("/ai-vision")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: AiVisionPage,
});

const SOURCES = [
  ["学習記録・タイマー", "いつ、何を、どれだけ学んだか"],
  ["Makron 演習", "どの単元で、どの問題を、どう間違えたか"],
  ["教材データベース", "どの教材が、どれだけ成果につながったか"],
  ["目標・カレンダー・試験", "計画と実績の差、試験までの残り時間"],
  ["組織・クラス", "授業の配信、提出、3観点評価"],
  ["保護者連携", "家庭での学習時間、利用制限、ミッション"],
];

const PHASES = [
  {
    k: "現在",
    t: "データ統合の基盤づくり",
    d: "AI機能は一時停止しています。どのような形で提供すべきかを慎重に検討している段階であり、その間も学習データは一つの基盤へ正確に蓄積され続けます。",
  },
  {
    k: "次の段階",
    t: "横断分析",
    d: "学習時間・正答率・教材・計画を結び付け、「なぜ伸びたのか」「どこで止まっているのか」を一人ひとりに対して明らかにします。",
  },
  {
    k: "将来",
    t: "学習者の全体像にもとづく支援",
    d: "本人・先生・保護者それぞれに、同じ事実から、立場に応じた提案を届けます。分断されたツールでは実現できない支援です。",
  },
];

const PRINCIPLES = [
  "分析対象は本人・所属組織・連携した保護者の権限の範囲に限定します",
  "学習データをAIモデルの学習に無断で利用しません",
  "AIの提案は判断材料であり、最終判断は常に人が行います",
  "提供方式が確定するまで、AI機能は再開しません",
];

function AiVisionPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <PublicAmbient />
      <PublicHeader width="max-w-5xl" />
      <main className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
        <p className="section-eyebrow">Vision</p>
        <h1 className="mt-2 font-display text-4xl font-black leading-tight tracking-tight sm:text-6xl">
          ひとつの情報になるために、
          <br />
          <span className="text-gradient">ひとつのプラットフォーム</span>になる。
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground">
          ドリル、タイマー、連絡帳、成績表。道具が分かれている限り、学習者の姿はばらばらの断片としてしか見えません。Study#
          は学びに関わるすべてを一つの基盤に集め、将来、AIがそれらを横断して分析できる状態をつくります。
        </p>

        <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-sm leading-relaxed">
          <p className="font-semibold text-primary">AI機能の現状について</p>
          <p className="mt-1 text-muted-foreground">
            現在、AI機能は一時停止しています。今後どのような形で提供するかを検討中のためです。再開時期と方式は決まり次第お知らせします。
          </p>
        </div>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-extrabold">AIが読み解く、Study# のデータ</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SOURCES.map(([t, d]) => (
              <div key={t} className="rounded-2xl border bg-card/70 p-5 backdrop-blur">
                <p className="font-semibold">{t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            これらは別々のサービスではなく、同じ一つのデータベース上でつながっています。
          </p>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-extrabold">ロードマップ</h2>
          <ol className="mt-6 space-y-4">
            {PHASES.map((p) => (
              <li key={p.k} className="flex gap-4 rounded-2xl border bg-card/70 p-5">
                <span className="h-fit shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {p.k}
                </span>
                <div>
                  <p className="font-semibold">{p.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-extrabold">私たちの約束</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <li key={p} className="rounded-2xl border bg-card/70 p-5 text-sm leading-relaxed">
                {p}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-16 flex flex-wrap gap-3">
          <Link
            to="/for-schools"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            学校・組織向けの導入
          </Link>
          <Link
            to="/all-services"
            className="rounded-full border px-5 py-2.5 text-sm font-semibold"
          >
            すべての機能を見る
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
