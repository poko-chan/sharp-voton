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
const TTL = 10 * 60 * 1000;

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

    const tasks: Array<[string, Promise<WebResult[]>]> = [
      ["wikipedia", timeout(wikipedia(q, "ja"), 6000)],
      ["duckduckgo", timeout(ddgInstant(q), 6000)],
      ["web", timeout(ddgLite(q), 6000)],
    ];
    const settled = await Promise.allSettled(tasks.map(([, p]) => p));

    const providers: string[] = [];
    let results: WebResult[] = [];
    settled.forEach((s, i) => {
      if (s.status === "fulfilled" && s.value.length) {
        providers.push(tasks[i][0]);
        results = results.concat(s.value);
      }
    });

    // 日本語で何も取れなければ英語Wikipediaへフォールバック
    if (results.length === 0) {
      const en = await timeout(wikipedia(q, "en"), 6000).catch(() => [] as WebResult[]);
      if (en.length) { providers.push("wikipedia-en"); results = en; }
    }

    const seenUrl = new Set<string>();
    const seenTitle = new Set<string>();
    const unique = rank(results, q).filter((r) => {
      const t = r.title.toLowerCase();
      if (seenUrl.has(r.url) || seenTitle.has(t)) return false;
      seenUrl.add(r.url); seenTitle.add(t);
      return true;
    }).slice(0, limit);

    const value: WebSearchResponse = { query: q, results: unique, providers, cached: false };
    CACHE.set(key, { at: Date.now(), value });
    if (CACHE.size > 200) CACHE.delete(CACHE.keys().next().value as string);
    return value;
  });
