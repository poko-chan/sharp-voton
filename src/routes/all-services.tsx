import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PublicAmbient, PublicFooter, PublicHeader } from "@/components/public/PublicShell";
import { SERVICE_CATALOG, SERVICE_COUNT, REPLACEMENTS } from "@/content/services";

const TITLE = "全サービス一覧 | Study#";
const DESC = `Study# が備える${SERVICE_COUNT}以上の機能を、記録・集中・問題演習・AI・計画・組織運営・ソーシャル・安心運用のカテゴリ別にすべて掲載しています。`;

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
    links: [{ rel: "canonical", href: "https://sharp-voton.lovable.app/all-services" }],
  }),
  component: AllServicesPage,
});

function AllServicesPage() {
  const [q, setQ] = useState("");

  const catalog = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return SERVICE_CATALOG;
    return SERVICE_CATALOG.map((c) => ({
      ...c,
      items: c.items.filter(
        (i) => i.name.toLowerCase().includes(key) || i.desc.toLowerCase().includes(key),
      ),
    })).filter((c) => c.items.length > 0);
  }, [q]);

  const hits = catalog.reduce((n, c) => n + c.items.length, 0);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <PublicAmbient />
      <PublicHeader current="all-services" />

      <main className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <p className="section-eyebrow">All services</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight sm:text-5xl">
          Study# の<span className="text-gradient">全機能</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          大小あわせて {SERVICE_COUNT} 以上の機能を搭載しています。ここでは、すべてをカテゴリ別に洗いざらい掲載します。
          「これも入っているの？」を確かめるためのページです。
        </p>

        {/* 検索 */}
        <div className="surface mt-8 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="機能名やキーワードで探す（例：ポモドーロ、課題、OCR）"
            aria-label="機能を検索"
            className="w-full rounded-xl border border-border/60 bg-background/60 px-4 py-2.5 text-sm outline-none transition focus:border-primary"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {q.trim() ? `${hits} 件ヒット` : `${SERVICE_COUNT} 機能を掲載`}
          </span>
        </div>

        <nav aria-label="カテゴリ" className="mt-6 flex flex-wrap gap-2">
          {catalog.map((c) => (
            <a key={c.key} href={`#${c.key}`} className="chip">
              <span aria-hidden>{c.emoji}</span> {c.title}
              <span className="text-muted-foreground">{c.items.length}</span>
            </a>
          ))}
        </nav>

        {/* 置き換え表 */}
        {!q.trim() && (
          <section className="mt-16">
            <p className="section-eyebrow">Before / After</p>
            <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
              これまでの勉強道具が、こう変わります
            </h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {REPLACEMENTS.map((r) => (
                <article key={r.before} className="surface surface-hover flex flex-col gap-3 p-5">
                  <p className="text-sm text-muted-foreground line-through decoration-destructive/50">{r.before}</p>
                  <p className="text-sm font-semibold leading-relaxed">↓ {r.after}</p>
                  <p className="mt-auto rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                    {r.gain}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="mt-16 space-y-14">
          {catalog.map((c) => (
            <section key={c.key} id={c.key} className="scroll-mt-20">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                  <span aria-hidden className="mr-2">
                    {c.emoji}
                  </span>
                  {c.title}
                </h2>
                <span className="text-xs text-muted-foreground">{c.items.length} 機能</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{c.lead}</p>
              <div className="mt-6 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                {c.items.map((it) => (
                  <article key={it.name} className="surface surface-hover p-5">
                    <h3 className="flex items-center gap-2 font-bold">
                      {it.name}
                      {it.tag && (
                        <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {it.tag}
                        </span>
                      )}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{it.desc}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
          {catalog.length === 0 && (
            <p className="surface p-10 text-center text-sm text-muted-foreground">
              「{q}」に一致する機能は見つかりませんでした。
            </p>
          )}
        </div>

        <div className="surface mt-16 p-8 text-center">
          <h2 className="font-display text-2xl font-black">気になる機能から、試してみてください。</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            アカウント作成は数十秒。主要な機能は無料で、クレジットカードの登録も要りません。
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/login" className="cta">
              無料ではじめる
            </Link>
            <Link to="/guide" className="cta-ghost">
              使い方を見る
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
