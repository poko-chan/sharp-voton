import { supabase } from "@/integrations/supabase/client";

export type PublicProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/** 他ユーザーの公開プロフィール（ユーザー名 / 表示名 / アイコン）のみを取得する */
export async function fetchPublicProfiles(ids: string[], client: any = supabase): Promise<PublicProfile[]> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (uniq.length === 0) return [];
  const { data, error } = await client.rpc("public_profiles_by_ids", { _ids: uniq });
  if (error) return [];
  return (data ?? []) as PublicProfile[];
}

export async function searchPublicProfiles(q: string, client: any = supabase): Promise<PublicProfile[]> {
  const { data, error } = await client.rpc("search_public_profiles", { _q: q });
  if (error) return [];
  return (data ?? []) as PublicProfile[];
}
