import { Link } from "@tanstack/react-router";
import { GoogleTranslateWidget } from "@/components/GoogleTranslateWidget";
import logoUrl from "@/assets/logo.png";
import { cn } from "@/lib/utils";

type NavKey = "features" | "all-services" | "for-schools" | "guide" | "help";

const NAV: { key: NavKey; label: string; to: string }[] = [
  { key: "all-services", label: "全機能", to: "/all-services" },
  { key: "guide", label: "使い方", to: "/guide" },
  { key: "for-schools", label: "学校・塾の方へ", to: "/for-schools" },
  { key: "help", label: "ヘルプ", to: "/help" },
];

/** 公開ページ共通のヘッダー。current で現在地をハイライトする。 */
export function PublicHeader({ current, width = "max-w-6xl" }: { current?: NavKey; width?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b liquid-bar">
      <div className={cn("mx-auto flex items-center justify-between gap-3 px-4 py-3", width)}>
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logoUrl} alt="Study# ロゴ" width={32} height={32} className="h-8 w-8 rounded-xl shadow-sm" />
          <span className="font-display text-lg font-extrabold tracking-tight">
            Study<span className="text-gradient">#</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.key}
              to={n.to}
              className={cn(
                "hidden rounded-full px-3.5 py-2 transition sm:inline-block",
                current === n.key
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
          <Link to="/login" className="cta px-5 py-2 text-sm">
            無料ではじめる
          </Link>
          <GoogleTranslateWidget />
        </nav>
      </div>
    </header>
  );
}

/** 公開ページ共通のフッター。 */
export function PublicFooter({ width = "max-w-6xl" }: { width?: string }) {
  return (
    <footer className="mt-24 border-t border-border/50 py-12">
      <div className={cn("mx-auto grid gap-8 px-4 sm:grid-cols-2 lg:grid-cols-4", width)}>
        <div>
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="" width={24} height={24} loading="lazy" className="h-6 w-6 rounded-md" />
            <span className="font-display font-extrabold">
              Study<span className="text-gradient">#</span>
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            記録・集中・演習・AI・仲間・教室運営。学習にまつわるすべてを、ひとつのアプリに。
          </p>
        </div>
        <FooterCol
          title="サービス"
          links={[
            ["全機能一覧", "/all-services"],
            ["使い方ガイド", "/guide"],
            ["学校・塾の方へ", "/for-schools"],
          ]}
        />
        <FooterCol
          title="サポート"
          links={[
            ["ヘルプセンター", "/help"],
            ["ログイン / 新規登録", "/login"],
            ["パスワードをお忘れの方", "/forgot"],
          ]}
        />
        <FooterCol
          title="規約"
          links={[
            ["利用規約", "/terms"],
            ["プライバシーポリシー", "/privacy"],
          ]}
        />
      </div>
      <div
        className={cn(
          "mx-auto mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/40 px-4 pt-6 text-xs text-muted-foreground sm:flex-row",
          width,
        )}
      >
        <span>© {new Date().getFullYear()} Study#</span>
        <GoogleTranslateWidget />
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([label, to]) => (
          <li key={to}>
            <Link to={to} className="text-muted-foreground transition hover:text-foreground">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 背景のアンビエントグロー。 */
export function PublicAmbient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute -left-32 -top-40 h-[26rem] w-[26rem] rounded-full bg-primary/22 blur-[120px]" />
      <div className="absolute -right-24 top-1/4 h-[22rem] w-[22rem] rounded-full bg-accent/22 blur-[120px]" />
      <div className="absolute bottom-0 left-1/3 h-[20rem] w-[20rem] rounded-full bg-chart-4/18 blur-[130px]" />
    </div>
  );
}
