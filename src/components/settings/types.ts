import type { ComponentType, SVGProps } from "react";

export type SettingsCategoryId =
  | "account"
  | "appearance"
  | "notifications"
  | "study"
  | "privacy"
  | "ai"
  | "language"
  | "accessibility"
  | "data"
  | "danger";

export type SettingsCategory = {
  id: SettingsCategoryId;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  keywords: string[];
  danger?: boolean;
};

export function matchesKeyword(term: string, ...values: string[]) {
  if (!term) return true;
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return values.some((v) => v && v.toLowerCase().includes(t));
}
