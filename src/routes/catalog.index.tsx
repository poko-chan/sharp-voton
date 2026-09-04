import { createFileRoute, Link } from "@tanstack/react-router";
import { SERVICE_CATALOG } from "@/content/services";
import { PublicAmbient, PublicFooter, PublicHeader } from "@/components/public/PublicShell";

const URL = "https://sharp-voton.lovable.app/catalog";
const TITLE = "カテゴリ別ガイド｜Study#";
const DESC =
  "記録・分析、集中、Makron演習、AI、計画・教材、組織、つながる、続ける仕掛け、安心・運用。Study# の機能をカテゴリごとに解説します。";

export const Route = createFileRoute("/catalog/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: CatalogIndex,
});

function CatalogIndex() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <PublicAmbient />
      <PublicHeader width="max-w-6xl" />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <p className="section-eyebrow">Category guide</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight sm:text-5xl">
          目的から探す<span className="text-gradient">カテゴリ別ガイド</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          「何をしたいか」からたどれるように、機能をカテゴリに分けて説明しています。各カテゴリのページで、含まれる機能をすべて確認できます。
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_CATALOG.map((c) => (
            <Link key={c.key} to="/catalog/$key" params={{ key: c.key }} className="surface surface-hover flex flex-col p-5">
              <div className="text-2xl" aria-hidden>
                {c.emoji}
              </div>
              <h2 className="mt-3 font-display text-lg font-extrabold">{c.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{c.lead}</p>
              <span className="mt-4 text-sm font-semibold text-primary">{c.items.length}件の機能を見る →</span>
            </Link>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
