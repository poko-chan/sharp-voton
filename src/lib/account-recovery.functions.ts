import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const head = local.slice(0, Math.min(2, local.length));
  const tail = local.length > 3 ? local.slice(-1) : "";
  const [d1, ...rest] = domain.split(".");
  const dHead = d1.slice(0, 1);
  return `${head}***${tail}@${dHead}***.${rest.join(".") || "com"}`;
}

export const getMaskedEmailByUsername = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ username: z.string().min(1).max(64) }).parse(i))
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .ilike("username", data.username)
      .maybeSingle();
    if (!row?.email) throw new Error("ユーザー名が見つかりません");
    return { masked: maskEmail(row.email as string) };
  });