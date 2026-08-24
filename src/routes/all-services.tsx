import { createFileRoute, Link } from "@tanstack/react-router";
import { GoogleTranslateWidget } from "@/components/GoogleTranslateWidget";
import logoUrl from "@/assets/logo.png";
import { SERVICE_CATALOG, SERVICE_COUNT } from "@/content/services";

const TITLE = "全サービス一覧 | StudyΩ（Voton Study Omega）";
const DESC = `StudyΩ が備える${SERVICE_COUNT}以上の機能を、記録・集中・問題演習・AI・計画・組織運営・ソーシャル・安心運用のカテゴリ別にすべて掲載しています。`;

export const Route = createFileRoute("/all-services")({
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
    links: [{ rel: "canonical", href: "https://omega-voton.lovable.app/all-services" }],
  }),
  component: AllServicesPage,
});

function AllServicesPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-32 -top-40 h-[24rem] w-[24rem] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute -right-24 top-1/3 h-[20rem] w-[20rem] rounded-full bg-accent/20 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-40 border-b liquid-bar">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoUrl} alt="StudyΩ" width={32} height={32} className="h-8 w-8 rounded-xl" />
            <span className="font-display font-extrabold tracking-tight">Study<span className="text-gradient">Ω</span></span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/guide" className="hidden rounded-full px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-block">使い方</Link>
            <Link to="/for-schools" className="hidden rounded-full px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-block">学校・塾の方へ</Link>
            <Link to="/login" className="cta px-5 py-2 text-sm">はじめる</Link>
            <GoogleTranslateWidget />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <p className="section-eyebrow">All services</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight sm:text-5xl">
          StudyΩ の<span className="text-gradient">全機能</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          大小あわせて {SERVICE_COUNT} 以上の機能を搭載しています。ここでは、すべてをカテゴリ別に洗いざらい掲載します。
          「これも入っているの？」を確かめるためのページです。
        </p>

        <nav aria-label="カテゴリ" className="mt-8 flex flex-wrap gap-2">
          {SERVICE_CATALOG.map((c) => (
            <a key={c.key} href={`#${c.key}`} className="chip">
              <span aria-hidden>{c.emoji}</span> {c.title}
              <span className="text-muted-foreground">{c.items.length}</span>
            </a>
          ))}
        </nav>

        <div className="mt-12 space-y-14">
          {SERVICE_CATALOG.map((c) => (
            <section key={c.key} id={c.key} className="scroll-mt-20">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                  <span aria-hidden className="mr-2">{c.emoji}</span>{c.title}
                </h2>
                <span className="text-xs text-muted-foreground">{c.items.length} 機能</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{c.lead}</p>
              <div className="mt-6 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                {c.items.map((it) => (
                  <article key={it.name} className="surface surface-hover p-5">
                    <h3 className="flex items-center gap-2 font-bold">
                      {it.name}
                      {it.tag && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold text-primary">{it.tag}</span>}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{it.desc}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="surface mt-16 p-8 text-center">
          <h2 className="font-display text-2xl font-black">気になる機能から、試してみてください。</h2>
          <p className="mt-3 text-sm text-muted-foreground">アカウント作成は数十秒。主要な機能は無料で使えます。</p>
          <Link to="/login" className="cta mt-6">無料ではじめる</Link>
        </div>
      </main>

      <footer className="border-t border-border/50 py-10 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-4 px-4">
          <Link to="/" className="transition hover:text-foreground">トップ</Link>
          <Link to="/guide" className="transition hover:text-foreground">使い方</Link>
          <Link to="/for-schools" className="transition hover:text-foreground">学校・塾の方へ</Link>
          <Link to="/help" className="transition hover:text-foreground">ヘルプ</Link>
          <Link to="/terms" className="transition hover:text-foreground">利用規約</Link>
          <Link to="/privacy" className="transition hover:text-foreground">プライバシーポリシー</Link>
        </div>
      </footer>
    </div>
  );
}
