import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * SECURITY: ユーザー名からメールアドレス（一部でも）を返すと第三者に情報が漏れるため、
 * 常に同じ案内だけを返す。メールの確認はパスワード再設定メールで行う。
 */
export const getMaskedEmailByUsername = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ username: z.string().min(1).max(64) }).parse(i))
  .handler(async () => {
    return {
      masked: "プライバシー保護のため表示できません。「パスワード再設定」から登録メール宛に案内を送れます。",
      found: false as const,
    };
  });
