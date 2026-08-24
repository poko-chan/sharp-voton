import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { translateBatch } from "@/lib/translate.functions";

/**
 * 画面上の日本語テキストを、選択中の言語へ自動翻訳して差し替えるレイヤー。
 * 辞書(i18n)で対応済みの文字列はそのまま英語等になり、未対応の箇所をここが埋める。
 * 翻訳結果は localStorage にキャッシュするため、2回目以降は即時に反映される。
 */

const JP = /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "SVG", "CANVAS"]);
const cacheKeyFor = (lang: string) => `studyplus.tcache.${lang}`;

function loadCache(lang: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(cacheKeyFor(lang)) || "{}");
  } catch {
    return {};
  }
}
function saveCache(lang: string, cache: Record<string, string>) {
  try {
    localStorage.setItem(cacheKeyFor(lang), JSON.stringify(cache));
  } catch {
    /* quota: ignore */
  }
}

export function AutoTranslate() {
  const { lang } = useI18n();

  useEffect(() => {
    if (lang === "ja" || typeof window === "undefined") return;
    let disposed = false;
    const cache = loadCache(lang);
    const pending = new Map<string, Array<() => void>>();
    let timer: number | undefined;
    let running = false;

    const applyCached = (text: string) => cache[text.trim()];

    const collect = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const el = node.parentElement;
          if (!el) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
          if (el.closest("[data-no-translate]")) return NodeFilter.FILTER_REJECT;
          const v = node.nodeValue ?? "";
          if (!v.trim() || !JP.test(v)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const nodes: Text[] = [];
      if (root.nodeType === Node.TEXT_NODE) {
        const v = root.nodeValue ?? "";
        if (v.trim() && JP.test(v)) nodes.push(root as Text);
      }
      let n = walker.nextNode();
      while (n) {
        nodes.push(n as Text);
        n = walker.nextNode();
      }
      // placeholder / title / aria-label
      const attrTargets: Array<[Element, string]> = [];
      const el = root instanceof Element ? root : (root.parentElement ?? document.body);
      for (const attr of ["placeholder", "title", "aria-label"]) {
        el.querySelectorAll(`[${attr}]`).forEach((e) => {
          const v = e.getAttribute(attr) ?? "";
          if (v.trim() && JP.test(v)) attrTargets.push([e, attr]);
        });
      }

      for (const node of nodes) {
        const raw = node.nodeValue ?? "";
        const key = raw.trim();
        const hit = applyCached(key);
        if (hit) {
          node.nodeValue = raw.replace(key, hit);
          continue;
        }
        const apply = () => {
          const t = cache[key];
          if (t && node.isConnected) node.nodeValue = (node.nodeValue ?? "").replace(key, t);
        };
        pending.set(key, [...(pending.get(key) ?? []), apply]);
      }
      for (const [e, attr] of attrTargets) {
        const key = (e.getAttribute(attr) ?? "").trim();
        const hit = applyCached(key);
        if (hit) {
          e.setAttribute(attr, hit);
          continue;
        }
        const apply = () => {
          const t = cache[key];
          if (t) e.setAttribute(attr, t);
        };
        pending.set(key, [...(pending.get(key) ?? []), apply]);
      }
    };

    const flush = async () => {
      if (running || disposed) return;
      const keys = Array.from(pending.keys()).filter((k) => !cache[k]);
      if (keys.length === 0) {
        pending.clear();
        return;
      }
      running = true;
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < keys.length; i += 40) chunks.push(keys.slice(i, i + 40));
        // 3チャンクずつ並列に投げて初回の待ち時間を短縮する
        for (let g = 0; g < chunks.length; g += 3) {
          const group = chunks.slice(g, g + 3);
          const results = await Promise.all(
            group.map((chunk) =>
              translateBatch({ data: { texts: chunk, target: lang } })
                .then((r) => r.translations)
                .catch(() => chunk),
            ),
          );
          group.forEach((chunk, ci) => {
            chunk.forEach((k, idx) => {
              const v = results[ci][idx];
              if (v && v !== k) cache[k] = v;
            });
          });
          saveCache(lang, cache);
          for (const chunk of group) {
            for (const k of chunk) {
              for (const fn of pending.get(k) ?? []) fn();
              pending.delete(k);
            }
          }
          if (disposed) return;
        }
      } catch (e) {
        console.error("auto-translate failed", e);
      } finally {
        running = false;
        pending.clear();
      }
    };

    const schedule = (root: Node) => {
      collect(root);
      window.clearTimeout(timer);
      timer = window.setTimeout(flush, 500);
    };

    schedule(document.body);

    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "childList") {
          r.addedNodes.forEach((n) => {
            if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE) schedule(n);
          });
        } else if (r.type === "characterData" && r.target.nodeValue && JP.test(r.target.nodeValue)) {
          schedule(r.target.parentNode ?? document.body);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [lang]);

  return null;
}
