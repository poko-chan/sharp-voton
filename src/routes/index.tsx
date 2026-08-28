import { useI18n } from "@/lib/i18n";
import { GoogleTranslateWidget } from "@/components/GoogleTranslateWidget";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import logoUrl from "@/assets/logo.png";
import { CORE, MORE, STEPS, FAQ, SERVICE_COUNT } from "@/content/services";

const TITLE = "Study#— 学習のすべてを、ひとつに。";
const DESC =
  "Study# は勉強記録・タイマー・カレンダー・問題演習・AIチャット・目標管理・組織/学校運営までを1つにまとめたオールインワン学習プラットフォームです。";

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
    links: [{ rel: "canonical", href: "https://sharp-voton.lovable.app/" }],
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
    if (/(^|&)(access_token|refresh_token|code|token_hash|type|error|error_description)=/.test(raw)) {
      navigate({ to: "/login", replace: true });
    }
  }, [user, loading, navigate]);

  return <LandingPage isAuthed={!!user} />;
}

function LandingPage({ isAuthed }: { isAuthed: boolean }) {
  const { t } = useI18n();
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
            <img
              src={logoUrl}
              alt="Study# ロゴ"
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl shadow-sm"
            />
            <span className="font-display text-lg font-extrabold tracking-tight">
              Study<span className="text-gradient">#</span>
            </span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <a
              href="#features"
              className="hidden rounded-full px-3.5 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-block"
            >
              {t("landing.features")}
            </a>
            <Link
              to="/all-services"
              className="hidden rounded-full px-3.5 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-block"
            >
              {t("landing.allServices")}
            </Link>
            <Link
              to="/for-schools"
              className="hidden rounded-full px-3.5 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-block"
            >
              {t("landing.forSchools")}
            </Link>
            <Link
              to="/guide"
              className="hidden rounded-full px-3.5 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-block"
            >
              {t("landing.guide")}
            </Link>
            <a
              href="#faq"
              className="hidden rounded-full px-3.5 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-block"
            >
              {t("landing.faq")}
            </a>
            {isAuthed ? (
              <Link to="/dashboard" className="cta px-5 py-2 text-sm">
                {t("landing.dashboard")}
              </Link>
            ) : (
              <Link to="/login" className="cta px-5 py-2 text-sm">
                {t("landing.start")}
              </Link>
            )}
            <GoogleTranslateWidget />
          </nav>
        </div>
      </header>

      <main>
        {/* Hero — ink panel, asymmetric */}
        <section className="mx-auto max-w-6xl px-4 pt-8 sm:pt-14">
          <div className="ink-panel overflow-hidden px-6 py-12 sm:px-12 sm:py-20">
            <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <span className="chip border-white/20 bg-white/10 text-white/80">Study# — 旧 Voton Study+</span>
                <h1 className="mt-6 font-display text-[2.4rem] font-bold leading-[1.05] tracking-tight sm:text-6xl">
                  学習のすべてを、
                  <br />
                  <span className="text-gradient">ひとつに</span>。
                </h1>
                <p className="muted-on-ink mt-6 max-w-xl text-[0.95rem] leading-relaxed sm:text-lg">
                  記録する。集中する。解く。AIに聞く。仲間と続ける。学校や塾で運用する。
                  バラバラだった学習の道具を、Study# はひとつのプラットフォームにまとめました。
                </p>
                <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                  {isAuthed ? (
                    <Link to="/dashboard" className="cta cta-signal">
                      {t("landing.dashboard")}
                    </Link>
                  ) : (
                    <Link to="/login" className="cta cta-signal">
                      {t("landing.start")}
                    </Link>
                  )}
                  <Link
                    to="/all-services"
                    className="cta-ghost cta-ghost-ink"
                  >
                    機能をぜんぶ見る
                  </Link>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3 sm:gap-4">
                {[
                  [`${SERVICE_COUNT}+`, "搭載機能"],
                  ["0円", "主要機能は無料"],
                  ["24h", "AIチャット"],
                  ["4段階", "組織の役割管理"],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-2xl border border-white/12 bg-white/[0.06] p-5 backdrop-blur-sm">
                    <dt className="font-display text-2xl font-bold text-gradient sm:text-3xl">{v}</dt>
                    <dd className="muted-on-ink mt-1 text-[11px] sm:text-xs">{l}</dd>
                  </div>
                ))}
              </dl>

            </div>
          </div>
        </section>

        {/* Before / After */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <p className="section-eyebrow">Before / After</p>
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
            いつもの勉強が、こう変わる
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            新しいことを増やすのではなく、いま手作業でやっていることを置き換えます。
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {REPLACEMENTS.map((r) => (
              <article key={r.before} className="surface surface-hover flex flex-col gap-3 p-6">
                <p className="text-sm text-muted-foreground line-through decoration-destructive/50">{r.before}</p>
                <p className="text-sm font-semibold leading-relaxed">↓ {r.after}</p>
                <p className="mt-auto rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                  {r.gain}
                </p>
              </article>
            ))}
          </div>
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
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">実際の、ある一日</h2>
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
                <p className="mt-4 rounded-xl bg-accent/12 p-3 text-sm font-semibold leading-relaxed">{s.result}</p>
              </article>
            ))}
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

          <h2 className="mt-20 font-display text-3xl font-black tracking-tight sm:text-4xl">さらに、こんなことも</h2>
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
                <Link to="/dashboard" className="cta mt-8">
                  {t("landing.dashboard")}
                </Link>
              ) : (
                <Link to="/login" className="cta mt-8">
                  {t("landing.start")}
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="" width={24} height={24} loading="lazy" className="h-6 w-6 rounded-md" />
            <span>Study#</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/all-services" className="transition hover:text-foreground">
              {t("landing.allServices")}
            </Link>
            <Link to="/guide" className="transition hover:text-foreground">
              {t("landing.guide")}
            </Link>
            <Link to="/for-schools" className="transition hover:text-foreground">
              {t("landing.forSchools")}
            </Link>
            <Link to="/help" className="transition hover:text-foreground">
              {t("landing.help")}
            </Link>
            <Link to="/terms" className="transition hover:text-foreground">
              {t("landing.terms")}
            </Link>
            <Link to="/privacy" className="transition hover:text-foreground">
              {t("landing.privacy")}
            </Link>
            <Link to="/login" className="transition hover:text-foreground">
              {t("login.title")}
            </Link>
            <GoogleTranslateWidget />
          </nav>
        </div>
      </footer>
    </div>
  );
}
