import { createFileRoute, Link } from "@tanstack/react-router";
import { OrgApplyForm } from "@/components/org/OrgApplyForm";
import { PublicAmbient, PublicFooter, PublicHeader } from "@/components/public/PublicShell";
import { SCHOOL_OBJECTIONS, SCHOOL_OUTCOMES, TRUST } from "@/content/services";

const TITLE = "学校・塾の方へ（組織機能） | Study#";
const DESC =
  "Study# の組織機能なら、お知らせ・課題・アンケート・チャット・共有カレンダー・組織専用教材までを1つのポータルで運用できます。学年やクラスは年度単位で管理。導入は申請・承認制です。";

export const Route = createFileRoute("/for-schools")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: "https://sharp-voton.lovable.app/for-schools" }],
  }),
  component: ForSchoolsPage,
});

const APPS = [
  {
    emoji: "📢",
    t: "投稿・お知らせ",
    d: "グループ（チャンネル）ごとに投稿。ピン留め・検索・並び替え・編集/削除に対応し、ファイルも添付できます。学年だけ、クラスだけへの配信も可能です。",
  },
  {
    emoji: "📝",
    t: "課題",
    d: "期限と必須設定つきで配信。提出状況を一覧と統計で把握できます。小テストの正答はサーバー側で採点し、答えは生徒の端末に送られません。",
  },
  {
    emoji: "🗳️",
    t: "アンケート",
    d: "セクション分割・必須/任意・条件分岐に対応。行事の出欠や進路希望の集計が、締切と同時に完了します。",
  },
  { emoji: "📅", t: "カレンダー", d: "行事・定期試験・課題期限を月／週／日ビューで共有。生徒の予定表と同じ画面に並びます。" },
  {
    emoji: "💬",
    t: "チャット",
    d: "「やること」「承認待ち」「スレッド」など目的別タブで整理。既読が見えるので、伝わったかどうかが分かります。",
  },
  { emoji: "🪪", t: "デジタル学生証", d: "組織内で使える身分証を画面に表示。名簿情報と連動します。" },
  {
    emoji: "👥",
    t: "名簿・プロフィール",
    d: "学年・クラス・出席番号など、組織ごとに必要な項目を定義。年度が変わっても過去の記録を保ったまま更新できます。",
  },
  {
    emoji: "🎓",
    t: "Makron for education",
    d: "組織限定の問題集。学年などの属性で出題を切り替え、カリキュラム・パスで進捗を表示。誤答はAI復習で解説します。",
  },
];

const ROLES = [
  { r: "経営者", d: "組織のすべてを管理。設定変更、役割付与、削除まで可能。" },
  { r: "共同管理者", d: "設定変更やメンバー管理など、運営業務の大半を担当。" },
  { r: "教師", d: "課題・お知らせ・アンケートの作成、名簿の学年/クラス設定、教材の配信。" },
  { r: "一般", d: "課題の提出、投稿の閲覧、組織教材の演習など、参加者としての利用。" },
];

const FLOW = [
  { n: "01", t: "組織を申請", d: "組織名と用途を添えて申請します。公開サービスのため、作成は運営の承認制です。", when: "所要5分" },
  {
    n: "02",
    t: "承認・初期設定",
    d: "承認されるとポータルが作られます。プロフィール項目（学年・クラスなど）と年度を設定します。",
    when: "当日〜数日",
  },
  {
    n: "03",
    t: "メンバーを集める",
    d: "6桁の参加コードを配るか、個別に招待します。生徒が既に持っているアカウントをそのまま所属させられます。",
    when: "1コマで完了",
  },
  {
    n: "04",
    t: "運用を始める",
    d: "まずは1機能から。課題かアンケートを1回配信し、うまくいった範囲だけを広げるのがおすすめです。",
    when: "翌週から",
  },
];

function ForSchoolsPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <PublicAmbient />
      <PublicHeader current="for-schools" />

      <main className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        {/* Hero */}
        <div className="ink-panel overflow-hidden px-6 py-12 sm:px-12 sm:py-16">
          <p className="section-eyebrow">For schools &amp; cram schools</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            教室の運営を、<span className="text-gradient">ひとつのポータル</span>に。
          </h1>
          <p className="muted-on-ink mt-5 max-w-2xl text-sm leading-relaxed sm:text-base">
            プリントの印刷、出欠の集計、宿題の回収、連絡の行き違い。
            その多くは「情報が別々の場所にある」ことが原因です。Study# の組織機能は、配る・集める・数えるをひとつの画面にまとめます。
            生徒はふだん使っている学習アプリの中から、そのまま参加できます。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#apply" className="cta cta-signal">
              導入を申請する
            </a>
            <Link to="/all-services" className="cta-ghost cta-ghost-ink">
              全機能を見る
            </Link>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["4段階", "役割ベースの権限"],
              ["年度単位", "学年・クラス管理"],
              ["インストール不要", "スマホのブラウザで参加"],
              ["申請制", "運営が審査して承認"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur-sm">
                <dt className="font-display text-lg font-bold text-gradient sm:text-xl">{v}</dt>
                <dd className="muted-on-ink mt-1 text-[11px]">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 導入後に何が変わるか */}
        <section className="mt-20">
          <p className="section-eyebrow">What changes</p>
          <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">導入すると、何が変わるか</h2>
          <div className="mt-6 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
            {SCHOOL_OUTCOMES.map((o) => (
              <article key={o.t} className="surface surface-hover p-6">
                <h3 className="font-display text-lg font-extrabold">{o.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{o.d}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20">
          <p className="section-eyebrow">Apps</p>
          <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">組織で使えるアプリ</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            組織ホームはアプリが並ぶランチャー形式。必要なものだけを開いて使えます。
          </p>
          <div className="mt-6 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
            {APPS.map((a) => (
              <article key={a.t} className="surface surface-hover p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-xl" aria-hidden>
                  {a.emoji}
                </span>
                <h3 className="mt-3 font-bold">{a.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.d}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20">
          <p className="section-eyebrow">Roles</p>
          <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">4段階の役割</h2>
          <p className="mt-2 text-sm text-muted-foreground">誰が何をできるかを、はっきり分けて運用できます。</p>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.r} className="surface p-5">
                <h3 className="font-display text-lg font-extrabold text-gradient">{r.r}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20">
          <p className="section-eyebrow">Flow</p>
          <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">導入の流れ</h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-4">
            {FLOW.map((f) => (
              <li key={f.n} className="surface p-5">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-2xl font-black text-gradient">{f.n}</span>
                  <span className="chip text-[10px]">{f.when}</span>
                </div>
                <h3 className="mt-2 font-bold">{f.t}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{f.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 不安に答える */}
        <section className="mt-20">
          <p className="section-eyebrow">Concerns</p>
          <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
            導入前に、よくいただく不安
          </h2>
          <div className="surface mt-6 divide-y divide-border/60 overflow-hidden">
            {SCHOOL_OBJECTIONS.map((o) => (
              <details key={o.q} className="group p-5 transition hover:bg-muted/40">
                <summary className="flex cursor-pointer list-none items-start gap-2 font-semibold">
                  <span className="text-primary">Q.</span>
                  <span className="flex-1">{o.q}</span>
                  <span className="text-muted-foreground transition group-open:rotate-45">＋</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{o.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 安心設計 */}
        <section className="mt-20">
          <p className="section-eyebrow">Safety</p>
          <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">安心して配れる設計</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {TRUST.map((t) => (
              <div key={t.t} className="surface p-6">
                <h3 className="font-display text-lg font-extrabold">{t.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="apply" className="mt-20 scroll-mt-24">
          <p className="section-eyebrow">Contact &amp; apply</p>
          <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">導入のお問い合わせ・申請</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            種別を選び、Study# アカウントでログインのうえ必要事項をご入力ください。送信後、組織タブから運営とのやり取りができます。
            承認されるまで組織の機能はご利用いただけません。まずは「試してみたい」段階のご相談でも構いません。
          </p>
          <div className="mt-6">
            <OrgApplyForm />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
