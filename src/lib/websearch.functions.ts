import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WebResult = { title: string; snippet: string; url: string; source: string };

const strip = (html: string) =>
  html.replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();

async function wikipedia(q: string): Promise<WebResult[]> {
  const url =
    `https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}` +
    `&srlimit=3&format=json&origin=*`;
  const r = await fetch(url, { headers: { "user-agent": "StudySharp/1.0" } });
  if (!r.ok) return [];
  const j: any = await r.json();
  return (j?.query?.search ?? []).map((s: any) => ({
    title: s.title,
    snippet: strip(s.snippet ?? ""),
    url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(s.title)}`,
    source: "Wikipedia",
  }));
}

async function duckduckgo(q: string): Promise<WebResult[]> {
  const r = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}&kl=jp-jp`, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36" },
  });
  if (!r.ok) return [];
  const html = await r.text();
  const out: WebResult[] = [];
  const re = /href="([^"]+)"[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>[\s\S]*?class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 4) {
    let link = m[1];
    const uddg = /uddg=([^&]+)/.exec(link);
    if (uddg) link = decodeURIComponent(uddg[1]);
    if (link.startsWith("//")) link = `https:${link}`;
    const title = strip(m[2]);
    const snippet = strip(m[3]).slice(0, 300);
    if (title && link.startsWith("http")) {
      try {
        out.push({ title, snippet, url: link, source: new URL(link).hostname.replace(/^www\./, "") });
      } catch { /* 無効なURLは無視 */ }
    }
  }
  return out;
}

/** 学習質問の事実確認に使う軽量Web検索（外部APIキー不要）。 */
export const webSearch = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ query: z.string().min(1).max(300) }).parse(i))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const q = data.query.trim();
    const timeout = <T,>(p: Promise<T>, ms: number) =>
      Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

    const [ddg, wiki] = await Promise.allSettled([
      timeout(duckduckgo(q), 6000),
      timeout(wikipedia(q), 6000),
    ]);
    const results = [
      ...(ddg.status === "fulfilled" ? ddg.value : []),
      ...(wiki.status === "fulfilled" ? wiki.value : []),
    ];
    const seen = new Set<string>();
    const unique = results.filter((r) => !seen.has(r.url) && seen.add(r.url)).slice(0, 5);
    return { query: q, results: unique };
  });
