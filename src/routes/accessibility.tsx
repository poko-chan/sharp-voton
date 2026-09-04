import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicAmbient, PublicFooter, PublicHeader } from "@/components/public/PublicShell";

const URL = "https://sharp-voton.lovable.app/accessibility";
const TITLE = "アクセシビリティ｜Study#";
const DESC =
  "文字サイズ・UDフォント・行間・色覚フィルタ・高コントラスト・大きいタップ領域・読み上げなど、Study# のユニバーサルデザイン設定を紹介します。";

export const Route = createFileRoute("/accessibility")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: AccessibilityPage,
});

const GROUPS = [
  {
    t: "読みやすさ",
    items: [
      "読みやすいフォント（UD書体）に切り替え",
      "文字間隔・行間を広げる（数値でも調整可能）",
      "リンクに下線を付けて、色だけに頼らず判別",
      "画像を控えめに表示して文字に集中",
    ],
  },
  {
    t: "見え方",
    items: [
      "高コントラストモード",
      "色覚フィルタ（P型・D型・T型・白黒）",
      "ライト／ダークテーマの切り替え",
    ],
  },
  {
    t: "操作",
    items: [
      "タップ領域を44px以上に広げる",
      "キーボード操作時のフォーカス枠を強調",
      "大きいマウスカーソル",
      "動きを減らす（アニメーションの抑制）",
    ],
  },
  {
    t: "音声",
    items: ["選択したテキストの読み上げ（選択すると読み上げボタンが表示されます）"],
  },
];

function AccessibilityPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <PublicAmbient />
      <PublicHeader width="max-w-4xl" />
      <main className="mx-auto max-w-4xl px-4 py-14 sm:py-20">
        <p className="section-eyebrow">Accessibility</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight sm:text-5xl">
          誰でも使える<span className="text-gradient">ユニバーサルデザイン</span>
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          見え方や操作のしやすさは人によって違います。Study# ではログイン後の「設定 → アクセシビリティ」から、次の項目を自分に合わせて調整できます。設定はこの端末に保存され、すぐに画面へ反映されます。
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.t} className="surface p-5">
              <h2 className="font-display text-lg font-extrabold">{g.t}</h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                {g.items.map((i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="surface mt-8 border-primary/30 p-6">
          <h2 className="font-display text-lg font-extrabold">まだ足りないところがあれば</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            アクセシビリティの改善は続けています。使いづらい箇所があれば、アプリ内のフィードバックボタンからお知らせください。
          </p>
          <Link to="/help" className="mt-4 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline">
            ヘルプセンターへ →
          </Link>
        </section>
      </main>
      <PublicFooter width="max-w-4xl" />
    </div>
  );
}
