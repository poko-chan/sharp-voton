import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CORE, MORE, featureSlug } from "@/content/services";

const ALL = [...CORE, ...MORE];
import { PublicAmbient, PublicFooter, PublicHeader } from "@/components/public/PublicShell";

const BASE = "https://sharp-voton.lovable.app";

export const Route = createFileRoute("/features/$slug")({
  loader: ({ params }) => {
    const feature = ALL.find((f) => featureSlug(f.name) === params.slug);
    if (!feature) throw notFound();
    return { feature };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "機能が見つかりません｜Study#" }, { name: "robots", content: "noindex" }] };
    }
    const f = loaderData.feature;
    const title = `${f.name}｜Study# の機能`;
    const desc = f.detail.slice(0, 150);
    const url = `${BASE}/features/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: FeatureDetail,
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      お探しの機能ページが見つかりませんでした。
      <Link to="/features" className="font-semibold text-primary underline-offset-4 hover:underline">
        機能一覧へ戻る
      </Link>
    </div>
  ),
});

function FeatureDetail() {
  const { feature } = Route.useLoaderData();
  const index = ALL.findIndex((f) => f.name === feature.name);
  const prev = index > 0 ? CORE[index - 1] : undefined;
  const next = index < ALL.length - 1 ? CORE[index + 1] : undefined;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <PublicAmbient />
      <PublicHeader current="features" width="max-w-4xl" />
      <main className="mx-auto max-w-4xl px-4 py-14 sm:py-20">
        <nav className="text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ホーム
          </Link>
          <span className="mx-1.5">/</span>
          <Link to="/features" className="hover:text-foreground">
            機能一覧
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{feature.name}</span>
        </nav>

        <div className="mt-6 text-4xl" aria-hidden>
          {feature.emoji}
        </div>
        <h1 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-5xl">{feature.name}</h1>
        <p className="mt-3 text-lg font-semibold text-primary">{feature.lead}</p>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground sm:text-base">{feature.detail}</p>

        <section className="surface mt-8 p-6">
          <h2 className="font-display text-lg font-extrabold">この機能のポイント</h2>
          <ul className="mt-4 space-y-3">
            {feature.points.map((p) => (
              <li key={p} className="flex gap-2.5 text-sm leading-relaxed">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface mt-6 border-primary/30 p-6">
          <h2 className="font-display text-lg font-extrabold">使ってみる</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ログインすると <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{feature.path}</code> から利用できます。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/login" className="cta px-5 py-2 text-sm">
              無料ではじめる
            </Link>
            <Link
              to="/guide"
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            >
              使い方ガイド
            </Link>
          </div>
        </section>

        <nav className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-between">
          {prev ? (
            <Link
              to="/features/$slug"
              params={{ slug: featureSlug(prev.name) }}
              className="surface surface-hover flex-1 p-4 text-sm"
            >
              <span className="text-xs text-muted-foreground">前の機能</span>
              <div className="font-semibold">← {prev.name}</div>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {next ? (
            <Link
              to="/features/$slug"
              params={{ slug: featureSlug(next.name) }}
              className="surface surface-hover flex-1 p-4 text-right text-sm"
            >
              <span className="text-xs text-muted-foreground">次の機能</span>
              <div className="font-semibold">{next.name} →</div>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </nav>
      </main>
      <PublicFooter width="max-w-4xl" />
    </div>
  );
}
