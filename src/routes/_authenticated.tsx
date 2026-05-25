import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { TimerProvider } from "@/lib/timer-context";
import { I18nProvider } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">読み込み中...</div>;
  }
  if (!user) return null;
  return (
    <I18nProvider>
      <TimerProvider>
        <AppShell><Outlet /></AppShell>
      </TimerProvider>
    </I18nProvider>
  );
}
