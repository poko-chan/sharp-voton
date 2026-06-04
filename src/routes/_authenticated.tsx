import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { TimerProvider } from "@/lib/timer-context";
import { I18nProvider } from "@/lib/i18n";
import { ServiceGate } from "@/components/ServiceGate";

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
  ["/coach", "coach"],
  ["/micro", "micro"],
  ["/listen", "listen"],
];

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">読み込み中...</div>;
  }
  if (!user) return null;
  const match = ROUTE_SERVICE.find(([prefix]) => path === prefix || path.startsWith(prefix + "/"));
  const content = match
    ? <ServiceGate serviceKey={match[1]}><Outlet /></ServiceGate>
    : <Outlet />;
  return (
    <I18nProvider>
      <TimerProvider>
        <AppShell>{content}</AppShell>
      </TimerProvider>
    </I18nProvider>
  );
}
