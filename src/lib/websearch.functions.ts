import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WebResult = { title: string; snippet: string; url: string; source: string };
export type WebSearchResponse = {
  query: string;
  results: WebResult[];
  providers: string[];
  cached: boolean;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const strip = (html: string) =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const clip = (s: string, n = 320) => (s.length > n ? `${s.slice(0, n)}…` : s);

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

/** Wikipedia の検索＋導入文（スニペットより情報量が多い）。 */
async function wikipedia(q: string, lang: "ja" | "en"): Promise<WebResult[]> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=3` +
    `&prop=extracts|info&exintro=1&explaintext=1&exlimit=3&inprop=url`;
  const r = await fetch(url, { headers: { "user-agent": "StudySharp/1.0 (education assistant)" } });
  if (!r.ok) return [];
  const j: any = await r.json();
  const pages: any[] = Object.values(j?.query?.pages ?? {});
  return pages
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
    .map((p) => ({
      title: String(p.title ?? ""),
      snippet: clip(strip(String(p.extract ?? ""))),
      url: String(p.fullurl ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title)}`),
      source: lang === "ja" ? "Wikipedia" : "Wikipedia (EN)",
    }))
    .filter((r0) => r0.title && r0.snippet);
}

/** DuckDuckGo Instant Answer（要約と関連トピック）。 */
async function ddgInstant(q: string): Promise<WebResult[]> {
  const r = await fetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&no_redirect=1&kl=jp-jp`,
    { headers: { "user-agent": UA } },
  );
  if (!r.ok) return [];
  const j: any = await r.json();
  const out: WebResult[] = [];
  if (j?.AbstractText && j?.AbstractURL) {
    out.push({
      title: String(j.Heading || q),
      snippet: clip(strip(String(j.AbstractText))),
      url: String(j.AbstractURL),
      source: String(j.AbstractSource || hostOf(j.AbstractURL)),
    });
  }
  for (const t of (j?.RelatedTopics ?? []).slice(0, 6)) {
    const items = t?.Topics ? t.Topics : [t];
    for (const it of items) {
      const url = String(it?.FirstURL ?? "");
      const text = strip(String(it?.Text ?? ""));
      if (!url || !text || url.includes("duckduckgo.com/c/")) continue;
      out.push({ title: text.split(" - ")[0].slice(0, 80), snippet: clip(text), url, source: hostOf(url) });
      if (out.length >= 5) break;
    }
    if (out.length >= 5) break;
  }
  return out;
}

/** DuckDuckGo Lite（取得できれば一般Webの結果も足す。ブロックされることがある）。 */
async function ddgLite(q: string): Promise<WebResult[]> {
  const r = await fetch("https://lite.duckduckgo.com/lite/", {
    method: "POST",
    headers: {
      "user-agent": UA,
      "content-type": "application/x-www-form-urlencoded",
      "accept-language": "ja,en;q=0.8",
    },
    body: new URLSearchParams({ q, kl: "jp-jp" }),
  });
  if (!r.ok) return [];
  const html = await r.text();
  if (!html.includes("result-link")) return [];
  const out: WebResult[] = [];
  const re =
    /href="([^"]+)"[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>[\s\S]*?class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 5) {
    let link = m[1];
    const uddg = /uddg=([^&]+)/.exec(link);
    if (uddg) link = decodeURIComponent(uddg[1]);
    if (link.startsWith("//")) link = `https:${link}`;
    const title = strip(m[2]);
    const snippet = clip(strip(m[3]));
    if (title && link.startsWith("http")) out.push({ title, snippet, url: link, source: hostOf(link) });
  }
  return out;
}

const normalizeLink = (href: string) => {
  let link = href;
  const uddg = /uddg=([^&]+)/.exec(link);
  if (uddg) link = decodeURIComponent(uddg[1]);
  if (link.startsWith("//")) link = `https:${link}`;
  return link;
};

/** 一般Web検索（DuckDuckGo HTML版）。Wikipedia以外のサイトを拾う主力。 */
async function ddgWeb(q: string): Promise<WebResult[]> {
  const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=jp-jp`, {
    headers: { "user-agent": UA, "accept-language": "ja,en;q=0.8" },
  });
  if (!r.ok) return [];
  const html = await r.text();
  if (!html.includes("result__a")) return [];
  const out: WebResult[] = [];
  const re =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 6) {
    const link = normalizeLink(m[1]);
    const title = strip(m[2]);
    const snippet = clip(strip(m[3]));
    if (title && link.startsWith("http")) out.push({ title, snippet, url: link, source: hostOf(link) });
  }
  return out;
}

/** 時事・最新情報向けのニュース検索（Google ニュース RSS）。 */
async function newsSearch(q: string): Promise<WebResult[]> {
  const r = await fetch(
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ja&gl=JP&ceid=JP:ja`,
    { headers: { "user-agent": UA } },
  );
  if (!r.ok) return [];
  const xml = await r.text();
  const out: WebResult[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && out.length < 4) {
    const block = m[1];
    const rawTitle = strip(/<title>([\s\S]*?)<\/title>/.exec(block)?.[1] ?? "");
    const link = strip(/<link>([\s\S]*?)<\/link>/.exec(block)?.[1] ?? "");
    const date = strip(/<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1] ?? "");
    const src = strip(/<source[^>]*>([\s\S]*?)<\/source>/.exec(block)?.[1] ?? "");
    if (!rawTitle || !link.startsWith("http")) continue;
    const title = rawTitle.replace(/\s-\s[^-]+$/, "");
    out.push({
      title,
      snippet: clip(`${date ? `${new Date(date).toLocaleDateString("ja-JP")}｜` : ""}${rawTitle}`),
      url: link,
      source: src || "ニュース",
    });
  }
  return out;
}

/** 用語・言葉の意味は辞書（Wiktionary）も参照する。 */
async function wiktionary(q: string): Promise<WebResult[]> {
  const term = q.split(/\s+/)[0].slice(0, 40);
  const r = await fetch(
    `https://ja.wiktionary.org/w/api.php?action=query&format=json&origin=*&prop=extracts&explaintext=1&exintro=1&redirects=1&titles=${encodeURIComponent(term)}`,
    { headers: { "user-agent": "StudySharp/1.0 (education assistant)" } },
  );
  if (!r.ok) return [];
  const j: any = await r.json();
  const pages: any[] = Object.values(j?.query?.pages ?? {});
  return pages
    .filter((p) => p?.extract)
    .map((p) => ({
      title: `${p.title}（辞書）`,
      snippet: clip(strip(String(p.extract))),
      url: `https://ja.wiktionary.org/wiki/${encodeURIComponent(p.title)}`,
      source: "Wiktionary",
    }));
}


function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "web"; }
}

/** 信頼できそうな出典を上に。 */
const TRUSTED = /(wikipedia\.org|go\.jp|ac\.jp|\.edu|nhk\.or\.jp|mext\.go\.jp|britannica\.com)/;
function rank(results: WebResult[], q: string): WebResult[] {
  const terms = q.split(/\s+/).filter((t) => t.length >= 2);
  const score = (r: WebResult) => {
    let s = 0;
    if (TRUSTED.test(r.url)) s += 3;
    if (r.source.startsWith("Wikipedia")) s += 1;
    for (const t of terms) {
      if (r.title.includes(t)) s += 2;
      if (r.snippet.includes(t)) s += 1;
    }
    s += Math.min(2, Math.floor(r.snippet.length / 120));
    return s;
  };
  return [...results].sort((a, b) => score(b) - score(a));
}

// 同じ質問を短時間に繰り返したときの無駄打ちを防ぐ簡易キャッシュ
const CACHE = new Map<string, { at: number; value: WebSearchResponse }>();
const PAGE_CACHE = new Map<string, { at: number; value: PageFetchResponse }>();
const TTL = 10 * 60 * 1000;

export type PageFetchResponse = {
  url: string;
  finalUrl: string;
  title: string;
  text: string;
  ok: boolean;
  error?: string;
};

/** HTMLから読める本文だけを抜き出す（密度ベースの簡易リーダー）。 */
function extractReadable(html: string): { title: string; text: string } {
  const title = strip(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").slice(0, 120);
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ");
  // 段落・見出し・リストの区切りを改行として残す
  body = body.replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, "\n");
  const text = strip(body)
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 20 || /[。！？.!?]$/.test(l))
    .filter((l) => !/^(cookie|著作権|©|all rights|利用規約|プライバシー)/i.test(l))
    .join("\n");
  return { title, text };
}

/**
 * どのサイトでも本文を読み取る汎用ページ取得。
 * チャットにURLを貼ると、AIがその内容を根拠に答えられるようになる。
 */
export const fetchPage = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ url: z.string().min(8).max(2000), maxChars: z.number().int().min(500).max(8000).optional() }).parse(i),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }): Promise<PageFetchResponse> => {
    let url = data.url.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const maxChars = data.maxChars ?? 4000;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { url, finalUrl: url, title: "", text: "", ok: false, error: "URLの形式が正しくありません" };
    }
    // ローカル・内部アドレスへのアクセスは拒否（安全のため）
    if (!/^https?:$/.test(parsed.protocol) || /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1)/.test(parsed.hostname)) {
      return { url, finalUrl: url, title: "", text: "", ok: false, error: "このアドレスにはアクセスできません" };
    }

    const key = `${url}::${maxChars}`;
    const hit = PAGE_CACHE.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.value;

    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, "accept-language": "ja,en;q=0.8", accept: "text/html,application/xhtml+xml" },
        redirect: "follow",
      });
      const finalUrl = res.url || url;
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        return { url, finalUrl, title: "", text: "", ok: false, error: `ページを開けませんでした（${res.status}）` };
      }
      if (!ct.includes("html") && !ct.includes("text")) {
        return { url, finalUrl, title: "", text: "", ok: false, error: "HTMLページではないため読み取れません（PDF・画像など）" };
      }
      const html = (await res.text()).slice(0, 1_500_000);
      const { title, text } = extractReadable(html);
      if (!text) return { url, finalUrl, title, text: "", ok: false, error: "本文を読み取れませんでした（ログインが必要なページの可能性があります）" };
      const clipped = text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
      const value: PageFetchResponse = { url, finalUrl, title, text: clipped, ok: true };
      PAGE_CACHE.set(key, { at: Date.now(), value });
      if (PAGE_CACHE.size > 100) PAGE_CACHE.delete(PAGE_CACHE.keys().next().value as string);
      return value;
    } catch (e: any) {
      return { url, finalUrl: url, title: "", text: "", ok: false, error: `アクセスに失敗しました（${String(e?.message ?? e).slice(0, 80)}）` };
    }
  });

/** 学習質問の事実確認に使う軽量Web検索（外部APIキー不要・複数ソースで冗長化）。 */
export const webSearch = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      query: z.string().min(1).max(300),
      limit: z.number().int().min(1).max(8).optional(),
    }).parse(i),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }): Promise<WebSearchResponse> => {
    const q = data.query.trim().replace(/\s+/g, " ");
    const limit = data.limit ?? 5;
    const key = `${q}::${limit}`;

    const hit = CACHE.get(key);
    if (hit && Date.now() - hit.at < TTL) return { ...hit.value, cached: true };

    const wantsNews = /(最新|今年|去年|今月|ニュース|速報|発表|動向|話題|20\d\d年)/.test(q);
    const wantsDict = /(意味|語源|由来|読み方|とは)/.test(q);

    const tasks: Array<[string, Promise<WebResult[]>]> = [
      ["web", timeout(ddgWeb(q), 7000)],
      ["wikipedia", timeout(wikipedia(q, "ja"), 6000)],
      ["duckduckgo", timeout(ddgInstant(q), 6000)],
    ];
    if (wantsNews) tasks.push(["news", timeout(newsSearch(q), 6000)]);
    if (wantsDict) tasks.push(["dictionary", timeout(wiktionary(q), 5000)]);

    const settled = await Promise.allSettled(tasks.map(([, p]) => p));

    const providers: string[] = [];
    let results: WebResult[] = [];
    settled.forEach((s, i) => {
      if (s.status === "fulfilled" && s.value.length) {
        providers.push(tasks[i][0]);
        results = results.concat(s.value);
      }
    });

    // 何も取れなければ 軽量版DDG → 英語Wikipedia の順にフォールバック
    if (results.length === 0) {
      const lite = await timeout(ddgLite(q), 6000).catch(() => [] as WebResult[]);
      if (lite.length) { providers.push("web-lite"); results = lite; }
    }
    if (results.length === 0) {
      const en = await timeout(wikipedia(q, "en"), 6000).catch(() => [] as WebResult[]);
      if (en.length) { providers.push("wikipedia-en"); results = en; }
    }


    const seenUrl = new Set<string>();
    const seenTitle = new Set<string>();
    const perHost = new Map<string, number>();
    const unique = rank(results, q).filter((r) => {
      const t = r.title.toLowerCase();
      const h = hostOf(r.url);
      if (seenUrl.has(r.url) || seenTitle.has(t)) return false;
      // 1つのサイトに偏らせず、いろいろな出典を混ぜる
      if ((perHost.get(h) ?? 0) >= 2) return false;
      seenUrl.add(r.url); seenTitle.add(t); perHost.set(h, (perHost.get(h) ?? 0) + 1);
      return true;
    }).slice(0, limit);


    const value: WebSearchResponse = { query: q, results: unique, providers, cached: false };
    CACHE.set(key, { at: Date.now(), value });
    if (CACHE.size > 200) CACHE.delete(CACHE.keys().next().value as string);
    return value;
  });
