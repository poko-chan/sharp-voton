import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const FONT_OPTIONS: { value: string; label: string; css: string; href?: string }[] = [
  { value: "system", label: "システム標準", css: 'system-ui, -apple-system, "Segoe UI", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", sans-serif' },
  { value: "noto-sans-jp", label: "Noto Sans JP", css: '"Noto Sans JP", sans-serif', href: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" },
  { value: "noto-serif-jp", label: "Noto Serif JP（明朝）", css: '"Noto Serif JP", serif', href: "https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;700&display=swap" },
  { value: "m-plus-rounded-1c", label: "M PLUS Rounded 1c（丸ゴ）", css: '"M PLUS Rounded 1c", sans-serif', href: "https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700&display=swap" },
  { value: "kosugi-maru", label: "Kosugi Maru", css: '"Kosugi Maru", sans-serif', href: "https://fonts.googleapis.com/css2?family=Kosugi+Maru&display=swap" },
  { value: "zen-maru-gothic", label: "Zen Maru Gothic", css: '"Zen Maru Gothic", sans-serif', href: "https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&display=swap" },
  { value: "zen-kaku-gothic-new", label: "Zen Kaku Gothic New", css: '"Zen Kaku Gothic New", sans-serif', href: "https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap" },
  { value: "shippori-mincho", label: "Shippori Mincho（明朝）", css: '"Shippori Mincho", serif', href: "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;700&display=swap" },
  { value: "klee-one", label: "Klee One（手書き風）", css: '"Klee One", cursive', href: "https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&display=swap" },
  { value: "yusei-magic", label: "Yusei Magic（鉛筆風）", css: '"Yusei Magic", sans-serif', href: "https://fonts.googleapis.com/css2?family=Yusei+Magic&display=swap" },
  { value: "dela-gothic-one", label: "Dela Gothic One（極太）", css: '"Dela Gothic One", sans-serif', href: "https://fonts.googleapis.com/css2?family=Dela+Gothic+One&display=swap" },
];

export function applyFontFamily(value?: string) {
  if (typeof document === "undefined") return;
  const opt = FONT_OPTIONS.find((o) => o.value === value) ?? FONT_OPTIONS[0];
  if (opt.href) {
    const id = `gfont-${opt.value}`;
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id; link.rel = "stylesheet"; link.href = opt.href;
      document.head.appendChild(link);
    }
  }
  document.documentElement.style.setProperty("--font-sans", opt.css);
  document.body.style.fontFamily = opt.css;
}

export type UserPrefs = {
  widgets: string[];
  font_scale: number;
  high_contrast: boolean;
  right_dock: string[];
  sidebar_hidden: string[];
  act_as_admin: boolean;
  theme_color?: string;
  font_family?: string;
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
  font_family: "system",
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
        font_family: (data as any).font_family ?? DEFAULT.font_family,
        notif_settings: ((data as any).notif_settings as any) ?? {},
      });
    })();
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.fontSize = `${prefs.font_scale * 16}px`;
    document.documentElement.classList.toggle("high-contrast", prefs.high_contrast);
    if (prefs.theme_color) document.documentElement.style.setProperty("--primary", prefs.theme_color);
    applyFontFamily(prefs.font_family);
  }, [prefs.font_scale, prefs.high_contrast, prefs.theme_color, prefs.font_family]);
  const save = async (patch: Partial<UserPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_prefs").upsert({ user_id: user.id, ...next });
  };
  return { prefs, save };
}