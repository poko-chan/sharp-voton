import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicAmbient, PublicFooter, PublicHeader } from "@/components/public/PublicShell";
import { TRUST } from "@/content/services";

const URL = "https://sharp-voton.lovable.app/security";
const TITLE = "安全性とデータの扱い｜Study#";
const DESC =
  "アカウント保護、行単位のアクセス制御、正答データのサーバー保持、削除の7日間猶予など、Study# がデータをどう守っているかを説明します。";

export const Route = createFileRoute("/security")({
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
  component: SecurityPage,
});

const BLOCKS = [
  {
    t: "データは「行単位」で守っています",
    d: "学習記録・チャット・組織のデータなどは、データベース側で「誰がその行を読める・書けるか」を定義しています。ログインしていても、権限のないデータはそもそも取得できません。",
  },
  {
    t: "答えはサーバー側に置いています",
    d: "小テストや組織教材の正答は、問題を解いている画面には送っていません。採点はサーバー側で行うため、ブラウザの開発者ツールから答えを先に見ることはできません。",
  },
  {
    t: "ログインとアカウント",
    d: "ユーザー名＋パスワード、またはGoogleなどの外部アカウントでログインできます。パスワードを忘れた場合の再設定と、登録メールアドレスがわからない場合の復旧フローを用意しています。",
  },
  {
    t: "削除は7日間の猶予つき",
    d: "アカウント削除を申請しても、7日間はキャンセルできます。誤操作で学習記録を失わないための仕組みです。",
  },
  {
    t: "使いすぎを止められる",
    d: "運営および組織の管理者は、機能単位で利用を制限できます。学習に関係ない機能をオフにした状態での運用も可能です。",
  },
];

function SecurityPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <PublicAmbient />
      <PublicHeader width="max-w-4xl" />
      <main className="mx-auto max-w-4xl px-4 py-14 sm:py-20">
        <p className="section-eyebrow">Security</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight sm:text-5xl">
          安全性と<span className="text-gradient">データの扱い</span>
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          学習記録は、続けるほど大切になっていくデータです。Study# がどのようにデータを守っているかを、できるだけ具体的に説明します。
        </p>

        <div className="mt-10 space-y-3">
          {BLOCKS.map((b) => (
            <article key={b.t} className="surface p-5">
              <h2 className="font-display font-extrabold">{b.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.d}</p>
            </article>
          ))}
        </div>

        {TRUST.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-2xl font-black tracking-tight">安心して使うための仕組み</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {TRUST.map((s) => (
                <div key={s.t} className="surface p-5">
                  <h3 className="font-semibold">{s.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="surface mt-10 border-primary/30 p-6">
          <h2 className="font-display text-lg font-extrabold">くわしい取り扱いについて</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            収集する情報の範囲や利用目的は、プライバシーポリシーに記載しています。
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-primary">
            <Link to="/privacy" className="underline-offset-4 hover:underline">
              プライバシーポリシー →
            </Link>
            <Link to="/terms" className="underline-offset-4 hover:underline">
              利用規約 →
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter width="max-w-4xl" />
    </div>
  );
}
