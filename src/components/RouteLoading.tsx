import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/** ページ遷移中: 上部進捗バー + 全画面のクリック封じオーバーレイ */
export function RouteLoading() {
  const isLoading = useRouterState({ select: (s) => s.status === "pending" || s.isLoading });
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      // 完了演出
      if (visible) {
        setProgress(100);
        const t = setTimeout(() => { setVisible(false); setProgress(0); }, 250);
        return () => clearTimeout(t);
      }
      return;
    }
    setVisible(true);
    setProgress(8);
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        return p + Math.max(0.5, (90 - p) * 0.08);
      });
    }, 120);
    return () => clearInterval(id);
  }, [isLoading]);

  if (!visible) return null;

  return (
    <>
      {/* 上部の進捗ライン */}
      <div className="fixed inset-x-0 top-0 z-[100] h-0.5 bg-transparent pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-primary via-emerald-400 to-primary shadow-[0_0_8px_oklch(0.7_0.18_150)] transition-[width] duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* 全画面: タップ封じ + うっすらブラー */}
      <div
        className="fixed inset-0 z-[99] bg-background/40 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-xs text-muted-foreground">読み込み中…</p>
        </div>
      </div>
    </>
  );
}
