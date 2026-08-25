import { createFileRoute, Link } from "@tanstack/react-router";
import { PRIVACY, LAST_UPDATED } from "@/content/legal";

const PRIVACY_TITLE = "プライバシーポリシー｜Study#";
const PRIVACY_DESC = "Study# のプライバシーポリシー。取得する個人情報、利用目的、第三者提供、利用者の権利について説明します。";
const PRIVACY_URL = "https://sharp-voton.lovable.app/privacy";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: PRIVACY_TITLE },
      { name: "description", content: PRIVACY_DESC },
      { property: "og:title", content: PRIVACY_TITLE },
      { property: "og:description", content: PRIVACY_DESC },
      { property: "og:url", content: PRIVACY_URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: PRIVACY_URL }],
  }),
  component: PrivacyPage,
});


function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-primary hover:underline">&larr; ホームへ</Link>
        <div className="prose prose-sm sm:prose-base dark:prose-invert mt-4 max-w-none whitespace-pre-wrap font-sans">
          <LegalRender source={PRIVACY} />
        </div>
        <p className="mt-8 text-xs text-muted-foreground">最終更新日: {LAST_UPDATED}</p>
      </div>
    </div>
  );
}

function LegalRender({ source }: { source: string }) {
  const lines = source.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i} className="text-3xl font-bold mt-6 mb-4">{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold mt-6 mb-2">{line.slice(3)}</h2>;
        if (line.startsWith("- ")) return <li key={i} className="ml-6 list-disc">{line.slice(2)}</li>;
        if (line.trim() === "---") return <hr key={i} className="my-6" />;
        if (line.trim() === "") return <div key={i} className="h-3" />;
        return <p key={i} className="leading-relaxed">{line}</p>;
      })}
    </>
  );
}
