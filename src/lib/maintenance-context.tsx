import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MaintenanceState {
  enabled: boolean;
  message: string | null;
  until: string | null;
}

const MaintenanceContext = createContext<MaintenanceState>({
  enabled: false,
  message: null,
  until: null,
});

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MaintenanceState>({
    enabled: false,
    message: null,
    until: null,
  });

  const load = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("maintenance_mode, maintenance_message, maintenance_until")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      setState({
        enabled: !!data.maintenance_mode,
        message: data.maintenance_message,
        until: data.maintenance_until,
      });
    }
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("app-settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        () => load(),
      )
      .subscribe();
    const i = setInterval(load, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(i);
    };
  }, []);

  return <MaintenanceContext.Provider value={state}>{children}</MaintenanceContext.Provider>;
}

export const useMaintenance = () => useContext(MaintenanceContext);
