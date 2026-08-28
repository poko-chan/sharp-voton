import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicAmbient, PublicFooter, PublicHeader } from "@/components/public/PublicShell";
import { STEPS, FAQ, SCENARIOS } from "@/content/services";

const TITLE = "使い方ガイド | Study#";
const DESC =
  "Study# のはじめ方を、アカウント作成から記録・Makron演習・AI復習・振り返りまでステップごとに解説。1日の使い方の例、タイプ別の使い方、よくある質問もまとめています。";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: "https://sharp-voton.lovable.app/guide" }],
  }),
  component: GuidePage,
});

const DAY = [
  {
    time: "朝",
    t: "今日やることを決める",
    d: "ダッシュボードで昨日までの積み上げと今日のミッションを確認。カレンダーの予定と照らして、無理のない量に調整します。所要1分。",
  },
  {
    time: "登校前・すきま",
    t: "パックを1つ解く",
    d: "Makronのパックは5〜10分で終わる量。通学中や休み時間に1つ解くだけで、頭が勉強モードに切り替わります。",
  },
  {
    time: "放課後",
    t: "タイマーを回して勉強",
    d: "ポモドーロで25分×数セット。使った教材を選んでおくと、あとで「どの本にどれだけ時間を使ったか」が分かります。",
  },
  {
    time: "夜",
    t: "間違いを直す",
    d: "Makronの直しリストとAI復習で、その日の誤答を潰します。分からないところはAIチャットへ。「ここまでは分かる」と書くと精度が上がります。",
  },
  {
    time: "週末",
    t: "振り返る",
    d: "ヒートマップと週次サマリーで、伸びた教科・落ちた教科をチェック。次週の目標に反映します。",
  },
];

const TIPS = [
  { t: "記録は「完璧」より「毎日」", d: "5分でも記録に残せば連続日数は途切れません。続いている実感が、いちばんの燃料になります。" },
  { t: "教材はとりあえず登録", d: "バーコードで数秒です。登録しておくと、タイマーや記録から選ぶだけで教材別の分析が貯まります。" },
  { t: "AIには「どこまで分かったか」を書く", d: "「ここまでは分かるが、ここで詰まった」と伝えると、解説の精度が大きく上がります。" },
  { t: "組織のコードは先生から", d: "学校や塾で使う場合は、6桁の参加コードか招待を受け取ってから参加します。" },
];

const FIRST_3 = [
  { n: "1", t: "タイマー", d: "押して、止める。それだけで記録になります。", to: "/timer" },
  { n: "2", t: "Makron", d: "パックを1つ選んで解く。誤答は自動で残ります。", to: "/makron" },
  { n: "3", t: "ダッシュボード", d: "積み上がりを眺める。ここが毎日の起点になります。", to: "/dashboard" },
];

function GuidePage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <PublicAmbient />
      <PublicHeader current="guide" width="max-w-5xl" />

      <main className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
        <p className="section-eyebrow">Guide</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight sm:text-5xl">
          はじめかた<span className="text-gradient">ガイド</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          機能が多いアプリですが、最初に触るのは3つだけで十分です。タイマー、Makron、ダッシュボード。
          慣れてきたら、目標・教材・組織へ広げていきましょう。
        </p>

        {/* まず触る3つ */}
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {FIRST_3.map((f) => (
            <div key={f.n} className="surface surface-hover p-5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/12 font-display font-black text-primary">
                {f.n}
              </span>
              <h2 className="mt-3 font-display text-lg font-extrabold">{f.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">5ステップで走り出す</h2>
          <ol className="mt-6 space-y-3">
            {STEPS.map((s) => (
              <li key={s.n} className="surface flex gap-4 p-5">
                <div className="font-display text-2xl font-black text-gradient">{s.n}</div>
                <div>
                  <h3 className="font-bold">{s.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">1日の使い方の例</h2>
          <p className="mt-2 text-sm text-muted-foreground">全部やる必要はありません。できる時間帯だけで十分です。</p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {DAY.map((d) => (
              <article key={d.time} className="surface surface-hover p-5">
                <span className="chip">{d.time}</span>
                <h3 className="mt-3 font-bold">{d.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d.d}</p>
              </article>
            ))}
          </div>
        </section>

        {/* タイプ別 */}
        <section className="mt-16">
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">タイプ別・実際の使い方</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            自分に近い状況を選んで、そのまま真似してみてください。
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {SCENARIOS.map((s) => (
              <article key={s.who} className="surface p-6">
                <h3 className="font-display text-lg font-extrabold">{s.who}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.situation}</p>
                <ol className="mt-4 space-y-2">
                  {s.flow.map((f, i) => (
                    <li key={f} className="flex gap-3 text-sm">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/12 text-[10px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 rounded-xl bg-accent/12 p-3 text-sm font-semibold leading-relaxed">{s.result}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">続けるためのコツ</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {TIPS.map((t) => (
              <article key={t.t} className="surface p-5">
                <h3 className="font-bold">{t.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.d}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">よくある質問</h2>
          <div className="surface mt-6 divide-y divide-border/60 overflow-hidden">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-5 transition hover:bg-muted/40">
                <summary className="flex cursor-pointer list-none items-start gap-2 font-semibold">
                  <span className="text-primary">Q.</span>
                  <span className="flex-1">{f.q}</span>
                  <span className="text-muted-foreground transition group-open:rotate-45">＋</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            さらに詳しいQ&amp;Aは{" "}
            <Link to="/help" className="text-primary underline-offset-4 hover:underline">
              ヘルプページ
            </Link>{" "}
            にまとめています。
          </p>
        </section>

        <div className="surface mt-16 p-8 text-center">
          <h2 className="font-display text-2xl font-black">まずは、タイマーを1回。</h2>
          <p className="mt-3 text-sm text-muted-foreground">今日の5分が、明日の記録になります。</p>
          <Link to="/login" className="cta mt-6">
            無料ではじめる
          </Link>
        </div>
      </main>

      <PublicFooter width="max-w-5xl" />
    </div>
  );
}
