import { createFileRoute, Link } from "@tanstack/react-router";
import logoUrl from "@/assets/logo.png";
import { STEPS, FAQ } from "@/content/services";

const TITLE = "使い方ガイド | StudyΩ（Voton Study Omega）";
const DESC =
  "StudyΩ のはじめ方を、アカウント作成から記録・Makron演習・AI復習・振り返りまでステップごとに解説。1日の使い方の例やよくある質問もまとめています。";

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
    links: [{ rel: "canonical", href: "https://study-plus-voton.lovable.app/guide" }],
  }),
  component: GuidePage,
});

const DAY = [
  { time: "朝", t: "今日やることを決める", d: "ダッシュボードで昨日までの積み上げと今日のミッションを確認。カレンダーの予定と照らして、無理のない量に調整します。" },
  { time: "登校前・すきま", t: "デイリー演習10問", d: "全員共通の10問で頭を起こします。連続日数が伸びるので、まずここだけでも触るのがおすすめです。" },
  { time: "放課後", t: "タイマーを回して勉強", d: "ポモドーロで25分×数セット。使った教材を選んでおくと、あとで「どの本にどれだけ時間を使ったか」が分かります。" },
  { time: "夜", t: "間違いを直す", d: "Makronの復習リストとAI復習で、その日の誤答を潰します。分からないところはAIチャットへ。" },
  { time: "週末", t: "振り返る", d: "ヒートマップと週次サマリーで、伸びた教科・落ちた教科をチェック。次週の目標に反映します。" },
];

const TIPS = [
  { t: "記録は「完璧」より「毎日」", d: "5分でも記録に残すと、ストリークが途切れません。続いている実感が、いちばんの燃料になります。" },
  { t: "教材はとりあえず登録", d: "バーコードで数秒です。登録しておくと、タイマーや記録から選ぶだけで教材別の分析が貯まります。" },
  { t: "AIには「どこまで分かったか」を書く", d: "「ここまでは分かるが、ここで詰まった」と伝えると、解説の精度が大きく上がります。" },
  { t: "組織のコードは先生から", d: "学校や塾で使う場合は、6桁の参加コードか招待を受け取ってから参加します。" },
];

function GuidePage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -right-32 -top-40 h-[24rem] w-[24rem] rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute -left-24 top-1/2 h-[20rem] w-[20rem] rounded-full bg-primary/20 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-40 border-b liquid-bar">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoUrl} alt="StudyΩ" width={32} height={32} className="h-8 w-8 rounded-xl" />
            <span className="font-display font-extrabold tracking-tight">Study<span className="text-gradient">Ω</span></span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/all-services" className="hidden rounded-full px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-block">全機能</Link>
            <Link to="/for-schools" className="hidden rounded-full px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-block">学校・塾の方へ</Link>
            <Link to="/login" className="cta px-5 py-2 text-sm">はじめる</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
        <p className="section-eyebrow">Guide</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight sm:text-5xl">
          はじめかた<span className="text-gradient">ガイド</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          機能が多いアプリですが、最初に触るのは3つだけで十分です。タイマー、デイリー演習、ダッシュボード。
          慣れてきたら、目標・教材・組織へ広げていきましょう。
        </p>

        <section className="mt-14">
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
            さらに詳しいQ&amp;Aは <Link to="/help" className="text-primary underline-offset-4 hover:underline">ヘルプページ</Link> にまとめています。
          </p>
        </section>

        <div className="surface mt-16 p-8 text-center">
          <h2 className="font-display text-2xl font-black">まずは、タイマーを1回。</h2>
          <Link to="/login" className="cta mt-6">無料ではじめる</Link>
        </div>
      </main>

      <footer className="border-t border-border/50 py-10 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-4 px-4">
          <Link to="/" className="transition hover:text-foreground">トップ</Link>
          <Link to="/all-services" className="transition hover:text-foreground">全機能</Link>
          <Link to="/for-schools" className="transition hover:text-foreground">学校・塾の方へ</Link>
          <Link to="/help" className="transition hover:text-foreground">ヘルプ</Link>
        </div>
      </footer>
    </div>
  );
}
