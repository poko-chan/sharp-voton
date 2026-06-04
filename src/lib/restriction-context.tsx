import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface RestrictionState {
  serviceStopped: boolean;
  stopMessage: string | null;
  stopUntil: string | null;
  userRestricted: boolean;
  userRestrictMessage: string | null;
  userRestrictUntil: string | null;
}

const RestrictionContext = createContext<RestrictionState>({
  serviceStopped: false,
  stopMessage: null,
  stopUntil: null,
  userRestricted: false,
  userRestrictMessage: null,
  userRestrictUntil: null,
});

// app_settings stores service-stop flags reusing maintenance-style columns.
// We use a JSON convention in maintenance_message? No — let's use dedicated columns later.
// For now: service_stopped is stored as app_settings.maintenance_mode === false but with
// app_settings.app_version starting with "STOP::" — keep it simple: read from separate columns
// we'll fall back to checking a row in app_settings with id=2.

export function RestrictionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<RestrictionState>({
    serviceStopped: false,
    stopMessage: null,
    stopUntil: null,
    userRestricted: false,
    userRestrictMessage: null,
    userRestrictUntil: null,
  });

  const load = async () => {
    const next: RestrictionState = {
      serviceStopped: false,
      stopMessage: null,
      stopUntil: null,
      userRestricted: false,
      userRestrictMessage: null,
      userRestrictUntil: null,
    };

    // Service-wide stop is stored in app_settings (id=2) reusing maintenance_* fields.
    const { data: s } = await supabase
      .from("app_settings")
      .select("maintenance_mode, maintenance_message, maintenance_until")
      .eq("id", 2)
      .maybeSingle();
    if (s) {
      next.serviceStopped = !!s.maintenance_mode;
      next.stopMessage = s.maintenance_message;
      next.stopUntil = s.maintenance_until;
      const now = Date.now();
      if (s.maintenance_until && new Date(s.maintenance_until).getTime() < now) {
        next.serviceStopped = false;
      }
    }

    if (user) {
      const { data: r } = await supabase
        .from("user_restrictions")
        .select("restricted, message, restricted_until")
        .eq("user_id", user.id)
        .maybeSingle();
      if (r && r.restricted) {
        next.userRestricted = true;
        next.userRestrictMessage = r.message;
        next.userRestrictUntil = r.restricted_until;
        if (r.restricted_until && new Date(r.restricted_until).getTime() < Date.now()) {
          next.userRestricted = false;
        }
      }
    }
    setState(next);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("restriction-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_restrictions" }, () => load())
      .subscribe();
    const i = setInterval(load, 60000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(i);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return <RestrictionContext.Provider value={state}>{children}</RestrictionContext.Provider>;
}

export const useRestriction = () => useContext(RestrictionContext);