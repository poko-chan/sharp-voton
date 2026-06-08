import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserPrefs = {
  widgets: string[];
  font_scale: number;
  high_contrast: boolean;
  right_dock: string[];
  sidebar_hidden: string[];
  act_as_admin: boolean;
  theme_color?: string;
  notif_settings?: Record<string, boolean>;
};
const DEFAULT: UserPrefs = {
  widgets: ["streak", "today-chart", "weekly-diff", "habits"],
  font_scale: 1.0,
  high_contrast: false,
  right_dock: ["ambient", "feedback"],
  sidebar_hidden: [],
  act_as_admin: false,
  theme_color: "#3B82F6",
  notif_settings: {},
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
        theme_color: (data as any).theme_color ?? DEFAULT.theme_color,
        notif_settings: ((data as any).notif_settings as any) ?? {},
      });
    })();
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.fontSize = `${prefs.font_scale * 16}px`;
    document.documentElement.classList.toggle("high-contrast", prefs.high_contrast);
    if (prefs.theme_color) document.documentElement.style.setProperty("--primary", prefs.theme_color);
  }, [prefs.font_scale, prefs.high_contrast, prefs.theme_color]);
  const save = async (patch: Partial<UserPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_prefs").upsert({ user_id: user.id, ...next });
  };
  return { prefs, save };
}