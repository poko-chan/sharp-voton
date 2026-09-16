import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MaintenanceState {
  loaded: boolean;
  enabled: boolean;
  message: string | null;
  until: string | null;
  lowDataMode: boolean;
}

const MaintenanceContext = createContext<MaintenanceState>({
  loaded: false,
  enabled: false,
  message: null,
  until: null,
  lowDataMode: false,
});

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<MaintenanceState>({
    loaded: false,
    enabled: false,
    message: null,
    until: null,
    lowDataMode: false,
  });

  const load = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("maintenance_mode, maintenance_message, maintenance_until, low_data_mode")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        setState({
          loaded: true,
          enabled: !!data.maintenance_mode,
          message: data.maintenance_message,
          until: data.maintenance_until,
          lowDataMode: !!data.low_data_mode,
        });
      }
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("app-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => load())
      .subscribe();
    const i = setInterval(load, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(i);
    };
  }, []);

  return (
    <MaintenanceContext.Provider value={{ ...state, loaded }}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export const useMaintenance = () => useContext(MaintenanceContext);
