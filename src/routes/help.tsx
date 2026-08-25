import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HelpCircle, ArrowLeft, Search } from "lucide-react";
import logoUrl from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { listPublicFaqs, type PublicFaq } from "@/lib/faq.functions";

const HELP_URL = "https://sharp-voton.lovable.app/help";
const HELP_TITLE = "ヘルプ・よくある質問｜Study#";
const HELP_DESC = "Study#（Study#）のよくある質問と回答。ログイン・アカウント・勉強記録・演習・組織利用に関する疑問を解決できます。";

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
    ],
    links: [{ rel: "canonical", href: HELP_URL }],
    scripts: (loaderData?.faqs?.length
      ? [{
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
        }]
      : []),
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

type Faq = PublicFaq;

function HelpPage() {
  const { faqs } = Route.useLoaderData();
  const items: Faq[] = faqs;
  const [q, setQ] = useState("");


  const filtered = items.filter(
    (i) =>
      !q.trim() ||
      i.question.toLowerCase().includes(q.toLowerCase()) ||
      i.answer.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="Study# 学習プラットフォームのロゴ" className="h-10 w-10 rounded-xl" />
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HelpCircle className="h-7 w-7 text-primary" /> ヘルプ
          </h1>
          <Link to="/login" className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> ログインに戻る
          </Link>
        </div>

        <Card className="p-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="キーワードで検索…"
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="p-5 space-y-3 border-primary/30">
          <h2 className="font-semibold">ログインできない場合</h2>
          <p className="text-sm text-muted-foreground">
            パスワードを忘れた、または登録メールアドレスを忘れた場合は、こちらから復旧できます。
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button asChild size="sm">
              <Link to="/forgot">パスワードを再設定</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/forgot">メールアドレスを確認</Link>
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {items.length === 0 ? "まだ FAQ がありません。" : "該当する項目がありません。"}
            </p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {filtered.map((f) => (
                <AccordionItem key={f.id} value={f.id}>
                  <AccordionTrigger className="text-left">Q. {f.question}</AccordionTrigger>
                  <AccordionContent className="whitespace-pre-wrap text-sm">
                    {f.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </Card>
      </div>
    </div>
  );
}