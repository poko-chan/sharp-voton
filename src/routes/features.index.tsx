import { createFileRoute, Link } from "@tanstack/react-router";
import { CORE, featureSlug } from "@/content/services";
import { PublicAmbient, PublicFooter, PublicHeader } from "@/components/public/PublicShell";

const URL = "https://sharp-voton.lovable.app/features";
const TITLE = "機能一覧｜Study#";
const DESC =
  "Study# の主要機能を1ページに。ダッシュボード、集中タイマー、勉強記録、Makron演習、AIチャット、組織機能など、それぞれの詳しい説明ページへ進めます。";

export const Route = createFileRoute("/features/")({
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
  component: FeaturesIndex,
});

function FeaturesIndex() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <PublicAmbient />
      <PublicHeader current="features" />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <p className="section-eyebrow">Features</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight sm:text-5xl">
          Study# の<span className="text-gradient">機能</span>を、ひとつずつ
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          主要な機能ごとに、何ができて、どんな場面で役立つのかを個別ページで説明しています。細かな機能まで一覧で見たい場合は
          <Link to="/all-services" className="mx-1 font-semibold text-primary underline-offset-4 hover:underline">
            全機能一覧
          </Link>
          をご覧ください。
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CORE.map((f) => (
            <Link
              key={f.name}
              to="/features/$slug"
              params={{ slug: featureSlug(f.name) }}
              className="surface surface-hover flex flex-col p-5"
            >
              <div className="text-2xl" aria-hidden>
                {f.emoji}
              </div>
              <h2 className="mt-3 font-display text-lg font-extrabold">{f.name}</h2>
              <p className="mt-1 text-sm font-medium text-primary">{f.lead}</p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-4">{f.detail}</p>
              <span className="mt-4 text-sm font-semibold text-primary">くわしく見る →</span>
            </Link>
          ))}
        </div>

        <section className="surface mt-12 p-6">
          <h2 className="font-display text-xl font-extrabold">カテゴリ別に読む</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            機能をカテゴリごとにまとめた解説ページもあります。
          </p>
          <Link to="/catalog" className="mt-4 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline">
            カテゴリ別ガイドへ →
          </Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
