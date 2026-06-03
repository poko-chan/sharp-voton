import { supabase } from "@/integrations/supabase/client";

export type ThemeName = "default" | "pastel" | "contrast" | "ocean" | "sunset";

export const THEMES: { key: ThemeName; label: string; swatch: string }[] = [
  { key: "default", label: "デフォルト（緑）", swatch: "#10b981" },
  { key: "pastel", label: "パステル", swatch: "#fbcfe8" },
  { key: "contrast", label: "ハイコントラスト", swatch: "#000000" },
  { key: "ocean", label: "オーシャン", swatch: "#0ea5e9" },
  { key: "sunset", label: "サンセット", swatch: "#f97316" },
];

const STORAGE_KEY = "studyplus.theme";

export function applyTheme(theme: ThemeName) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function getStoredTheme(): ThemeName {
  if (typeof window === "undefined") return "default";
  try {
    const v = localStorage.getItem(STORAGE_KEY) as ThemeName | null;
    if (v) return v;
  } catch {
    /* ignore */
  }
  return "default";
}

export async function loadAndApplyUserTheme(userId: string | undefined) {
  applyTheme(getStoredTheme());
  if (!userId) return;
  const { data } = await supabase
    .from("profiles")
    .select("theme")
    .eq("id", userId)
    .maybeSingle();
  const t = ((data as { theme?: string } | null)?.theme as ThemeName) ?? "default";
  applyTheme(t);
}

export async function saveUserTheme(userId: string, theme: ThemeName) {
  applyTheme(theme);
  await supabase.from("profiles").update({ theme } as never).eq("id", userId);
}
