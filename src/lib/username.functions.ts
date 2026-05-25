import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const resolveUsernameToEmail = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ username: z.string().min(1).max(64) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .ilike("username", data.username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.email) throw new Error("ユーザー名が見つかりません");
    return { email: row.email };
  });

export const checkUsernameAvailable = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ username: z.string().min(1).max(64) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", data.username)
      .maybeSingle();
    return { available: !row };
  });
