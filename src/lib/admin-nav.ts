import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type NavConfig = {
  key: string;
  label: string | null;
  icon_url: string | null;
  visible: boolean;
  in_quickbar: boolean;
  order_idx: number;
};

export function useAdminNavConfig() {
  const [map, setMap] = useState<Record<string, NavConfig>>({});
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from("admin_nav_config").select("*");
      if (cancelled) return;
      const m: Record<string, NavConfig> = {};
      for (const r of (data ?? []) as NavConfig[]) m[r.key] = r;
      setMap(m);
    };
    load();
    const ch = supabase
      .channel("admin-nav-config")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_nav_config" }, () => { setVersion((v) => v + 1); load(); })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);
  return { map, version };
}