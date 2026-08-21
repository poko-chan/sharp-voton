import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import logoUrl from "@/assets/logo.png";

const LINKS = [
  { to: "/features", label: "機能" },
  { to: "/guide", label: "使い方" },
  { to: "/for-schools", label: "学校・塾" },
] as const;

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      {/* Liquid background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="liquid-blob h-[42rem] w-[42rem] -left-40 -top-52 bg-primary/40" />
        <div className="liquid-blob h-[36rem] w-[36rem] right-[-12rem] top-24 bg-accent/40" style={{ animationDelay: "-6s" }} />
        <div className="liquid-blob h-[34rem] w-[34rem] left-1/3 bottom-[-14rem] bg-chart-4/30" style={{ animationDelay: "-11s" }} />
      </div>

      <header className="sticky top-0 z-40 border-b liquid-bar">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoUrl} alt="Voton Study Omega ロゴ" width={36} height={36} className="h-9 w-9 rounded-xl" />
            <span className="text-lg font-bold tracking-tight">Study<span className="text-gradient">Ω</span></span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="hidden rounded-xl px-3 py-2 hover:bg-card/60 sm:inline-block">
                {l.label}
              </Link>
            ))}
            <Link
              to="/login"
              className="rounded-xl bg-primary px-4 py-2 font-medium text-primary-foreground shadow-lg shadow-primary/25 transition hover:opacity-90"
            >
              はじめる
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-border/50 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="" width={24} height={24} loading="lazy" className="h-6 w-6 rounded-md" />
            <span>Voton Study Omega（StudyΩ）</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/features" className="hover:text-foreground">機能</Link>
            <Link to="/guide" className="hover:text-foreground">使い方</Link>
            <Link to="/for-schools" className="hover:text-foreground">学校・塾</Link>
            <Link to="/help" className="hover:text-foreground">ヘルプ</Link>
            <Link to="/terms" className="hover:text-foreground">利用規約</Link>
            <Link to="/privacy" className="hover:text-foreground">プライバシーポリシー</Link>
            <Link to="/login" className="hover:text-foreground">ログイン</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function GlassCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`liquid-card rounded-3xl border p-6 ${className}`}>{children}</div>;
}
