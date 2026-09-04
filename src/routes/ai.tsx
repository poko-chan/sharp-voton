import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicAmbient, PublicFooter, PublicHeader } from "@/components/public/PublicShell";

const URL = "https://sharp-voton.lovable.app/ai";
const TITLE = "AIの仕組み｜Study#";
const DESC =
  "Study# のAIは端末内で動くGemini Nano・ブラウザ内のWebLLM・パソコンのOllamaから選べます。何ができて、何ができないのかを正直に説明します。";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: AiPage,
});

const ENGINES = [
  {
    t: "Gemini Nano（Chrome内蔵）",
    d: "対応した Chrome / Edge に内蔵されたモデルを使います。モデルの取得と管理はブラウザ側が行うため、いちばん軽快に動きます。ブラウザや端末が対応していない場合は選択できません。",
  },
  {
    t: "WebLLM（ブラウザ内）",
    d: "モデルファイルをブラウザにダウンロードし、端末のGPU/CPUで実行します。初回はダウンロードに時間と通信量がかかりますが、以降はキャッシュから起動します。設定画面からモデルを選び、キャッシュを削除することもできます。",
  },
  {
    t: "Ollama（パソコン内）",
    d: "自分のパソコンで Ollama を動かしている場合、そこに入っているモデルをそのまま利用できます。用意しているモデルの一覧はアプリが自動で読み取ります。",
  },
];

const CAN = [
  "問題の考え方や解き方の手順を、順を追って説明する",
  "記述式の答案を観点ごとに採点し、改善点を示す（Makron）",
  "間違えた問題について、つまずいた原因と類題を提示する",
  "文章の要約・言い換え・確認クイズの作成",
];

const CANNOT = [
  "常に正しい答えを返すこと。AIは事実と異なる内容を、もっともらしく述べることがあります",
  "最新の出来事を把握すること。端末内モデルは学習時点までの知識しか持ちません",
  "端末の性能を超えた処理。小さなモデルほど、複雑な計算や長文の扱いは苦手です",
];

function AiPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <PublicAmbient />
      <PublicHeader width="max-w-4xl" />
      <main className="mx-auto max-w-4xl px-4 py-14 sm:py-20">
        <p className="section-eyebrow">AI</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight sm:text-5xl">
          Study# の<span className="text-gradient">AI</span>の仕組み
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Study# のAI機能は、できるだけ「あなたの端末の中」で動かすことを基本にしています。使えるエンジンは設定画面から選択でき、選んだエンジンに応じてモデルの一覧が表示されます。
        </p>
        <p className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm leading-relaxed">
          AIチャットは現在ベータ版です。回答内容は必ず自分で確かめてから使ってください。
        </p>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-black tracking-tight">3つのエンジン</h2>
          <div className="mt-4 space-y-3">
            {ENGINES.map((e) => (
              <article key={e.t} className="surface p-5">
                <h3 className="font-display font-extrabold">{e.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{e.d}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="surface p-5">
            <h2 className="font-display text-lg font-extrabold">できること</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              {CAN.map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="surface p-5">
            <h2 className="font-display text-lg font-extrabold">できないこと・注意点</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              {CANNOT.map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" aria-hidden />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="surface mt-10 p-6">
          <h2 className="font-display text-lg font-extrabold">参照するデータは自分で決められる</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            AIチャットでは「学習データを参照するか」「Web検索を使うか」をボタンで切り替えられます。オフにしている間、AIはその情報を受け取りません。回答の丁寧さ（速さ重視か、じっくり考えるか）も選べます。
          </p>
          <Link
            to="/features/$slug"
            params={{ slug: "ai-chat" }}
            className="mt-4 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            AIチャットの機能ページへ →
          </Link>
        </section>
      </main>
      <PublicFooter width="max-w-4xl" />
    </div>
  );
}
