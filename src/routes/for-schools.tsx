import { createFileRoute, Link } from "@tanstack/react-router";
import { OrgApplyForm } from "@/components/org/OrgApplyForm";
import { PublicAmbient, PublicFooter, PublicHeader } from "@/components/public/PublicShell";
import { SCHOOL_OBJECTIONS, SCHOOL_OUTCOMES, TRUST } from "@/content/services";

const TITLE = "学校・塾の方へ（組織機能） | Study#";
const DESC =
  "Study# の組織機能なら、お知らせ・共有カレンダー・チャット・年度ごとの名簿を1つのポータルで無料で運用できます。学年やクラスは年度単位で管理。導入は申請・承認制です。";

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
    links: [{ rel: "canonical", href: "https://sharp.voton.app/for-schools" }],
  }),
  component: ForSchoolsPage,
});

const APPS = [
  {
    emoji: "📢",
    t: "投稿・お知らせ",
    d: "グループごとに投稿。ピン留め・検索・編集/削除に対応し、学年だけ、クラスだけへの配信もできます。",
  },
  {
    emoji: "📅",
    t: "カレンダー",
    d: "行事・定期試験を共有。生徒の予定表と同じ画面に並びます。",
  },
  {
    emoji: "💬",
    t: "チャット",
    d: "組織内のメンバーとやり取り。連絡がプリントやほかのアプリに散らばりません。",
  },
  {
    emoji: "👥",
    t: "年度ごとの名簿",
    d: "学年・クラス・番号を年度ごとに管理。新年度は前年度から進級の下書きを作れます。",
  },
  {
    emoji: "🛡️",
    t: "役割と権限",
    d: "所有者・共同管理者に加え、組織ごとに役割を作り、アプリごとに見る・作る・管理するを設定できます。",
  },
  {
    emoji: "🎓",
    t: "Makron for education（準備中）",
    d: "組織専用の問題演習を準備しています。公開時期は決まり次第お知らせします。",
  },
];

const ROLES = [
  { r: "所有者", d: "組織のすべてを管理。設定変更、役割の付与、所有者の移譲まで可能。" },
  { r: "共同管理者", d: "設定変更やメンバー管理など、運営業務の大半を担当。" },
  { r: "カスタム役割", d: "「教員」「事務」など組織ごとに作成し、アプリごとに権限を設定。" },
  { r: "メンバー", d: "投稿の閲覧、カレンダーの確認、チャットなど参加者としての利用。" },
];

const FLOW = [
  {
    n: "01",
    t: "組織を申請",
    d: "組織名と用途を添えて申請します。公開サービスのため、作成は運営の承認制です。",
    when: "所要5分",
  },
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
    d: "まずは1機能から。お知らせを1回配信し、うまくいった範囲だけを広げるのがおすすめです。",
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
            その多くは「情報が別々の場所にある」ことが原因です。Study#
            の組織機能は、配る・集める・数えるをひとつの画面にまとめます。
            生徒はふだん使っている学習アプリの中から、そのまま参加できます。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#apply" className="cta cta-signal">
              導入を申請する
            </a>
            <a href="#pricing" className="cta-ghost cta-ghost-ink">
              料金を見る（基本無料）
            </a>
            <Link to="/all-services" className="cta-ghost cta-ghost-ink">
              全機能を見る
            </Link>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["自由", "役割と権限の設定"],
              ["年度単位", "学年・クラス管理"],
              ["インストール不要", "スマホのブラウザで参加"],
              ["基本無料", "大規模導入は要相談"],
            ].map(([v, l]) => (
              <div
                key={l}
                className="rounded-2xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur-sm"
              >
                <dt className="font-display text-lg font-bold text-gradient sm:text-xl">{v}</dt>
                <dd className="muted-on-ink mt-1 text-[11px]">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 導入後に何が変わるか */}
        <section className="mt-20">
          <p className="section-eyebrow">What changes</p>
          <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
            導入すると、何が変わるか
          </h2>
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
          <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
            組織で使えるアプリ
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            組織ホームはアプリが並ぶランチャー形式。必要なものだけを開いて使えます。
          </p>
          <div className="mt-6 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
            {APPS.map((a) => (
              <article key={a.t} className="surface surface-hover p-5">
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-xl"
                  aria-hidden
                >
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
          <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
            役割と権限
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            誰が何をできるかを、はっきり分けて運用できます。
          </p>
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
          <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
            導入の流れ
          </h2>
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
          <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
            安心して配れる設計
          </h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {TRUST.map((t) => (
              <div key={t.t} className="surface p-6">
                <h3 className="font-display text-lg font-extrabold">{t.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 料金 */}
        <section id="pricing" className="mt-20 scroll-mt-24">
          <p className="section-eyebrow">Pricing</p>
          <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
            料金は<span className="text-gradient">基本無料</span>。規模やご要望に合わせてご相談ください。
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            組織の作成と主な機能は無料でお使いいただけます。人数が多い場合や個別の対応が必要な場合は、内容をうかがってからご案内します。
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="surface relative overflow-hidden p-7 ring-2 ring-primary/30">
              <span className="chip text-[10px]">まずはここから</span>
              <h3 className="mt-3 font-display text-xl font-extrabold">基本プラン</h3>
              <p className="mt-3 font-display text-4xl font-black text-gradient">
                ¥0<span className="ml-1 text-sm font-bold text-muted-foreground">／ 基本無料</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  "お知らせ・投稿・カレンダー・チャット",
                  "役割と権限の設定",
                  "年度ごとの学年・クラス管理",
                  "参加コード・招待でメンバー追加",
                  "運営とのチャットでの相談",
                ].map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="text-primary">✓</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
              <a href="#apply" className="cta cta-signal mt-6 inline-flex">
                無料で申請する
              </a>
            </div>
            <div className="surface p-7">
              <span className="chip text-[10px]">大規模・個別対応</span>
              <h3 className="mt-3 font-display text-xl font-extrabold">カスタム導入</h3>
              <p className="mt-3 font-display text-4xl font-black">
                要相談
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  "学校全体・複数校舎での一括導入",
                  "名簿の一括登録や年度更新のお手伝い",
                  "組織専用の教材・問題の準備",
                  "導入説明会・先生向けの使い方案内",
                  "その他ご要望に合わせた対応",
                ].map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="text-primary">✓</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
              <a href="#apply" className="cta-ghost mt-6 inline-flex">
                相談する
              </a>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            ※ 費用が発生する場合は、必ず事前にお見積りをお伝えし、ご同意いただいてから進めます。勝手に請求されることはありません。
          </p>
        </section>

        {/* 最後のひと押し */}
        <section className="ink-panel mt-20 px-6 py-12 text-center sm:px-12">
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            まずは<span className="text-gradient">1クラス・1機能</span>から。
          </h2>
          <p className="muted-on-ink mx-auto mt-3 max-w-xl text-sm leading-relaxed">
            無料で始めて、合わなければやめられます。小さく試して、うまくいった分だけ広げてください。
          </p>
          <a href="#apply" className="cta cta-signal mt-6 inline-flex">
            無料で始める
          </a>
        </section>

        <section id="apply" className="mt-20 scroll-mt-24">
          <p className="section-eyebrow">Contact &amp; apply</p>
          <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
            導入のお問い合わせ・申請
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            種別を選び、Study#
            アカウントでログインのうえ必要事項をご入力ください。送信後、組織タブから運営とのやり取りができます。
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
