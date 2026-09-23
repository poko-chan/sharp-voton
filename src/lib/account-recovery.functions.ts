import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  // 先頭1文字とドメイン先頭1文字だけを残す（本人が思い出せる最小限）
  const head = local.slice(0, 1);
  const [d1, ...rest] = domain.split(".");
  return `${head}***@${d1.slice(0, 1)}***.${rest.join(".") || "com"}`;
}

export const getMaskedEmailByUsername = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ username: z.string().min(1).max(64) }).parse(i))
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .ilike("username", data.username)
      .maybeSingle();
    // ユーザー名の存在有無が分からないよう、見つからない場合も同じ形式で返す
    if (!row?.email) return { masked: "*@*.***", found: false as const };
    return { masked: maskEmail(row.email as string), found: true as const };
  });
