import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export type SubjectLite = { id: string; name: string; color?: string; sort_order?: number };

/** 教科一覧をユーザー設定の並び順（sort_order → created_at）で取得する共通フック */
export function useOrderedSubjects() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<SubjectLite[]>([]);

  const reload = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("subjects")
      .select("id,name,color,sort_order")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setSubjects((data as SubjectLite[]) ?? []);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  /** 指定した教科を上下に1つ移動し、sort_order をDBへ保存する */
  const move = useCallback(
    async (id: string, direction: "up" | "down") => {
      setSubjects((prev) => {
        const idx = prev.findIndex((s) => s.id === id);
        if (idx < 0) return prev;
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= prev.length) return prev;
        const next = [...prev];
        [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
        const updated = next.map((s, i) => ({ ...s, sort_order: i }));
        Promise.all(
          updated.map((s) => supabase.from("subjects").update({ sort_order: s.sort_order }).eq("id", s.id)),
        );
        return updated;
      });
    },
    [],
  );

  return { subjects, reload, move };
}
