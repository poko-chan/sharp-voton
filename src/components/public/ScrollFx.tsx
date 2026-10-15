import { useEffect, useRef } from "react";

/**
 * 説明ページ用の軽量スクロール演出。
 * - 上部の読了プログレスバー
 * - section 見出しとグリッドの子要素を時間差でフェードアップ
 * prefers-reduced-motion 時は何もしない。
 */
export function ScrollFx({ root = ".landing-premium" }: { root?: string }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const host = document.querySelector(root);

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        const p = max > 0 ? h.scrollTop / max : 0;
        if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    let io: IntersectionObserver | null = null;
    if (host && !reduce && "IntersectionObserver" in window) {
      const targets: HTMLElement[] = [];
      host.querySelectorAll<HTMLElement>("section").forEach((sec, si) => {
        if (si === 0) return; // ファーストビューは即表示
        sec.querySelectorAll<HTMLElement>("h2, .grid > *").forEach((el) => {
          const parent = el.parentElement;
          const idx =
            parent && parent.classList.contains("grid")
              ? Array.prototype.indexOf.call(parent.children, el)
              : 0;
          el.classList.add("sfx-reveal");
          el.style.setProperty("--sfx-delay", `${Math.min(idx, 8) * 60}ms`);
          targets.push(el);
        });
      });
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("sfx-in");
              io?.unobserve(e.target);
            }
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
      );
      targets.forEach((t) => io!.observe(t));
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [root]);

  return <div ref={barRef} className="sfx-progress" aria-hidden />;
}
