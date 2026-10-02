import { useEffect } from "react";
import { unreadCount } from "@/lib/notifications.functions";

export function AppBadgeSync() {
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge) return;
    const tick = () =>
      unreadCount()
        .then((r: unknown) => {
          const n = typeof r === "number" ? r : Number((r as { count?: number })?.count ?? 0);
          return n > 0 ? nav.setAppBadge!(n) : nav.clearAppBadge?.();
        })
        .catch(() => {});
    void tick();
    const id = setInterval(tick, 120_000);
    return () => clearInterval(id);
  }, []);
  return null;
}
