import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useServiceStatus, SERVICES } from "@/lib/restriction-context";
import { RestrictionScreen } from "@/components/RestrictionScreen";
import { useUserPrefs } from "@/lib/user-prefs";

export function ServiceGate({ serviceKey, children }: { serviceKey: string; children: ReactNode }) {
  const { role } = useAuth();
  const status = useServiceStatus(serviceKey);
  const { prefs } = useUserPrefs();
  const bypass = role === "admin" && prefs.act_as_admin;
  const label = SERVICES.find((s) => s.key === serviceKey)?.label ?? serviceKey;
  if (!bypass && status.blocked) {
    return (
      <RestrictionScreen
        variant={status.variant!}
        message={status.message}
        until={status.until}
        title={status.variant === "stop" ? `${label} は現在利用停止中です` : `${label} へのアクセスが制限されています`}
      />
    );
  }
  return <>{children}</>;
}