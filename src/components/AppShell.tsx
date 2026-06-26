import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Timer, CalendarDays, BookOpen, Brain,
  MessagesSquare, LogOut, Shield, Sparkles, Target, Settings, Trophy,
  Megaphone, GraduationCap, Zap, Headphones, Menu, X, MoreHorizontal,
  StickyNote, Users, Ban, HelpCircle,
  CalendarClock, Stamp, Activity, Share2, ScanLine, Flame,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/logo.png";
import { levelFromMinutes } from "@/lib/level";
import { onProfileChange } from "@/lib/profile-events";
import { localDateStr } from "@/lib/date";
import { useTimer } from "@/lib/timer-context";
import { useI18n } from "@/lib/i18n";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { SearchBar } from "@/components/SearchBar";
import { useUserPrefs } from "@/lib/user-prefs";
import { useRestriction } from "@/lib/restriction-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAdminNavConfig } from "@/lib/admin-nav";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { MikuCompanion } from "@/components/MikuCompanion";

const NAV = [
  { to: "/dashboard", labelKey: "nav.dashboard" as const, icon: LayoutDashboard },
  { to: "/today", labelKey: "nav.today" as const, icon: CalendarClock },
  { to: "/study", labelKey: "nav.study" as const, icon: BookOpen },
  { to: "/materials", labelKey: "nav.dashboard" as const, icon: BookOpen, override: "教材データベース" },
  { to: "/timer", labelKey: "nav.timer" as const, icon: Timer },
  { to: "/calendar", labelKey: "nav.calendar" as const, icon: CalendarDays },
  { to: "/goals", labelKey: "nav.goals" as const, icon: Trophy },
  { to: "/habits", labelKey: "nav.habits" as const, icon: Stamp },
  { to: "/streak", labelKey: "nav.streak" as const, icon: Flame },
  { to: "/flashcards", labelKey: "nav.flashcards" as const, icon: Brain },
  { to: "/ocr", labelKey: "nav.ocr" as const, icon: ScanLine },
  { to: "/friends", labelKey: "nav.friends" as const, icon: Users },
  { to: "/rooms", labelKey: "nav.rooms" as const, icon: Users },
  { to: "/questions", labelKey: "nav.questions" as const, icon: Brain },
  { to: "/practice", labelKey: "nav.practice" as const, icon: Target },
  { to: "/tutor", labelKey: "nav.tutor" as const, icon: Sparkles },
  { to: "/coach", labelKey: "nav.coach" as const, icon: Sparkles },
  { to: "/micro", labelKey: "nav.micro" as const, icon: Zap },
  { to: "/listen", labelKey: "nav.listen" as const, icon: Headphones },
  { to: "/classroom", labelKey: "nav.classroom" as const, icon: GraduationCap },
  { to: "/chat", labelKey: "nav.chat" as const, icon: MessagesSquare },
  { to: "/notes", labelKey: "nav.notes" as const, icon: StickyNote },
  { to: "/announcements", labelKey: "nav.announcements" as const, icon: Megaphone },
  { to: "/requests", labelKey: "nav.dashboard" as const, icon: MessagesSquare, override: "管理者への要望" },
  { to: "/missions", labelKey: "nav.dashboard" as const, icon: Target, override: "ミッション" },
  { to: "/makron", labelKey: "nav.dashboard" as const, icon: Target, override: "Makron" },
  { to: "/organizations", labelKey: "nav.dashboard" as const, icon: Users, override: "組織" },
  { to: "/shop", labelKey: "nav.dashboard" as const, icon: ShoppingBag, override: "コインショップ" },
  { to: "/settings", labelKey: "nav.settings" as const, icon: Settings, override: "設定" },
  { to: "/help", labelKey: "nav.dashboard" as const, icon: HelpCircle, override: "ヘルプ" },
] as const;

// Map prefix -> service key (for filtering hidden services)
const ROUTE_SERVICE: Record<string, string> = {
  "/timer": "timer", "/tutor": "tutor", "/classroom": "classroom",
  "/classchat": "classchat", "/chat": "chat", "/notes": "notes",
  "/today": "today", "/practice": "practice", "/questions": "questions",
  "/coach": "coach", "/micro": "micro", "/listen": "listen",
};

// Bottom-bar mobile shortcuts (5 primary, last is "more")
const BOTTOM_NAV = [
  { to: "/dashboard", labelKey: "nav.dashboard" as const, icon: LayoutDashboard },
  { to: "/timer", labelKey: "nav.timer" as const, icon: Timer },
  { to: "/study", labelKey: "nav.study" as const, icon: BookOpen },
  { to: "/classroom", labelKey: "nav.classroom" as const, icon: GraduationCap },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin, signOut, accountKind } = useAuth();
  const { t } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isMobile = useIsMobile();
  const { prefs } = useUserPrefs(); // apply font scale / contrast on mount
  const restriction = useRestriction();
  const { map: navCfg } = useAdminNavConfig();
  const [version, setVersion] = useState<string>("");
  const [profile, setProfile] = useState<{ display_name: string | null; username: string | null; avatar_url: string | null } | null>(null);
  const [level, setLevel] = useState<number>(1);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("app_version").eq("id", 1).maybeSingle()
      .then(({ data }) => setVersion(data?.app_version ?? ""));
  }, []);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, username, avatar_url")
      .eq("id", user.id).maybeSingle();
    setProfile(data ?? null);
  }, [user]);

  const loadLevel = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("study_logs")
      .select("duration_minutes, date")
      .eq("user_id", user.id);
    const rows = data ?? [];
    const total = rows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
    const { data: subs } = await supabase.from("submissions").select("xp_awarded").eq("user_id", user.id);
    const xp = (subs ?? []).reduce((s, r) => s + (r.xp_awarded ?? 0), 0);
    const last = rows.reduce<string | null>((m, r) => (m && m > r.date ? m : r.date), null);
    const days = last
      ? Math.floor((new Date(localDateStr() + "T00:00:00").getTime() - new Date(last + "T00:00:00").getTime()) / 86400000)
      : 999;
    setLevel(levelFromMinutes(total + xp, days));
  }, [user]);

  useEffect(() => { loadProfile(); loadLevel(); }, [loadProfile, loadLevel]);
  useEffect(() => onProfileChange(() => { loadProfile(); loadLevel(); }), [loadProfile, loadLevel]);

  // Pending referral code claim (set on /r/$code when user wasn't signed in)
  useEffect(() => {
    if (!user) return;
    let code: string | null = null;
    try { code = localStorage.getItem("pending_referral_code"); } catch { /* noop */ }
    if (!code) return;
    (supabase as any).rpc("claim_referral", { _code: code }).then(({ error }: any) => {
      try { localStorage.removeItem("pending_referral_code"); } catch { /* noop */ }
      if (!error) {
        // best-effort UX feedback
        try { (window as any).__lovableToast?.("招待ボーナス +10コイン"); } catch { /* noop */ }
      }
    });
  }, [user]);

  // Realtime notifications -> Desktop notifications + sound
  useEffect(() => {
    if (!user) return;
    // Ask permission once
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try { Notification.requestPermission().catch(() => {}); } catch { /* noop */ }
    }
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const n = payload.new;
          try {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification(n.title || "通知", { body: n.body || "", icon: "/favicon.ico", tag: n.id });
            }
          } catch { /* noop */ }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [path]);

  const displayName = profile?.display_name || profile?.username || user?.email || "";
  const initial = (displayName || "U").slice(0, 1).toUpperCase();
  const shortId = user?.id ? `ID: ${user.id.slice(0, 8)}` : "";

  // Compute hidden/restricted nav items
  const hiddenByUser = new Set(prefs.sidebar_hidden ?? []);
  const bypass = isAdmin && prefs.act_as_admin;
  const isRestricted = (to: string) => {
    const svc = ROUTE_SERVICE[to];
    if (!svc) return false;
    if (bypass) return false;
    return !!restriction.global[svc] || !!restriction.forMe[svc];
  };
  // apply admin config: hidden by admin -> show only via "その他", rename / reorder
  const decorated = NAV.map((n) => {
    const cfg = navCfg[n.to];
    return {
      ...n,
      adminHidden: cfg ? !cfg.visible : false,
      adminLabel: cfg?.label || null,
      adminIconUrl: cfg?.icon_url || null,
      adminQuickbar: !!cfg?.in_quickbar,
      adminOrder: cfg?.order_idx ?? 100,
    };
  });
  decorated.sort((a, b) => a.adminOrder - b.adminOrder);
  const navVisible = decorated.filter((n) => !isRestricted(n.to) && !hiddenByUser.has(n.to) && !n.adminHidden);
  const navRestricted = decorated.filter((n) => isRestricted(n.to));
  const navHiddenByUser = decorated.filter((n) => !isRestricted(n.to) && (hiddenByUser.has(n.to) || n.adminHidden));
  const quickbarItems = decorated.filter((n) => n.adminQuickbar && !isRestricted(n.to) && !n.adminHidden);

  const renderLabel = (n: any) => n.adminLabel || n.override || t(n.labelKey);
  const renderIcon = (n: any, cls = "h-4 w-4") =>
    n.adminIconUrl
      ? <img src={n.adminIconUrl} alt="" className={cls + " object-contain"} />
      : <n.icon className={cls} />;

  const sidebarContent = (
    <>
      <div className="p-5 flex items-center gap-3">
        <img src={logoUrl} alt="Study+ ロゴ" className="h-12 w-12 rounded-2xl object-cover shadow-sm" />
        <div className="min-w-0">
          <ClockHeader version={version} />
        </div>
      </div>
      <div className="mx-5 border-t border-border/60" />
      <div className="px-5 py-4 flex items-center gap-3">
        <Avatar className="h-11 w-11">
          {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={displayName} /> : null}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="text-sm font-medium leading-tight truncate">{displayName}</div>
            <span
              title={`レベル ${level}`}
              className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary/15 text-primary border border-primary/30"
            >
              Lv{level}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground truncate">{shortId}</div>
          <div className="text-[10px] text-muted-foreground truncate">{user?.email ?? ""}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut} title="ログアウト" className="shrink-0">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
      {quickbarItems.length > 0 && (
        <div className="px-3 pb-2 flex items-center gap-1 flex-wrap">
          {quickbarItems.map((n) => {
            const active = path === n.to || path.startsWith(n.to + "/");
            return (
              <Link key={"q-" + n.to} to={n.to} title={renderLabel(n)}
                className={`h-8 w-8 inline-flex items-center justify-center rounded-md ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent/70 text-sidebar-foreground"}`}>
                {renderIcon(n, "h-4 w-4")}
              </Link>
            );
          })}
        </div>
      )}
      <nav className="flex-1 px-3 space-y-0.5 overflow-auto pb-4">
        {navVisible.map((n) => {
          const active = path === n.to || path.startsWith(n.to + "/");
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm"
                  : "hover:bg-sidebar-accent/70 text-sidebar-foreground"
              }`}
            >
              {renderIcon(n)}
              {renderLabel(n)}
            </Link>
          );
        })}

        {accountKind === "parent" && (
          <Link to={"/parent" as any} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition border border-blue-500/30 text-blue-600 hover:bg-blue-500/10 mt-2">
            <Users className="h-4 w-4" /> 保護者ダッシュボード
          </Link>
        )}

        {navHiddenByUser.length > 0 && (
          <Popover>
            <PopoverTrigger className="mt-2 w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm border border-border/60 hover:bg-accent">
              <MoreHorizontal className="h-4 w-4" /> その他 ({navHiddenByUser.length})
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-56 p-2">
              {navHiddenByUser.map((n) => (
                <Link key={n.to} to={n.to} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                  {renderIcon(n)} {renderLabel(n)}
                </Link>
              ))}
            </PopoverContent>
          </Popover>
        )}

        {navRestricted.length > 0 && (
          <Popover>
            <PopoverTrigger className="mt-2 w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm border border-red-500/30 text-red-600 hover:bg-red-500/10">
              <Ban className="h-4 w-4" /> 利用停止中 ({navRestricted.length})
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-56 p-2">
              {navRestricted.map((n) => (
                <Link key={n.to} to={n.to} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent text-red-600">
                  {renderIcon(n)} {renderLabel(n)}
                </Link>
              ))}
            </PopoverContent>
          </Popover>
        )}

        {isAdmin && (
          <Link
            to="/admin"
            className={`mt-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition border border-warning/40 ${
              path.startsWith("/admin")
                ? "bg-warning/20 text-foreground"
                : "hover:bg-warning/10 text-foreground"
            }`}
          >
            <Shield className="h-4 w-4" />
            {t("nav.admin")}
          </Link>
        )}
      </nav>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className="w-64 shrink-0 border-r border-border/60 bg-sidebar/70 backdrop-blur-xl text-sidebar-foreground flex flex-col sticky top-0 h-screen self-start">
          {sidebarContent}
        </aside>
      )}

      <main className="flex-1 overflow-auto min-w-0">
        <TimerIndicator />
        {/* Account switcher top bar */}
        <div className="flex justify-end items-center px-3 py-1 border-b border-border/40 bg-background/40">
          <AccountSwitcher />
        </div>

        {/* Mobile top bar (hamburger + clock) */}
        {isMobile && (
          <header className="sticky top-0 z-40 flex items-center gap-2 px-3 py-2 bg-background/70 backdrop-blur-xl border-b border-border/50">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button aria-label="メニュー" className="h-10 w-10 inline-flex items-center justify-center rounded-xl hover:bg-accent">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[88vw] max-w-sm p-0 flex flex-col bg-sidebar/95 backdrop-blur-xl">
                <div className="flex items-center justify-end p-2">
                  <button onClick={() => setMobileOpen(false)} className="h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-accent">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {sidebarContent}
              </SheetContent>
            </Sheet>
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg" />
            <ClockHeader version={version} compact />
            <div className="ml-2"><SearchBar /></div>
            <Avatar className="h-9 w-9 ml-auto">
              {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={displayName} /> : null}
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
          </header>
        )}

        <div className={isMobile ? "pb-20" : ""}>{children}</div>

        {/* Mobile bottom bar */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/80 backdrop-blur-xl">
            <div className="flex items-stretch justify-around px-1 py-1">
              {BOTTOM_NAV.map((n) => {
                const active = path === n.to || path.startsWith(n.to + "/");
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <n.icon className="h-5 w-5" />
                    <span className="truncate max-w-full px-1">{t(n.labelKey)}</span>
                  </Link>
                );
              })}
              <button
                onClick={() => setMobileOpen(true)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium text-muted-foreground"
              >
                <MoreHorizontal className="h-5 w-5" />
                <span>その他</span>
              </button>
            </div>
          </nav>
        )}
      </main>
      <MikuCompanion />
    </div>
  );
}

function ClockHeader({ version, compact }: { version: string; compact?: boolean }) {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
  const date = `${now.getMonth() + 1}/${now.getDate()}(${weekday})`;
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  if (compact) {
    return (
      <div className="flex flex-col leading-none">
        <span className="text-[9px] text-muted-foreground">{date}</span>
        <span className="text-sm font-bold tabular-nums">Study+ <span className="text-primary">{hh}:{mm}</span></span>
      </div>
    );
  }
  return (
    <>
      <div className="text-[10px] text-muted-foreground leading-tight">{date}</div>
      <div className="font-bold text-lg leading-tight flex items-baseline gap-2">
        <span>Study+</span>
        <span className="text-sm tabular-nums text-primary font-semibold">{hh}:{mm}</span>
      </div>
      <div className="text-[10px] text-muted-foreground truncate">{version || "v1.0.0"}</div>
    </>
  );
}

function TimerIndicator() {
  const { state, elapsedMs, remainingMs } = useTimer();
  if (!state) return null;
  const ms = state.kind === "stopwatch" ? elapsedMs : remainingMs;
  const label = state.kind === "pomodoro" ? (state.pomoMode === "focus" ? "🎯 集中" : "☕ 休憩") : state.kind === "countdown" ? "⏳ タイマー" : "⏱ 計測中";
  return (
    <Link to="/timer" className="sticky top-0 z-30 block bg-primary/90 backdrop-blur-md text-primary-foreground px-4 py-1.5 text-xs font-mono flex items-center justify-center gap-3 shadow hover:bg-primary border-b border-white/10">
      <span>{label}</span>
      <span className="font-bold tabular-nums">{fmtTime(ms)}</span>
      <span className="text-[10px] opacity-80 hidden sm:inline">タップでタイマー画面へ</span>
    </Link>
  );
}

function fmtTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
