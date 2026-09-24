import { useI18n } from "@/lib/i18n";
import { GoogleTranslateWidget } from "@/components/GoogleTranslateWidget";
import { PublicFooter, PublicMobileNav } from "@/components/public/PublicShell";
import { AiTrialChat } from "@/components/public/AiTrialChat";


import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import logoUrl from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, BookOpenCheck, Check, Sparkles } from "lucide-react";
import {
  CORE,
  MORE,
  STEPS,
  FAQ,
  SERVICE_COUNT,
  REPLACEMENTS,
  WHY_IT_WORKS,
  SCENARIOS,
  TRUST,
} from "@/content/services";

// 1. タイトルと説明文に「Voton Study Sharp」や表記ゆれ（VotonStudySharp, Study Sharp）を含める
const TITLE = "Voton Study Sharp (Study#) — 学習のすべてを、ひとつに。";
const DESC =
  "Voton Study Sharp（VotonStudySharp / Study Sharp / Study# / Voton Study）は、学習のすべてをひとつにまとめる総合学習プラットフォームです。勉強記録・タイマー・問題演習・AIチャット・目標管理・学校運営に対応します。";

// 2. Googleに「表記ゆれ・別名」を明確に伝える構造化データ（JSON-LD）を作成
const SCHEMA_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Voton Study Sharp",
  alternateName: ["VotonStudySharp", "Study Sharp", "Study#", "Voton Study", "Voton", "Sharp"],
  description: DESC,
  keywords:
    "Voton, Voton Study, Voton Study Sharp, VotonStudySharp, Study, Study Sharp, Study#, Sharp",
  applicationCategory: "EducationalApplication",
  operatingSystem: "All",
  url: "https://sharp-voton.lovable.app/",
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      {
        name: "keywords",
        content:
          "Voton, Voton Study, Voton Study Sharp, VotonStudySharp, Study, Study Sharp, Study#, Sharp, 学習のすべてをひとつに, 学習を賢く楽しく, 総合学習プラットフォーム",
      },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      {
        name: "gridinsoft-key",
        content: "w2xxfuv75eiz41ywqjw6ciuxwbdwj754d9rh7qtw5q2z3ptjcywc5i6338v74g86",
      },
      { name: "wot-verification", content: "b90b06f9dc6ed5f77aed" },
    ],
    links: [{ rel: "canonical", href: "https://sharp-voton.lovable.app/" }],
    // 3. head 内に構造化データの <script> および WOT Badge スクリプトを挿入する
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(SCHEMA_DATA),
      },
      {
        src: "https://static.mywot.com/website_owners_badges/websiteOwnersBadge.js",
        async: true,
      },
    ],
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
    const raw = window.location.hash.slice(1) + "&" + window.location.search.slice(1);
    if (
      /(^|&)(access_token|refresh_token|code|token_hash|type|error|error_description)=/.test(raw)
    ) {
      navigate({ to: "/login", replace: true });
    }
  }, [user, loading, navigate]);

  return <LandingPage isAuthed={!!user} />;
}

function LandingPage({ isAuthed }: { isAuthed: boolean }) {
  const { t } = useI18n();
  return (
    <div className="landing-premium relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b landing-header">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2.5">
            <img
              src={logoUrl}
              alt="Voton Study Sharp (Study#) ロゴ"
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg shadow-sm"
            />
            <span className="font-display text-lg font-extrabold">
              Study<span className="text-gradient">#</span>
            </span>
          </div>
          <nav className="flex items-center gap-1.5 text-sm">
            <a
              href="#features"
                className="hidden px-3 py-2 font-medium text-muted-foreground transition hover:text-foreground sm:inline-block"
            >
              {t("landing.features")}
            </a>
            <Link
              to="/all-services"
                className="hidden px-3 py-2 font-medium text-muted-foreground transition hover:text-foreground sm:inline-block"
            >
              {t("landing.allServices")}
            </Link>
            <Link
              to="/for-schools"
                className="hidden px-3 py-2 font-medium text-muted-foreground transition hover:text-foreground sm:inline-block"
            >
              {t("landing.forSchools")}
            </Link>
            <Link
              to="/guide"
                className="hidden px-3 py-2 font-medium text-muted-foreground transition hover:text-foreground sm:inline-block"
            >
              {t("landing.guide")}
            </Link>
            <a
              href="#faq"
                className="hidden px-3 py-2 font-medium text-muted-foreground transition hover:text-foreground sm:inline-block"
            >
              {t("landing.faq")}
            </a>
            <Button asChild size="sm" className="h-10 rounded-lg px-5 shadow-md">
              {isAuthed ? <Link to="/dashboard">{t("landing.dashboard")}</Link> : <Link to="/login">{t("landing.start")}</Link>}
            </Button>
            <GoogleTranslateWidget />
            <PublicMobileNav includeFaq />

            {/* 配置案1: ヘッダー右端（スクロール時も目に入る位置） */}
            <div className="hidden lg:flex items-center ml-1 shrink-0 scale-90">
              <a
                id="wot-badge2"
                className="wot-badge"
                href="https://www.mywot.com/scorecard/sharp-voton.lovable.app?wot_badge=2_white"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="wot-secured-container">
                  <div className="wot-shield-background"></div>
                  <div className="wot-text-container">
                    <p className="wot-secured-bold">Verified Site</p>
                    <div className="wot-trusted-container">
                      <div className="wot-trusted">Trusted by</div>
                      <div className="wot-logo"></div>
                    </div>
                  </div>
                </div>
                <div className="wot-vertical"></div>
                <p className="wot-report">See Report</p>
              </a>
            </div>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:pb-24 sm:pt-24">
          <div aria-hidden className="landing-grid-fade absolute inset-x-4 top-0 -z-10 h-full" />
          <div className="landing-rise mx-auto max-w-4xl">
            <div className="landing-kicker"><span className="h-2 w-2 rounded-full bg-signal" />Voton Study Sharp</div>
            <h1 className="mt-7 font-display text-4xl font-bold leading-[1.14] sm:text-6xl lg:text-7xl">
              学習のすべてを、<br /><span className="landing-title-accent">もっとスマートに。</span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              記録、集中、演習、AI、計画をひとつに。Study#は、毎日の学習を整理し、次にやるべきことへ迷わず進める総合学習プラットフォームです。
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-lg px-8 text-base shadow-lg">
                {isAuthed ? <Link to="/dashboard">{t("landing.dashboard")} <ArrowRight /></Link> : <Link to="/login">{t("landing.start")} <ArrowRight /></Link>}
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-lg px-8 text-base">
                <a href="#ai-trial">AI機能を試してみる</a>
              </Button>
              <Button asChild variant="ghost" size="lg" className="h-12 rounded-lg px-8 text-base">
                <Link to="/all-services">サービス詳細を見る</Link>
              </Button>

            </div>
          </div>
          <dl className="landing-rise mx-auto mt-14 grid max-w-4xl grid-cols-2 border-y border-border/70 sm:grid-cols-4">
            {[[`${SERVICE_COUNT}+`, "搭載機能"], ["0円", "主要機能は無料"], ["24h", "AIチャット"], ["4段階", "組織の役割管理"]].map(([v, l]) => (
              <div key={l} className="px-3 py-5 sm:border-l sm:first:border-l-0"><dt className="font-display text-2xl font-bold text-primary">{v}</dt><dd className="mt-1 text-xs text-muted-foreground">{l}</dd></div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="service-message"
          className="mx-auto max-w-6xl px-4 pb-16 sm:pb-24"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <article className="landing-value p-6"><BookOpenCheck className="mb-6 h-7 w-7 text-primary" aria-hidden />
              <h2 id="service-message" className="font-display text-lg font-black sm:text-xl">
                学習のすべてをひとつに
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                記録、集中、演習、AI、計画をVoton Study Sharpに集約します。
              </p>
            </article>
            <article className="landing-value p-6"><Sparkles className="mb-6 h-7 w-7 text-accent-foreground" aria-hidden />
              <h2 className="font-display text-lg font-black sm:text-xl">学習を賢く、楽しく</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                続けやすい仕組みと見える記録で、毎日の学習を前に進めます。
              </p>
            </article>
            <article className="landing-value p-6"><BarChart3 className="mb-6 h-7 w-7 text-signal" aria-hidden />
              <h2 className="font-display text-lg font-black sm:text-xl">
                総合学習プラットフォーム
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Study#、Study Sharp、Voton Studyとして、個人から学校・塾まで使えます。
              </p>
            </article>
          </div>
        </section>

        <section id="ai-trial" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-16 sm:pb-24">
          <p className="section-eyebrow">AI</p>
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
            Study# のAI（一時停止中）
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            AIはサーバー側で動くので、ダウンロードも設定も不要。登録しなくてもそのまま会話できます。
          </p>
          <div className="mt-6">
            <AiTrialChat />
          </div>
        </section>



        {/* Before / After */}
        <section className="border-y border-border/60 bg-muted/30"><div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="section-eyebrow">Before / After</p>
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
            いつもの勉強が、こう変わる
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            新しいことを増やすのではなく、いま手作業でやっていることを置き換えます。
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
            {REPLACEMENTS.map((r) => (
              <article key={r.before} className="group flex flex-col gap-3 bg-card p-6 transition-colors hover:bg-secondary">
                <p className="text-sm text-muted-foreground line-through decoration-destructive/50">
                  {r.before}
                </p>
                <p className="flex gap-2 text-sm font-semibold leading-relaxed"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{r.after}</p>
                <p className="mt-auto flex items-center gap-2 pt-3 text-xs font-semibold text-primary"><Check className="h-3.5 w-3.5" />{r.gain}
                </p>
              </article>
            ))}
          </div></div>
        </section>

        {/* Why it works */}
        <section className="border-y border-border/50 bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
            <p className="section-eyebrow">Why it works</p>
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
              続く理由は、根性ではなく設計です
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {WHY_IT_WORKS.map((w, i) => (
                <article key={w.t} className="surface p-6">
                  <span className="font-display text-sm font-black text-gradient">0{i + 1}</span>
                  <h3 className="mt-2 font-display text-xl font-extrabold">{w.t}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{w.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Scenarios */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="section-eyebrow">Real use</p>
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
            実際の、ある一日
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            自分に近い状況を選んで、そのまま真似できるようにまとめました。
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {SCENARIOS.map((s) => (
              <article key={s.who} className="surface surface-hover p-6">
                <h3 className="font-display text-xl font-extrabold">{s.who}</h3>
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

        {/* Core features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:py-24">
          <p className="section-eyebrow">Features</p>
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
            主要機能
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            毎日の学習を回すために必要なものを、最初からすべて用意しています。
          </p>
          <div className="mt-10 grid gap-4 sm:gap-5 md:grid-cols-2">
            {CORE.map((f) => (
              <article key={f.name} className="surface surface-hover p-6">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-2xl"
                    aria-hidden
                  >
                    {f.emoji}
                  </span>
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

          <h2 className="mt-20 font-display text-3xl font-black tracking-tight sm:text-4xl">
            さらに、こんなことも
          </h2>
          <div className="mt-10 grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {MORE.map((f) => (
              <article key={f.name} className="surface surface-hover p-6">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-xl"
                    aria-hidden
                  >
                    {f.emoji}
                  </span>
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
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
              使い方は、5ステップ
            </h2>
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
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
            こんな人のために
          </h2>
          <div className="mt-10 grid gap-4 sm:gap-5 md:grid-cols-3">
            {[
              {
                t: "受験生・中高生",
                d: "試験日から逆算した目標設定、苦手単元の演習、記録の可視化まで。今日やるべきことが毎朝はっきりします。",
              },
              {
                t: "学校・塾の先生",
                d: "生徒の勉強時間の管理、お知らせの配布、アンケートの配信を始めとする本格的な実装です。",
              },
              {
                t: "保護者",
                d: "保護者モードで、お子さまの学習ログを見守れます。過度な干渉なしに、続いているかどうかがわかります。",
              },
            ].map((c) => (
              <div key={c.t} className="surface surface-hover p-6">
                <h3 className="font-display text-lg font-extrabold">{c.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section className="mx-auto max-w-6xl px-4 pb-4 sm:pb-8">
          <p className="section-eyebrow">Safety</p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
              安心して使えるように
            </h2>

            {/* 配置案2: 安全性（Safety）セクションの見出し横（文脈的に一番説得力が出る位置） */}
            <div className="shrink-0">
              <a
                id="wot-badge2"
                className="wot-badge"
                href="https://www.mywot.com/scorecard/sharp-voton.lovable.app?wot_badge=2_white"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="wot-secured-container">
                  <div className="wot-shield-background"></div>
                  <div className="wot-text-container">
                    <p className="wot-secured-bold">Verified Site</p>
                    <div className="wot-trusted-container">
                      <div className="wot-trusted">Trusted by</div>
                      <div className="wot-logo"></div>
                    </div>
                  </div>
                </div>
                <div className="wot-vertical"></div>
                <p className="wot-report">See Report</p>
              </a>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TRUST.map((t) => (
              <div key={t.t} className="surface p-6">
                <h3 className="font-display text-lg font-extrabold">{t.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-border/50 bg-muted/20">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
            <p className="section-eyebrow">FAQ</p>
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
              よくある質問
            </h2>
            <div className="surface mt-8 divide-y divide-border/60 overflow-hidden">
              {FAQ.map((f) => (
                <details key={f.q} className="group p-5 transition hover:bg-muted/40">
                  <summary className="flex cursor-pointer list-none items-start gap-2 font-semibold">
                    <span className="text-primary">Q.</span>
                    <span className="flex-1">{f.q}</span>
                    <span className="text-muted-foreground transition group-open:rotate-45">
                      ＋
                    </span>
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
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_50%_0%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_70%)]"
            />
            <div className="relative">
              <h2 className="font-display text-3xl font-black tracking-tight sm:text-4xl">
                今日から、<span className="text-gradient">Study#</span>。
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
                まずは1回、タイマーを回すところから。積み上がった記録が、次の自分を連れてきます。
              </p>
              {isAuthed ? (
                <Link to="/dashboard" className="cta mt-8 inline-block">
                  {t("landing.dashboard")}
                </Link>
              ) : (
                <Link to="/login" className="cta mt-8 inline-block">
                  {t("landing.start")}
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
