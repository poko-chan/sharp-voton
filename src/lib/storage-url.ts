import { supabase } from "@/integrations/supabase/client";

/** Long-lived signed URL for private buckets (1 year). */
export const SIGNED_URL_TTL = 60 * 60 * 24 * 365;

export async function signedUrl(bucket: string, path: string, ttl = SIGNED_URL_TTL): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttl);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "ファイルURLの発行に失敗しました");
  return data.signedUrl;
}
