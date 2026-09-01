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
  widgets: ["streak", "today-chart", "weekly-diff"],
  font_scale: 1.0,
  high_contrast: false,
  right_dock: ["ambient", "feedback"],
  sidebar_hidden: [],
  act_as_admin: false,
  // 未設定＝テーマ（data-theme / high-contrast）の配色をそのまま使う
  theme_color: undefined,
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
    // カスタム色が未設定のときはインラインスタイルを外し、テーマ側の配色を有効にする
    if (prefs.theme_color) document.documentElement.style.setProperty("--primary", prefs.theme_color);
    else document.documentElement.style.removeProperty("--primary");
    applyFontFamily(prefs.font_family);
  }, [prefs.font_scale, prefs.high_contrast, prefs.theme_color, prefs.font_family]);
  const save = async (patch: Partial<UserPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any).from("user_prefs").upsert({ user_id: user.id, ...next, theme_color: next.theme_color ?? null });
  };
  return { prefs, save };
}
// ============================================================================
// ローカル保存の追加設定（DBカラムを持たないもの）。localStorage に保存する。
// ============================================================================
export type LocalPrefs = {
  week_start_day: 0 | 1; // 0=日曜, 1=月曜
  default_subject_id: string | null;
  timer_default_minutes: number;
  timer_auto_break: boolean;
  timer_break_minutes: number;
  sound_enabled: boolean;
  dashboard_cards: string[];
  list_page_size: number;
  reduce_motion: boolean;
  compact_mode: boolean;
  readable_font: boolean;
  text_spacing: boolean;
  line_height: number;
  letter_spacing: number;
  underline_links: boolean;
  large_targets: boolean;
  focus_ring: boolean;
  big_cursor: boolean;
  color_filter: "none" | "grayscale" | "protanopia" | "deuteranopia" | "tritanopia";
  hide_images: boolean;
  tts_enabled: boolean;
};

export const DASHBOARD_CARD_OPTIONS: { value: string; label: string }[] = [
  { value: "streak", label: "連続記録" },
  { value: "today-chart", label: "今日のグラフ" },
  { value: "weekly-diff", label: "週間の変化" },
  { value: "goals", label: "目標" },
  { value: "calendar", label: "カレンダー" },
  { value: "ai-tips", label: "AIからのヒント" },
];

export const DEFAULT_LOCAL_PREFS: LocalPrefs = {
  week_start_day: 1,
  default_subject_id: null,
  timer_default_minutes: 25,
  timer_auto_break: false,
  timer_break_minutes: 5,
  sound_enabled: true,
  dashboard_cards: ["streak", "today-chart", "weekly-diff"],
  list_page_size: 20,
  reduce_motion: false,
  compact_mode: false,
  readable_font: false,
  text_spacing: false,
  line_height: 1.6,
  letter_spacing: 0,
  underline_links: false,
  large_targets: false,
  focus_ring: false,
  big_cursor: false,
  color_filter: "none",
  hide_images: false,
  tts_enabled: false,
};

const LOCAL_PREFS_KEY = "voton_local_prefs_v1";
const localPrefsListeners = new Set<() => void>();

function readLocalPrefs(): LocalPrefs {
  if (typeof window === "undefined") return DEFAULT_LOCAL_PREFS;
  try {
    const raw = window.localStorage.getItem(LOCAL_PREFS_KEY);
    if (!raw) return DEFAULT_LOCAL_PREFS;
    return { ...DEFAULT_LOCAL_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_LOCAL_PREFS;
  }
}

function applyLocalPrefsEffects(prefs: LocalPrefs) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("reduce-motion", prefs.reduce_motion);
  document.documentElement.classList.toggle("compact-mode", prefs.compact_mode);
  const el = document.documentElement;
  el.classList.toggle("a11y-readable-font", prefs.readable_font);
  el.classList.toggle("a11y-spacing", prefs.text_spacing);
  el.classList.toggle("a11y-underline-links", prefs.underline_links);
  el.classList.toggle("a11y-large-targets", prefs.large_targets);
  el.classList.toggle("a11y-focus-ring", prefs.focus_ring);
  el.classList.toggle("a11y-big-cursor", prefs.big_cursor);
  el.classList.toggle("a11y-hide-images", prefs.hide_images);
  for (const f of ["grayscale", "protanopia", "deuteranopia", "tritanopia"]) {
    el.classList.toggle(`a11y-filter-${f}`, prefs.color_filter === f);
  }
  el.style.setProperty("--a11y-line-height", String(prefs.line_height));
  el.style.setProperty("--a11y-letter-spacing", `${prefs.letter_spacing}em`);
  el.style.setProperty("--a11y-word-spacing", `${prefs.letter_spacing * 2}em`);
}

export function useLocalPrefs() {
  const [prefs, setPrefs] = useState<LocalPrefs>(() => readLocalPrefs());

  useEffect(() => {
    applyLocalPrefsEffects(prefs);
  }, [
    prefs.reduce_motion, prefs.compact_mode, prefs.readable_font, prefs.text_spacing,
    prefs.line_height, prefs.letter_spacing, prefs.underline_links, prefs.large_targets,
    prefs.focus_ring, prefs.big_cursor, prefs.color_filter, prefs.hide_images,
  ]);

  useEffect(() => {
    const listener = () => setPrefs(readLocalPrefs());
    localPrefsListeners.add(listener);
    return () => { localPrefsListeners.delete(listener); };
  }, []);

  const save = (patch: Partial<LocalPrefs>) => {
    const next = { ...readLocalPrefs(), ...patch };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(next));
    }
    setPrefs(next);
    localPrefsListeners.forEach((l) => l());
  };

  return { prefs, save };
}
