import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useServiceStatus, SERVICES } from "@/lib/restriction-context";
import { RestrictionScreen } from "@/components/RestrictionScreen";

export function ServiceGate({ serviceKey, children }: { serviceKey: string; children: ReactNode }) {
  const { role } = useAuth();
  const status = useServiceStatus(serviceKey);
  const isAdmin = role === "admin";
  const label = SERVICES.find((s) => s.key === serviceKey)?.label ?? serviceKey;
  if (!isAdmin && status.blocked) {
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