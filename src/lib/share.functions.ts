import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ShareSummaryRow = {
  date: string;
  minutes: number;
  subject_name: string | null;
  color: string | null;
};

/**
 * Public share-link viewer. The share token is validated server-side; the
 * underlying database function is no longer callable by anonymous clients.
 */
export const getSharedStudySummary = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().min(8).max(200) }).parse(data),
  )
  .handler(async ({ data }): Promise<ShareSummaryRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any).rpc("share_study_summary", {
      _token: data.token,
    });
    if (error) throw new Error("invalid_share_token");
    return (rows ?? []) as ShareSummaryRow[];
  });
