import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export type SubjectLite = { id: string; name: string; color?: string; sort_order?: number };

/** 教科一覧をユーザー設定の並び順（sort_order → created_at）で取得する共通フック */
export function useOrderedSubjects() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<SubjectLite[]>([]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("subjects")
      .select("id,name,color,sort_order")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (active) setSubjects((data as SubjectLite[]) ?? []);
      });
    return () => {
      active = false;
    };
  }, [user]);
  return subjects;
}
