import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import logoUrl from "@/assets/logo.png";

const TITLE = "Voton Study Omega（StudyΩ）— 学習のすべてを、ひとつに。";
const DESC =
  "StudyΩ は勉強記録・集中タイマー・カレンダー・Makron問題演習・AI家庭教師・目標管理・組織/学校運営までを1つにまとめたオールインワン学習プラットフォームです。";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: "https://study-plus-voton.lovable.app/" }],
  }),
  component: LandingRoute,
});

/**
 * "/" は公開ランディングページだが、
 * - ログイン済み → /dashboard
 * - 認証コールバック（メール認証・OAuth の戻り先） → /login
 * へ転送する。以前 "/" が /login に飛んでいた前提の導線を維持するため。
 */
function LandingRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    const raw = window.location.hash.slice(1) + "&" + window.location.search.slice(1);
    if (/(^|&)(access_token|refresh_token|code|token_hash|type|error|error_description)=/.test(raw)) {
      navigate({ to: "/login", replace: true });
    }
  }, [user, loading, navigate]);

  return <LandingPage />;
}

type Feature = {
  emoji: string;
  name: string;
  lead: string;
  detail: string;
  points: string[];
  path: string;
};

const CORE: Feature[] = [
  {
    emoji: "📊",
    name: "ダッシュボード",
    lead: "今日の自分が、5秒でわかる。",
    detail:
      "今日の学習時間、教科別の内訳、連続学習日数、レベルと経験値、コイン残高、直近のミッション達成状況をひとつの画面に集約します。ウィジェットは並び替え・表示/非表示を自由に設定でき、自分の学習スタイルに合わせた「司令塔」を作れます。",
    points: ["教科別の円グラフと週次の増減比較", "連続記録（ストリーク）とレベル進捗", "ウィジェットのカスタマイズ"],
    path: "/dashboard",
  },
  {
    emoji: "⏱️",
    name: "集中タイマー",
    lead: "測るだけで、記録になる。",
    detail:
      "ストップウォッチ・ポモドーロ（25分集中＋5分休憩）・カウントダウンを切り替えて使えます。計測した時間はそのまま学習記録に保存され、使っていた教材を紐づけることも可能。環境音（雨・カフェ・ホワイトノイズ）や、自分でアップロードしたBGMを流しながら集中できます。",
    points: ["ポモドーロ統計とセッション履歴", "環境音ミキサー／BGMアップロード", "計測から記録への自動保存"],
    path: "/timer",
  },
  {
    emoji: "📝",
    name: "勉強記録",
    lead: "続けるほど、データが味方になる。",
    detail:
      "教科・内容・時間・使用教材・振り返りメモをまとめて記録。過去の記録はヒートマップやグラフで可視化され、「どの教科をいつ、どれだけやったか」が一目でわかります。記録は共有リンクやCSVでの書き出しにも対応。",
    points: ["ヒートマップ／週次・月次グラフ", "複数教材の紐づけ", "CSVエクスポートと共有リンク"],
    path: "/study",
  },
  {
    emoji: "🧠",
    name: "Makron（問題演習）",
    lead: "解く・間違える・直す、の完全サイクル。",
    detail:
      "教科 → 分野 → 単元 → パックの階層で整理された問題集を演習できます。選択式・記述式に対応し、記述はAIが観点別に採点。シャッフル、出題数制限、一問ごと採点モードなど演習設定も細かく選べます。毎日全員共通の「デイリー演習（10問）」もあり、連続記録を伸ばす習慣づくりに最適です。",
    points: ["公式パックは報酬コイン付き（日次上限あり）", "デイリー演習とストリーク", "間違えた問題の復習・直しリスト"],
    path: "/makron",
  },
  {
    emoji: "🤖",
    name: "AI家庭教師",
    lead: "わからないを、その場で解消。",
    detail:
      "24時間いつでも質問できるAI家庭教師。回答は生成しながらリアルタイムで表示されるので、待たされる感覚がありません。端末内で動くGemini Nanoを優先的に使い、使えない環境ではブラウザ内モデル、さらにクラウドAIへと自動でフォールバックします。",
    points: ["ストリーミング表示", "端末内AI優先でプライバシーに配慮", "誤答の原因分析と類題提案"],
    path: "/tutor",
  },
  {
    emoji: "🎯",
    name: "学習目標・試験トラッカー",
    lead: "ゴールから逆算して積み上げる。",
    detail:
      "「〇月〇日の試験まで、この教科を何時間」といった目標を設定し、達成率を自動計算。試験ごとに目標点・やることリストを作り、結果を入力すれば複数回の試験の推移をグラフで比較できます。やることリストを完了させるとコイン報酬も獲得できます。",
    points: ["目標達成率の自動計算", "試験結果の推移グラフ", "タスク完了で報酬"],
    path: "/goals",
  },
];

const MORE: Feature[] = [
  {
    emoji: "🏫",
    name: "組織（学校・塾・チーム）",
    lead: "アプリランチャー型の組織ポータル。",
    detail:
      "参加コードや招待から組織に参加し、投稿・共有カレンダー・チャット・アンケート・課題・デジタル学生証・名簿などをアプリのように使えます。経営者／共同管理者／教師／一般の4段階の役割で権限を制御し、組織内だけの学年・クラスといったプロフィール項目を年度ごとに管理できます。",
    points: ["役割ベースの管理メニュー", "期限つき課題と提出状況の統計", "組織内一括のサービス制限"],
    path: "/organizations",
  },
  {
    emoji: "🎓",
    name: "Makron for education",
    lead: "学校専用の教材を、学年別に。",
    detail:
      "組織の中だけで使う専用問題集。学年やクラスなど組織プロフィールの項目に応じて出題を切り替えられ、Duolingo風のカリキュラム・パスで進捗が見えます。間違えた問題は「AI復習」タブでつまずいた原因・解き方の手順・類題まで解説します。",
    points: ["属性による出題フィルタ", "レベル制・進捗ダッシュボード", "AI復習タブ"],
    path: "/organizations",
  },
  {
    emoji: "📅",
    name: "カレンダー",
    lead: "予定と学習を、同じ地図の上に。",
    detail: "月グリッドと時間単位のビューで予定・イベント・試験日を管理。学習計画と予定を同じ場所で確認できます。",
    points: ["月／週／日ビュー", "試験日・課題期限の表示", "共有カレンダー（組織）"],
    path: "/calendar",
  },
  {
    emoji: "📚",
    name: "教材データベース",
    lead: "持っている参考書を、資産に変える。",
    detail:
      "バーコードスキャンやカメラから教材を登録し、進捗・お気に入り・利用時間を管理。どの教材にどれだけ時間を使ったかを分析できます。",
    points: ["バーコード／カメラ登録", "教材別の利用時間分析", "お気に入りと進捗管理"],
    path: "/materials",
  },
  {
    emoji: "🪙",
    name: "ゲーミフィケーション",
    lead: "続けるほど、世界が育つ。",
    detail:
      "学習でXPとコインを獲得し、レベルアップ。ショップでアイテムやアバターフレームを購入し、インベントリで使う・売る・贈るができます。街づくりシミュレーションやランキング、ミッション、称号も用意しています。",
    points: ["ショップ／インベントリ／ギフト", "ミッションと称号", "ランキングと街の成長"],
    path: "/shop",
  },
  {
    emoji: "💬",
    name: "ソーシャル",
    lead: "ひとりで頑張らない。",
    detail:
      "タイムラインに勉強記録をシェアして、いいねやコメントで励まし合えます。フレンド、ユーザー間チャット、リーダーボードで仲間と一緒に続けられます。",
    points: ["勉強記録のシェアと反応", "フレンド／チャット", "ランキング"],
    path: "/feed",
  },
  {
    emoji: "👨‍👩‍👧",
    name: "保護者モード",
    lead: "見守る人のための、専用画面。",
    detail: "保護者アカウントでは学習ページの代わりに、お子さまの直近90日の学習ログを詳細に確認できます。",
    points: ["90日分の詳細ログ", "教科別の推移", "保護者専用のナビゲーション"],
    path: "/parent",
  },
  {
    emoji: "🔒",
    name: "安心して使うために",
    lead: "制限・メンテナンス・復旧まで。",
    detail:
      "管理者はサービスごとの利用制限やメンテナンスモードを設定でき、アカウント削除は7日間の猶予つき。パスワードを忘れた場合の復旧フローも用意しています。",
    points: ["サービス単位の利用制限", "アカウント復旧フロー", "削除の7日間猶予"],
    path: "/help",
  },
];

const STEPS = [
  { n: "01", t: "アカウントを作る", d: "ユーザー名とパスワード、またはGoogleで数十秒。組織に招待されている場合は参加コードでそのまま合流できます。" },
  { n: "02", t: "測る・記録する", d: "タイマーを回して勉強するだけで、時間と教科が自動で記録に残ります。教材を紐づければ分析の精度も上がります。" },
  { n: "03", t: "Makronで解く", d: "デイリー演習10問から始めて、苦手な単元のパックへ。間違えた問題は自動で復習リストに積み上がります。" },
  { n: "04", t: "AIに聞く・直す", d: "わからない問題はAI家庭教師へ。つまずいた原因と手順、類題まで提示して次につなげます。" },
  { n: "05", t: "積み上がりを見る", d: "ダッシュボードとヒートマップで進みを確認。XP・コイン・ストリークが、続ける理由になります。" },
];

const FAQ = [
  { q: "無料で使えますか？", a: "主要な機能は無料で利用できます。一部の高負荷なクラウドAI機能には制限が設けられる場合があります。" },
  { q: "スマートフォンでも使えますか？", a: "はい。レスポンシブ対応に加え、ホーム画面に追加してアプリのように使えるPWAに対応しています。" },
  { q: "学校や塾で導入できますか？", a: "組織機能で名簿・課題・お知らせ・アンケート・組織専用教材まで運用できます。組織の作成は運営の承認制です。" },
  { q: "AIは何を使っていますか？", a: "端末内で動作するGemini Nanoを優先し、利用できない環境ではブラウザ内モデル、さらにクラウドAIへ自動的に切り替えます。" },
  { q: "データは削除できますか？", a: "設定画面からアカウント削除を申請でき、7日間の猶予期間中はキャンセルできます。詳しくはプライバシーポリシーをご覧ください。" },
];

function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-32 -top-40 h-[26rem] w-[26rem] rounded-full bg-primary/25 blur-[120px]" />
        <div className="absolute -right-24 top-1/4 h-[22rem] w-[22rem] rounded-full bg-accent/25 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[20rem] w-[20rem] rounded-full bg-chart-4/20 blur-[130px]" />
      </div>

      <header className="sticky top-0 z-40 border-b liquid-bar">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="Voton Study Omega ロゴ" width={36} height={36} className="h-9 w-9 rounded-xl shadow-sm" />
            <span className="font-display text-lg font-extrabold tracking-tight">
              Study<span className="text-gradient">Ω</span>
            </span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <a href="#features" className="hidden rounded-full px-3.5 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-block">機能</a>
            <a href="#how" className="hidden rounded-full px-3.5 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-block">使い方</a>
            <a href="#faq" className="hidden rounded-full px-3.5 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-block">FAQ</a>
            <Link to="/login" className="cta px-5 py-2 text-sm">はじめる</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative">
          <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:py-28">
            <span className="chip">Voton Study Omega — 旧 Voton Study+</span>
            <h1 className="mx-auto mt-6 max-w-4xl font-display text-[2.5rem] font-black leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
              学習のすべてを、<span className="text-gradient">ひとつに</span>。
              <span className="mt-2 block text-2xl font-extrabold text-muted-foreground sm:text-3xl">StudyΩ</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground sm:text-lg">
              記録する。集中する。解く。AIに聞く。仲間と続ける。学校や塾で運用する。
              バラバラだった学習の道具を、StudyΩ はひとつのプラットフォームにまとめました。
            </p>
            <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link to="/login" className="cta">無料ではじめる</Link>
              <a href="#features" className="cta-ghost">機能をぜんぶ見る</a>
            </div>
            <dl className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {[
                ["20+", "搭載サービス"],
                ["10問", "毎日のデイリー演習"],
                ["24h", "AI家庭教師"],
                ["4段階", "組織の役割管理"],
              ].map(([v, l]) => (
                <div key={l} className="surface p-4 text-left sm:text-center">
                  <dt className="font-display text-2xl font-black text-gradient sm:text-3xl">{v}</dt>
                  <dd className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Core features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:py-24">
          <p className="section-eyebrow">Features</p>
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">主要機能</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            毎日の学習を回すために必要なものを、最初からすべて用意しています。
          </p>
          <div className="mt-10 grid gap-4 sm:gap-5 md:grid-cols-2">
            {CORE.map((f) => (
              <article key={f.name} className="surface surface-hover p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-2xl" aria-hidden>{f.emoji}</span>
                  <h3 className="font-display text-xl font-extrabold">{f.name}</h3>
                </div>
                <p className="mt-3 font-semibold text-primary">{f.lead}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.detail}</p>
                <ul className="mt-4 space-y-1.5 text-sm">
                  {f.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span className="text-accent-foreground/70">✓</span>
                      <span className="text-muted-foreground">{p}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <h2 className="mt-20 font-display text-3xl font-black tracking-tight sm:text-4xl">さらに、こんなことも</h2>
          <div className="mt-10 grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {MORE.map((f) => (
              <article key={f.name} className="surface surface-hover p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-xl" aria-hidden>{f.emoji}</span>
                  <h3 className="font-display text-lg font-extrabold">{f.name}</h3>
                </div>
                <p className="mt-2 text-sm font-semibold text-primary">{f.lead}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.detail}</p>
                <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
                  {f.points.map((p) => (
                    <li key={p}>・{p}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-y border-border/50 bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
            <p className="section-eyebrow">How it works</p>
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">使い方は、5ステップ</h2>
            <ol className="mt-10 grid gap-4 sm:gap-5 md:grid-cols-5">
              {STEPS.map((s) => (
                <li key={s.n} className="surface p-5">
                  <div className="font-display text-2xl font-black text-gradient">{s.n}</div>
                  <h3 className="mt-2 font-bold">{s.t}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Who */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="section-eyebrow">For you</p>
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">こんな人のために</h2>
          <div className="mt-10 grid gap-4 sm:gap-5 md:grid-cols-3">
            {[
              { t: "受験生・中高生", d: "試験日から逆算した目標設定、苦手単元の演習、記録の可視化まで。今日やるべきことが毎朝はっきりします。" },
              { t: "学校・塾の先生", d: "名簿・課題・お知らせ・アンケート・組織専用教材を一箇所で運用。生徒の学習量と提出状況を数字で把握できます。" },
              { t: "保護者", d: "保護者モードで、お子さまの学習ログを見守れます。過度な干渉なしに、続いているかどうかがわかります。" },
            ].map((c) => (
              <div key={c.t} className="surface surface-hover p-6">
                <h3 className="font-display text-lg font-extrabold">{c.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-border/50 bg-muted/20">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
            <p className="section-eyebrow">FAQ</p>
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">よくある質問</h2>
            <div className="surface mt-8 divide-y divide-border/60 overflow-hidden">
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
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="surface relative overflow-hidden px-6 py-14 text-center">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_50%_0%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_70%)]" />
            <div className="relative">
              <h2 className="font-display text-3xl font-black tracking-tight sm:text-4xl">今日から、<span className="text-gradient">StudyΩ</span>。</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
                まずは1回、タイマーを回すところから。積み上がった記録が、次の自分を連れてきます。
              </p>
              <Link to="/login" className="cta mt-8">無料ではじめる</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="" width={24} height={24} loading="lazy" className="h-6 w-6 rounded-md" />
            <span>Voton Study Omega（StudyΩ）</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/help" className="transition hover:text-foreground">ヘルプ</Link>
            <Link to="/terms" className="transition hover:text-foreground">利用規約</Link>
            <Link to="/privacy" className="transition hover:text-foreground">プライバシーポリシー</Link>
            <Link to="/login" className="transition hover:text-foreground">ログイン</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
