import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { listPublicFaqs, type PublicFaq } from "@/lib/faq.functions";
import { PublicAmbient, PublicFooter, PublicHeader } from "@/components/public/PublicShell";

const HELP_URL = "https://sharp-voton.lovable.app/help";
const HELP_TITLE = "ヘルプ・よくある質問｜Study#";
const HELP_DESC =
  "Study#のよくある質問と回答。ログイン・アカウント・勉強記録・演習・AI・組織利用に関する疑問を解決できます。";

export const Route = createFileRoute("/help")({
  loader: async () => ({ faqs: await listPublicFaqs() }),
  head: ({ loaderData }) => ({
    meta: [
      { title: HELP_TITLE },
      { name: "description", content: HELP_DESC },
      { property: "og:title", content: HELP_TITLE },
      { property: "og:description", content: HELP_DESC },
      { property: "og:url", content: HELP_URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: HELP_TITLE },
      { name: "twitter:description", content: HELP_DESC },
    ],
    links: [{ rel: "canonical", href: HELP_URL }],
    scripts: loaderData?.faqs?.length
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: loaderData.faqs.map((f) => ({
                "@type": "Question",
                name: f.question,
                acceptedAnswer: { "@type": "Answer", text: f.answer },
              })),
            }),
          },
        ]
      : [],
  }),
  component: HelpPage,
  errorComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      ヘルプを読み込めませんでした。時間をおいて再度お試しください。
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      ページが見つかりません。
    </div>
  ),
});

const QUICK = [
  { t: "はじめかたを知りたい", d: "アカウント作成から1日の使い方まで、ステップで解説しています。", to: "/guide", cta: "使い方ガイド" },
  { t: "どんな機能があるか見たい", d: "搭載しているすべての機能をカテゴリ別に掲載しています。", to: "/all-services", cta: "全機能一覧" },
  { t: "学校・塾で使いたい", d: "組織機能の内容と、導入の流れ・申請フォームはこちら。", to: "/for-schools", cta: "学校・塾の方へ" },
];

function HelpPage() {
  const { faqs } = Route.useLoaderData();
  const items: PublicFaq[] = faqs;
  const [q, setQ] = useState("");

  const filtered = items.filter(
    (i) =>
      !q.trim() ||
      i.question.toLowerCase().includes(q.toLowerCase()) ||
      i.answer.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <PublicAmbient />
      <PublicHeader current="help" width="max-w-4xl" />

      <main className="mx-auto max-w-4xl px-4 py-14 sm:py-20">
        <p className="section-eyebrow">Help center</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight sm:text-5xl">
          こまったときの<span className="text-gradient">ヘルプ</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          よくある質問をまとめています。キーワードで検索するか、下の入口から目的のページへ進んでください。
        </p>

        <div className="surface mt-8 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="キーワードで検索…（例：パスワード、記録、組織）"
              aria-label="ヘルプを検索"
              className="pl-9"
            />
          </div>
        </div>

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          {QUICK.map((k) => (
            <article key={k.t} className="surface surface-hover flex flex-col p-5">
              <h2 className="font-bold">{k.t}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{k.d}</p>
              <Link to={k.to} className="mt-4 text-sm font-semibold text-primary underline-offset-4 hover:underline">
                {k.cta} →
              </Link>
            </article>
          ))}
        </section>

        <section className="surface mt-6 space-y-3 border-primary/30 p-5">
          <h2 className="font-display text-lg font-extrabold">ログインできない場合</h2>
          <p className="text-sm text-muted-foreground">
            パスワードを忘れた、または登録メールアドレスを忘れた場合は、こちらから復旧できます。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/forgot">パスワードを再設定</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/login">ログイン画面へ</Link>
            </Button>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">よくある質問</h2>
          <div className="surface mt-4 p-4">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {items.length === 0 ? "まだ FAQ がありません。" : "該当する項目がありません。"}
              </p>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {filtered.map((f) => (
                  <AccordionItem key={f.id} value={f.id}>
                    <AccordionTrigger className="text-left">Q. {f.question}</AccordionTrigger>
                    <AccordionContent className="whitespace-pre-wrap text-sm">{f.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </section>
      </main>

      <PublicFooter width="max-w-4xl" />
    </div>
  );
}
