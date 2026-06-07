import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserPrefs = {
  widgets: string[];
  font_scale: number;
  high_contrast: boolean;
  right_dock: string[];
  sidebar_hidden: string[];
  act_as_admin: boolean;
};
const DEFAULT: UserPrefs = {
  widgets: ["streak", "today-chart", "weekly-diff", "habits"],
  font_scale: 1.0,
  high_contrast: false,
  right_dock: ["ambient", "feedback"],
  sidebar_hidden: [],
  act_as_admin: false,
};

export function useUserPrefs() {
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_prefs").select("*").eq("user_id", user.id).maybeSingle();
      if (data) setPrefs({
        widgets: (data.widgets as string[]) ?? DEFAULT.widgets,
        font_scale: data.font_scale ?? 1,
        high_contrast: !!data.high_contrast,
        right_dock: ((data as any).right_dock as string[]) ?? DEFAULT.right_dock,
        sidebar_hidden: ((data as any).sidebar_hidden as string[]) ?? DEFAULT.sidebar_hidden,
        act_as_admin: !!(data as any).act_as_admin,
      });
    })();
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.fontSize = `${prefs.font_scale * 16}px`;
    document.documentElement.classList.toggle("high-contrast", prefs.high_contrast);
  }, [prefs.font_scale, prefs.high_contrast]);
  const save = async (patch: Partial<UserPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_prefs").upsert({ user_id: user.id, ...next });
  };
  return { prefs, save };
}