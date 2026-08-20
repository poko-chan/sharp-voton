import { createFileRoute, Link } from "@tanstack/react-router";
import { TERMS, LAST_UPDATED } from "@/content/legal";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "利用規約｜StudyΩ" },
      { name: "description", content: "StudyΩ の利用規約。アカウント登録、禁止事項、AI機能の利用、免責事項などについて定めています。" },
    ],
    links: [{ rel: "canonical", href: "https://studyplus-voton.lovable.app/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-primary hover:underline">&larr; ホームへ</Link>
        <div className="prose prose-sm sm:prose-base dark:prose-invert mt-4 max-w-none whitespace-pre-wrap font-sans">
          <LegalRender source={TERMS} />
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
