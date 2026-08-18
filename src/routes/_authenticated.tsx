import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { TimerProvider } from "@/lib/timer-context";
import { I18nProvider } from "@/lib/i18n";
import { ServiceGate } from "@/components/ServiceGate";
import { LoginWelcomeOverlay } from "@/components/LoginWelcomeOverlay";

// Map URL prefix -> service key (must match SERVICES in restriction-context).
const ROUTE_SERVICE: Array<[string, string]> = [
  ["/timer", "timer"],
  ["/tutor", "tutor"],
  ["/classroom", "classroom"],
  ["/classchat", "classchat"],
  ["/chat", "chat"],
  ["/notes", "notes"],
  ["/today", "today"],
  ["/practice", "practice"],
  ["/questions", "questions"],
];

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading, accountKind } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);
  // Parents can only access parent-related surfaces.
  useEffect(() => {
    if (loading || !user || accountKind !== "parent") return;
    const allowed = ["/parent", "/settings", "/notifications", "/help", "/announcements", "/updates"];
    const ok = allowed.some((p) => path === p || path.startsWith(p + "/"));
    if (!ok) navigate({ to: "/parent" });
  }, [accountKind, path, user, loading, navigate]);
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">読み込み中...</div>;
  }
  if (!user) return null;
  const match = ROUTE_SERVICE.find(([prefix]) => path === prefix || path.startsWith(prefix + "/"));
  const content = match
    ? <ServiceGate serviceKey={match[1]}><Outlet /></ServiceGate>
    : <Outlet />;
  // Makron uses its own full-screen shell, bypass AppShell.
  const isMakron = path === "/makron" || path.startsWith("/makron/");
  if (isMakron) {
    return (
      <I18nProvider>
        <TimerProvider>
          {content}
          <LoginWelcomeOverlay />
        </TimerProvider>
      </I18nProvider>
    );
  }
  return (
    <I18nProvider>
      <TimerProvider>
        <AppShell>{content}</AppShell>
        <LoginWelcomeOverlay />
      </TimerProvider>
    </I18nProvider>
  );
}
