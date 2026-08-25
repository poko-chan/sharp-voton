import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { TimerProvider } from "@/lib/timer-context";
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
  ["/practice", "practice"],
  ["/questions", "questions"],
];

export const Route = createFileRoute("/_authenticated")({
  head: () => ({
    meta: [
      { title: "マイページ｜Study#" },
      { name: "description", content: "Study#のアプリ画面。勉強記録・タイマー・演習・組織管理をここから利用します。" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
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
  // 組織アカウントは組織管理まわりのみ。学習機能は使えない。
  useEffect(() => {
    if (loading || !user || accountKind !== "org") return;
    const allowed = ["/organizations", "/settings", "/notifications", "/help", "/announcements", "/updates"];
    const ok = allowed.some((p) => path === p || path.startsWith(p + "/"));
    if (!ok) navigate({ to: "/organizations" });
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
        <TimerProvider>
          {content}
          <LoginWelcomeOverlay />
        </TimerProvider>
    );
  }
  return (
      <TimerProvider>
        <AppShell>{content}</AppShell>
        <LoginWelcomeOverlay />
      </TimerProvider>
  );
}
