import { createServerFn } from "@tanstack/react-start";

export type PublicFaq = { id: string; question: string; answer: string; order_index: number };

/** 公開 FAQ の一覧（未ログインでも取得可能）。help ページの本文と FAQPage 構造化データに使う。 */
export const listPublicFaqs = createServerFn({ method: "GET" }).handler(async (): Promise<PublicFaq[]> => {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return [];
  const client = createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data } = await client
    .from("faq_entries")
    .select("id, question, answer, order_index")
    .eq("published", true)
    .order("order_index");
  return (data ?? []) as PublicFaq[];
});
