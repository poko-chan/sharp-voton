import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { MaintenanceProvider, useMaintenance } from "@/lib/maintenance-context";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { RestrictionProvider } from "@/lib/restriction-context";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { RouteLoading } from "@/components/RouteLoading";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { AmbientSound } from "@/components/AmbientSound";
import { loadAndApplyUserTheme } from "@/lib/theme";
import { useRouterState as useRS } from "@tanstack/react-router";
import { useUserPrefs } from "@/lib/user-prefs";
import { VoiceMicButton } from "@/components/VoiceMicButton";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">ページが見つかりません</h2>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          ホームへ
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">問題が発生しました</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          再試行
        </button>
      </div>
    </div>
  );
}

const SITE_URL = "https://studyplus-voton.lovable.app";
const OG_IMAGE = "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fd850e55-f433-466a-ae78-8f2f88319d43/id-preview-8ca241ff--70a80aa5-02cd-459f-845f-d642eaffb4f2.lovable.app-1778835357697.png";
const DEFAULT_TITLE = "Study+ — 学習をもっと賢く、楽しく続けるためのオールインワン学習アプリ";
const DEFAULT_DESC = "Study+ は勉強記録・集中タイマー・カレンダー・AI問題生成・AI家庭教師・学習目標管理をひとつにまとめた、毎日の学習を続けやすくするオールインワン学習プラットフォームです。";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#10b981" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Study+" },
      { title: DEFAULT_TITLE },
      { name: "description", content: DEFAULT_DESC },
      { property: "og:site_name", content: "Study+" },
      { property: "og:title", content: DEFAULT_TITLE },
      { name: "twitter:title", content: DEFAULT_TITLE },
      { property: "og:description", content: DEFAULT_DESC },
      { name: "twitter:description", content: DEFAULT_DESC },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { title: "Voton Study+" },
      { property: "og:title", content: "Voton Study+" },
      { name: "twitter:title", content: "Voton Study+" },
      { name: "description", content: "Voton Study+　学習をもっと賢く、楽しく" },
      { property: "og:description", content: "Voton Study+　学習をもっと賢く、楽しく" },
      { name: "twitter:description", content: "Voton Study+　学習をもっと賢く、楽しく" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6db7414f-a4f6-4093-891e-536a5edde1ce/id-preview-fdd67394--70a80aa5-02cd-459f-845f-d642eaffb4f2.lovable.app-1778981165224.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6db7414f-a4f6-4093-891e-536a5edde1ce/id-preview-fdd67394--70a80aa5-02cd-459f-845f-d642eaffb4f2.lovable.app-1778981165224.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/icon-192.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Study+",
          url: SITE_URL,
          logo: `${SITE_URL}/icon-512.png`,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Study+",
          url: SITE_URL,
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const m = useMaintenance();
  const { user, role, signOut } = useAuth();
  const routerState = useRouterState();
  const path = routerState.location.pathname;

  // Auto-logout 一般ユーザー when maintenance enabled (on every route change/mount)
  useEffect(() => {
    if (m.enabled && user && role && role !== "admin") {
      signOut();
    }
  }, [m.enabled, user, role, path, signOut]);

  // Show full-screen maintenance for non-admin (or unauthenticated except admin login)
  const isAdminLoggedIn = role === "admin";
  if (m.enabled && !isAdminLoggedIn) {
    // allow /admin-login route to be accessible
    if (path !== "/admin-login") {
      return <MaintenanceScreen message={m.message} until={m.until} />;
    }
  }
  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    loadAndApplyUserTheme(undefined);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      router.invalidate();
      loadAndApplyUserTheme(session?.user?.id);
    });
    supabase.auth.getUser().then(({ data }) => loadAndApplyUserTheme(data.user?.id));
    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MaintenanceProvider>
          <RestrictionProvider>
            <MaintenanceGate>
              <main id="main">
                <Outlet />
              </main>
            </MaintenanceGate>
          </RestrictionProvider>
          <RouteLoading />
          <DockedWidgets />
          <PWAInstallPrompt />
          <AmbientSound />
          <Toaster richColors position="top-center" />
        </MaintenanceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function DockedWidgets() {
  const path = useRS({ select: (s) => s.location.pathname });
  const onAuthSurface = !["/login","/admin-login","/help","/terms","/privacy","/"].includes(path) && !path.startsWith("/share/");
  const { prefs } = useUserPrefs();
  if (!onAuthSurface) return null;
  const dock = prefs.right_dock ?? ["ambient","feedback","voice"];
  return (
    <>
      {dock.includes("feedback") && <FeedbackWidget />}
      {dock.includes("voice") && <VoiceMicButton />}
    </>
  );
}
