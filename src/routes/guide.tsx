import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicAmbient, PublicFooter, PublicHeader } from "@/components/public/PublicShell";
import { CORE, MORE, STEPS, FAQ, SCENARIOS } from "@/content/services";

const TITLE = "Voton Study Sharp (Study#) の使い方ガイド | 学習のすべてをひとつに";
const DESC =
  "Voton Study Sharp（Study# / Study Sharp / Voton Study）のはじめ方を、アカウント作成から記録・Makron演習・AI復習・振り返りまで解説。学習のすべてをひとつにする総合学習プラットフォームの使い方ガイドです。";

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
  {
    t: "記録は「完璧」より「毎日」",
    d: "5分でも記録に残せば連続日数は途切れません。続いている実感が、いちばんの燃料になります。",
  },
  {
    t: "教材はとりあえず登録",
    d: "バーコードで数秒です。登録しておくと、タイマーや記録から選ぶだけで教材別の分析が貯まります。",
  },
  {
    t: "AIには「どこまで分かったか」を書く",
    d: "「ここまでは分かるが、ここで詰まった」と伝えると、解説の精度が大きく上がります。",
  },
  {
    t: "組織のコードは先生から",
    d: "学校や塾で使う場合は、6桁の参加コードか招待を受け取ってから参加します。",
  },
];

const FIRST_3 = [
  { n: "1", t: "タイマー", d: "押して、止める。それだけで記録になります。", to: "/timer" },
  { n: "2", t: "Makron", d: "パックを1つ選んで解く。誤答は自動で残ります。", to: "/makron" },
  {
    n: "3",
    t: "ダッシュボード",
    d: "積み上がりを眺める。ここが毎日の起点になります。",
    to: "/dashboard",
  },
];

const GUIDE_LENSES = [
  {
    label: "記録",
    title: "勉強した事実を残す",
    body: "タイマーや勉強記録で、教科・時間・教材・メモをあとから振り返れる形にします。最初から細かく入力せず、まずは時間だけ残しても構いません。",
    tone: "border-signal/35 bg-signal/10",
  },
  {
    label: "理解",
    title: "解いて、つまずきを見つける",
    body: "Makronでは教科・分野・単元・パックの順に問題を選べます。誤答は復習の入口になり、解きっぱなしを減らせます。",
    tone: "border-accent/35 bg-accent/10",
  },
  {
    label: "継続",
    title: "今週の自分を見直す",
    body: "ダッシュボード、ヒートマップ、週次サマリーを使って、できたことと次に取り組むことを確認します。数字は評価ではなく、次の計画を作る材料です。",
    tone: "border-primary/25 bg-primary/10",
  },
];

const REALITY_CHECKS = [
  {
    title: "AIの回答は確認しながら使う",
    body: "AIチャットやAI採点は学習を助ける機能です。回答や講評が常に正しいとは限らないため、教科書・先生・公式資料と照らし合わせて利用してください。",
  },
  {
    title: "使えるAIは環境で変わる",
    body: "端末やブラウザによって利用できるAIが異なります。Study#は利用可能な方式を順に試しますが、クラウドAIが必要な機能や回数制限が発生する場合があります。",
  },
  {
    title: "全部を毎日使う必要はない",
    body: "タイマーだけ、記録だけ、問題を1パックだけでも十分です。機能を増やすのは、今の勉強の流れに必要になったときで構いません。",
  },
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
          Voton Study Sharp（Study# / Study Sharp / Voton
          Study）は、学習のすべてをひとつにする総合学習プラットフォームです。
          学習を賢く、楽しく続けるために、最初に触るのはタイマー、Makron、ダッシュボードの3つだけで十分です。
          慣れてきたら、目標・教材・組織へ広げていきましょう。
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Study#のサービスコンセプト">
          <p className="rounded-xl border border-signal/35 bg-signal/10 px-4 py-3 text-sm font-bold">
            学習のすべてをひとつに
          </p>
          <p className="rounded-xl border border-accent/35 bg-accent/10 px-4 py-3 text-sm font-bold">
            学習を賢く、楽しく
          </p>
          <p className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-bold">
            総合学習プラットフォーム
          </p>
        </div>

        <section className="ink-panel mt-8 overflow-hidden p-6 text-white sm:p-8" aria-labelledby="guide-overview">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/60">Start small, keep the context</p>
              <h2 id="guide-overview" className="mt-3 max-w-xl font-display text-2xl font-black leading-tight sm:text-3xl">
                ひとつの機能から始めて、必要なところだけ広げる
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/72">
                Study#は、勉強時間の記録、問題演習、AI、目標、組織向けの機能を同じアカウントで扱えるウェブアプリです。
                すべてを一度に設定する必要はありません。今日の行動を残し、あとで見直すところから始められます。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-white/15 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div>
                <strong className="font-display text-2xl font-black">3</strong>
                <p className="mt-1 text-xs leading-relaxed text-white/60">最初に触る入口</p>
              </div>
              <div>
                <strong className="font-display text-2xl font-black">5</strong>
                <p className="mt-1 text-xs leading-relaxed text-white/60">導入ステップ</p>
              </div>
              <div>
                <strong className="font-display text-2xl font-black">1</strong>
                <p className="mt-1 text-xs leading-relaxed text-white/60">学習の流れ</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16" aria-labelledby="guide-lenses">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="section-eyebrow">A simple loop</p>
              <h2 id="guide-lenses" className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
                Study#の使い方を3つの視点で見る
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              記録したものを見返し、次の一手を決める。その繰り返しを、使う機能に合わせて組み立てます。
            </p>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {GUIDE_LENSES.map((item, index) => (
              <article key={item.label} className={`rounded-2xl border p-5 ${item.tone}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="chip bg-background/70">0{index + 1} / {item.label}</span>
                </div>
                <h3 className="mt-5 font-display text-lg font-extrabold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

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
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            5ステップで走り出す
          </h2>
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

        <section className="mt-16" aria-labelledby="guide-features">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="section-eyebrow">What is inside</p>
              <h2 id="guide-features" className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
                できることを、役割ごとに
              </h2>
            </div>
            <Link to="/all-services" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
              全機能一覧を見る →
            </Link>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {CORE.map((feature) => (
              <article key={feature.name} className="surface surface-hover p-5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl" aria-hidden="true">{feature.emoji}</span>
                  <div>
                    <h3 className="font-display text-lg font-extrabold">{feature.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-primary">{feature.lead}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{feature.detail}</p>
                <ul className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  {feature.points.map((point) => <li key={point} className="rounded-lg bg-muted/60 px-3 py-2">{point}</li>)}
                </ul>
              </article>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {MORE.slice(0, 3).map((feature) => (
              <article key={feature.name} className="rounded-2xl border border-border/70 bg-background/65 p-4">
                <span className="text-xl" aria-hidden="true">{feature.emoji}</span>
                <h3 className="mt-3 font-bold">{feature.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{feature.lead}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            1日の使い方の例
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            全部やる必要はありません。できる時間帯だけで十分です。
          </p>
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

        <section className="mt-16" aria-labelledby="guide-reality">
          <div className="border-l-4 border-signal pl-5">
            <p className="section-eyebrow">Use it well</p>
            <h2 id="guide-reality" className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
              先に知っておきたいこと
            </h2>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {REALITY_CHECKS.map((item) => (
              <article key={item.title} className="surface p-5">
                <h3 className="font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* タイプ別 */}
        <section className="mt-16">
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            タイプ別・実際の使い方
          </h2>
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
                <p className="mt-4 rounded-xl bg-accent/12 p-3 text-sm font-semibold leading-relaxed">
                  {s.result}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            続けるためのコツ
          </h2>
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
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            よくある質問
          </h2>
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
