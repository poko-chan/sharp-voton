import { createFileRoute, Link } from "@tanstack/react-router";
import { GoogleTranslateWidget } from "@/components/GoogleTranslateWidget";
import { OrgApplyForm } from "@/components/org/OrgApplyForm";
import logoUrl from "@/assets/logo.png";

const TITLE = "学校・塾の方へ（組織機能） | StudyΩ";
const DESC =
  "StudyΩ の組織機能なら、お知らせ・アンケート・チャット・共有カレンダーまでを1つのポータルで運用できます。学年やクラスは年度単位で管理。";

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
    links: [{ rel: "canonical", href: "https://study-plus-voton.lovable.app/for-schools" }],
  }),
  component: ForSchoolsPage,
});

const APPS = [
  {
    emoji: "📢",
    t: "投稿・お知らせ",
    d: "グループ（チャンネル）ごとに投稿。ピン留め・検索・並び替え・編集/削除に対応し、ファイルも添付できます。",
  },
  {
    emoji: "📝",
    t: "課題",
    d: "期限と必須設定つきで配信。提出状況を一覧と統計で把握できます。小テストは正答をサーバー側で採点し、答えは生徒に露出しません。",
  },
  {
    emoji: "🗳️",
    t: "アンケート",
    d: "組織全体、クラス別にアンケートを配信できます。とても詳細に設定することができます。",
  },
  { emoji: "📅", t: "カレンダー", d: "行事・試験・課題期限を月／週／日ビューで共有。" },
  {
    emoji: "💬",
    t: "チャット",
    d: "「やること」「承認待ち」「スレッド」など目的別タブで整理。",
  },
  { emoji: "🪪", t: "デジタル学生証", d: "組織内で使える身分証を画面に表示。名簿情報と連動します。" },
  {
    emoji: "👥",
    t: "名簿・プロフィール",
    d: "学年・クラス・教室番号など、組織ごとに必要な項目を定義。年度が変わっても履歴を保ったまま更新できます。",
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
  { n: "01", t: "組織を申請", d: "組織名と用途を添えて申請します。公開サービスのため、作成は運営の承認制です。" },
  {
    n: "02",
    t: "承認・初期設定",
    d: "承認されるとポータルが作られます。プロフィール項目（学年・クラスなど）と年度を設定します。",
  },
  {
    n: "03",
    t: "メンバーを集める",
    d: "6桁の参加コードを配るか、個別に招待します。既存のアカウントをそのまま所属させられます。",
  },
  { n: "04", t: "運用を始める", d: "課題・お知らせ・カレンダー・教材を配信。提出状況や学習量は統計で確認できます。" },
];

function ForSchoolsPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-32 -top-40 h-[24rem] w-[24rem] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute -right-24 top-1/2 h-[22rem] w-[22rem] rounded-full bg-accent/20 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-40 border-b liquid-bar">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoUrl} alt="StudyΩ" width={32} height={32} className="h-8 w-8 rounded-xl" />
            <span className="font-display font-extrabold tracking-tight">
              Study<span className="text-gradient">Ω</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              to="/all-services"
              className="hidden rounded-full px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-block"
            >
              全機能
            </Link>
            <Link
              to="/guide"
              className="hidden rounded-full px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-block"
            >
              使い方
            </Link>
            <Link to="/login" className="cta px-5 py-2 text-sm">
              はじめる
            </Link>
            <GoogleTranslateWidget />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <p className="section-eyebrow">For schools &amp; cram schools</p>
        <h1 className="mt-2 max-w-3xl font-display text-4xl font-black leading-tight tracking-tight sm:text-5xl">
          教室の運営を、<span className="text-gradient">ひとつのポータル</span>に。
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          プリント、連絡、集計、教材配布。バラバラに動いていた作業を、StudyΩ の組織機能でまとめます。
          生徒は普段使っている学習アプリの中から、そのまま参加できます。
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#apply" className="cta">
            導入を申請する
          </a>
          <Link to="/all-services" className="cta-ghost">
            全機能を見る
          </Link>
        </div>

        <section className="mt-20">
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">組織で使えるアプリ</h2>
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
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">4段階の役割</h2>
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
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">導入の流れ</h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-4">
            {FLOW.map((f) => (
              <li key={f.n} className="surface p-5">
                <div className="font-display text-2xl font-black text-gradient">{f.n}</div>
                <h3 className="mt-2 font-bold">{f.t}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{f.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20 grid gap-3 md:grid-cols-3">
          {[
            {
              t: "生徒の学習量が見える",
              d: "課題の提出状況だけでなく、学習時間や演習の正答率まで統計で把握できます。",
            },
            { t: "使いすぎを抑えられる", d: "組織内のメンバーに対して、利用できるサービスをまとめて制限できます。" },
            {
              t: "答えは見えない設計",
              d: "小テストや組織教材の正答はサーバー側で採点し、生徒の画面には配信しません。",
            },
          ].map((c) => (
            <div key={c.t} className="surface p-6">
              <h3 className="font-display text-lg font-extrabold">{c.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </section>

        <section id="apply" className="mt-20 scroll-mt-24">
          <p className="section-eyebrow">Contact &amp; apply</p>
          <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">導入のお問い合わせ・申請</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            種別を選び、StudyΩ アカウントでログインのうえ必要事項をご入力ください。送信後、組織タブから運営とのやり取りができます。
            承認されるまで組織の機能はご利用いただけません。
          </p>
          <div className="mt-6">
            <OrgApplyForm />
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-10 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-4 px-4">
          <Link to="/" className="transition hover:text-foreground">
            トップ
          </Link>
          <Link to="/all-services" className="transition hover:text-foreground">
            全機能
          </Link>
          <Link to="/guide" className="transition hover:text-foreground">
            使い方
          </Link>
          <Link to="/help" className="transition hover:text-foreground">
            ヘルプ
          </Link>
          <Link to="/terms" className="transition hover:text-foreground">
            利用規約
          </Link>
        </div>
      </footer>
    </div>
  );
}
