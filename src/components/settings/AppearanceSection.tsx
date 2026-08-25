import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { THEMES, saveUserTheme, type ThemeName } from "@/lib/theme";
import { useUserPrefs, useLocalPrefs, FONT_OPTIONS, DASHBOARD_CARD_OPTIONS } from "@/lib/user-prefs";
import { useI18n } from "@/lib/i18n";
import { NAV } from "@/components/AppShell";
import { SectionHeading, SettingRow } from "./shared";

export function AppearanceSection() {
  return (
    <div className="space-y-6">
      <SectionHeading title="外観・テーマ" desc="配色・フォント・レイアウトの見た目をカスタマイズします" />
      <ThemeSettings />
      <CustomizationPanel />
      <DisplayDensityPanel />
    </div>
  );
}

function ThemeSettings() {
  const { user } = useAuth();
  const [theme, setTheme] = useState<ThemeName>("default");
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("theme").eq("id", user.id).maybeSingle()
      .then(({ data }) => setTheme(((data as { theme?: ThemeName } | null)?.theme ?? "default") as ThemeName));
  }, [user]);
  const onPick = async (t: ThemeName) => {
    setTheme(t);
    if (user) await saveUserTheme(user.id, t);
  };
  return (
    <Card className="p-6 space-y-3">
      <div className="font-semibold">テーマカラー</div>
      <p className="text-xs text-muted-foreground">アプリの配色をお好みに切り替えできます</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {THEMES.map((tm) => (
          <button
            key={tm.key}
            onClick={() => onPick(tm.key)}
            className={`p-3 rounded-lg border-2 text-xs flex flex-col items-center gap-2 transition ${
              theme === tm.key ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
            }`}
          >
            <span className="h-8 w-8 rounded-full border" style={{ background: tm.swatch }} />
            <span>{tm.label}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function CustomizationPanel() {
  const { prefs, save } = useUserPrefs();
  const { t } = useI18n();
  const NAV_ITEMS = useMemo(() => {
    const items = NAV.map((n) => ({
      to: n.to,
      label: n.to === "/settings" ? t("settings.profile") : ((n as any).override || t(n.labelKey)),
    }));
    items.sort((a, b) => (a.to === "/settings" ? -1 : b.to === "/settings" ? 1 : 0));
    return items;
  }, [t]);
  const hidden = new Set(prefs.sidebar_hidden ?? []);
  const toggleNav = (to: string) => {
    const next = new Set(hidden);
    if (next.has(to)) next.delete(to); else next.add(to);
    save({ sidebar_hidden: Array.from(next) });
  };
  const dock = new Set(prefs.right_dock ?? ["ambient", "feedback"]);
  const toggleDock = (k: string) => {
    const next = new Set(dock);
    if (next.has(k)) next.delete(k); else next.add(k);
    save({ right_dock: Array.from(next) });
  };
  return (
    <Card className="p-6 space-y-4">
      <div className="font-semibold">{t("settings.customization")}</div>
      <div className="space-y-2">
        <Label>{t("settings.font")}</Label>
        <Select value={prefs.font_family ?? "system"} onValueChange={(v) => save({ font_family: v })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                <span style={{ fontFamily: f.css }}>{f.label}（あア亜Aa）</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">{t("settings.fontDesc")}</p>
      </div>
      <div className="space-y-2">
        <Label>{t("settings.themeColor")}</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={(prefs as any).theme_color ?? "#3B82F6"}
            onChange={(e) => {
              const v = e.target.value;
              save({ ...(prefs as any), theme_color: v } as any);
              document.documentElement.style.setProperty("--primary", v);
            }}
            className="h-10 w-16 rounded border"
          />
          <span className="text-xs text-muted-foreground">{t("settings.themeColorDesc")}</span>
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("settings.rightDock")}</Label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center justify-between rounded border p-2 text-sm">
            <span>{t("settings.support")}</span>
            <Switch checked={dock.has("feedback")} onCheckedChange={() => toggleDock("feedback")} />
          </label>
          <label className="flex items-center justify-between rounded border p-2 text-sm">
            <span>{t("settings.ambient")}</span>
            <Switch checked={dock.has("ambient")} onCheckedChange={() => toggleDock("ambient")} />
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">{t("settings.ambientNote")}</p>
      </div>
      <div className="space-y-2">
        <Label>{t("settings.sidebarItems")}</Label>
        <p className="text-[11px] text-muted-foreground">{t("settings.sidebarItemsDesc")}</p>
        <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-auto rounded border p-2">
          {NAV_ITEMS.map((n) => (
            <label key={n.to} className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-accent">
              <span className="truncate">{n.label}</span>
              <Switch checked={!hidden.has(n.to)} onCheckedChange={() => toggleNav(n.to)} />
            </label>
          ))}
        </div>
      </div>
    </Card>
  );
}

function DisplayDensityPanel() {
  const { prefs, save } = useLocalPrefs();
  return (
    <Card className="p-6 space-y-4">
      <div className="font-semibold">レイアウト</div>
      <SettingRow
        label="コンパクト表示"
        desc="余白を減らして一度に表示できる情報量を増やします（この端末のみ）"
        checked={prefs.compact_mode}
        onChange={(v) => save({ compact_mode: v })}
      />
      <div className="space-y-1">
        <Label>ダッシュボードに表示するカード</Label>
        <p className="text-[11px] text-muted-foreground mb-1">ホーム画面に表示する項目を選びます（この端末のみ）</p>
        <div className="grid grid-cols-2 gap-1.5">
          {DASHBOARD_CARD_OPTIONS.map((c) => {
            const checked = prefs.dashboard_cards.includes(c.value);
            return (
              <label key={c.value} className="flex items-center justify-between text-xs px-2 py-1.5 rounded border hover:bg-accent">
                <span>{c.label}</span>
                <Switch
                  checked={checked}
                  onCheckedChange={(v) => {
                    const next = v
                      ? [...prefs.dashboard_cards, c.value]
                      : prefs.dashboard_cards.filter((x) => x !== c.value);
                    save({ dashboard_cards: next });
                  }}
                />
              </label>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
