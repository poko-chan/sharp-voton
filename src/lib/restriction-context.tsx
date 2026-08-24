import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/**
 * Per-service restrictions.
 * - service_restrictions (global, by service_key)
 * - user_service_restrictions (per user × service_key)
 */
export const SERVICES = [
  { key: "timer",     label: "タイマー" },
  { key: "tutor",     label: "AIチャット" },
  { key: "classroom", label: "Voton Classroom" },
  { key: "chat",      label: "メッセージ" },
  { key: "classchat", label: "クラスチャット" },
  { key: "notes",     label: "付箋" },
  { key: "practice",  label: "AI問題演習" },
  { key: "questions", label: "AI問題作成" },
] as const;

type ServiceRow = { service_key: string; restricted: boolean; message: string | null; restricted_until: string | null };

interface RestrictionState {
  global: Record<string, ServiceRow>;
  forMe: Record<string, ServiceRow>;
}

const RestrictionContext = createContext<RestrictionState>({ global: {}, forMe: {} });

export function RestrictionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<RestrictionState>({ global: {}, forMe: {} });

  const load = async () => {
    const [{ data: g }, { data: u }] = await Promise.all([
      supabase.from("service_restrictions").select("service_key, restricted, message, restricted_until"),
      user
        ? supabase.from("user_service_restrictions").select("service_key, restricted, message, restricted_until").eq("user_id", user.id)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const expired = (r: any) => r.restricted_until && new Date(r.restricted_until).getTime() < Date.now();
    const toMap = (rows: any[]) => {
      const m: Record<string, ServiceRow> = {};
      for (const r of rows ?? []) {
        if (r.restricted && !expired(r)) m[r.service_key] = r;
      }
      return m;
    };
    setState({ global: toMap(g ?? []), forMe: toMap((u as any[]) ?? []) });
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("restriction-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_restrictions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_service_restrictions" }, () => load())
      .subscribe();
    const i = setInterval(load, 60000);
    return () => { supabase.removeChannel(ch); clearInterval(i); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return <RestrictionContext.Provider value={state}>{children}</RestrictionContext.Provider>;
}

export const useRestriction = () => useContext(RestrictionContext);

export function useServiceStatus(serviceKey: string) {
  const { global, forMe } = useRestriction();
  const g = global[serviceKey];
  const u = forMe[serviceKey];
  if (g) return { blocked: true as const, variant: "stop" as const, message: g.message, until: g.restricted_until };
  if (u) return { blocked: true as const, variant: "restrict" as const, message: u.message, until: u.restricted_until };
  return { blocked: false as const, variant: null, message: null, until: null };
}