import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SERVICE_CATALOG } from "@/content/services";
import { PublicAmbient, PublicFooter, PublicHeader } from "@/components/public/PublicShell";

const BASE = "https://sharp-voton.lovable.app";

export const Route = createFileRoute("/catalog/$key")({
  loader: ({ params }) => {
    const category = SERVICE_CATALOG.find((c) => c.key === params.key);
    if (!category) throw notFound();
    return { category };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "カテゴリが見つかりません｜Study#" }, { name: "robots", content: "noindex" }] };
    }
    const c = loaderData.category;
    const title = `${c.title}｜Study# のカテゴリ別ガイド`;
    const desc = `${c.lead} ${c.items.map((i) => i.name).join("・")}`.slice(0, 150);
    const url = `${BASE}/catalog/${params.key}`;
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
  component: CategoryPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      お探しのカテゴリが見つかりませんでした。
      <Link to="/catalog" className="font-semibold text-primary underline-offset-4 hover:underline">
        カテゴリ一覧へ戻る
      </Link>
    </div>
  ),
});

function CategoryPage() {
  const { category } = Route.useLoaderData();
  const others = SERVICE_CATALOG.filter((c) => c.key !== category.key);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <PublicAmbient />
      <PublicHeader width="max-w-4xl" />
      <main className="mx-auto max-w-4xl px-4 py-14 sm:py-20">
        <nav className="text-xs text-muted-foreground">
          <Link to="/catalog" className="hover:text-foreground">
            カテゴリ別ガイド
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{category.title}</span>
        </nav>

        <div className="mt-6 text-4xl" aria-hidden>
          {category.emoji}
        </div>
        <h1 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-5xl">{category.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">{category.lead}</p>

        <section className="mt-8 space-y-3">
          {category.items.map((i) => (
            <article key={i.name} className="surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-extrabold">{i.name}</h2>
                {i.tag && (
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {i.tag}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{i.desc}</p>
            </article>
          ))}
        </section>

        <section className="mt-12">
          <h2 className="font-display text-xl font-extrabold">ほかのカテゴリ</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {others.map((c) => (
              <Link key={c.key} to="/catalog/$key" params={{ key: c.key }} className="surface surface-hover p-4">
                <div className="text-sm font-semibold">
                  {c.emoji} {c.title}
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.lead}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter width="max-w-4xl" />
    </div>
  );
}
