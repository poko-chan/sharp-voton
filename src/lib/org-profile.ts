import { supabase } from "@/integrations/supabase/client";

export type OrgFieldType = "text" | "select" | "number";

export type OrgField = {
  id: string;
  organization_id: string;
  key: string;
  label: string;
  type: OrgFieldType;
  options: string[];
  required: boolean;
  staff_only: boolean;
  yearly: boolean;
  sort_order: number;
};

/** 年度（4月始まり）。1〜3月は前年の年度として扱う。 */
export function academicYear(d = new Date()): string {
  const jst = new Date(d.getTime() + (9 * 60 + d.getTimezoneOffset()) * 60000);
  const y = jst.getFullYear();
  return String(jst.getMonth() + 1 < 4 ? y - 1 : y);
}

export function yearOptions(center = Number(academicYear())): string[] {
  return [center + 1, center, center - 1, center - 2, center - 3].map(String);
}

export async function loadOrgFields(orgId: string): Promise<OrgField[]> {
  const { data } = await (supabase as any).from("org_profile_fields")
    .select("*").eq("organization_id", orgId).order("sort_order").order("created_at");
  return (data ?? []).map((f: any) => ({ ...f, options: Array.isArray(f.options) ? f.options : [] }));
}

/** ユーザーID -> 年度プロフィール値 */
export async function loadOrgYearValues(orgId: string, year: string, userIds?: string[]) {
  let q = (supabase as any).from("org_profile_years").select("user_id, values")
    .eq("organization_id", orgId).eq("year", year);
  if (userIds?.length) q = q.in("user_id", Array.from(new Set(userIds)));
  const { data } = await q;
  const map: Record<string, Record<string, string>> = {};
  for (const r of data ?? []) map[r.user_id] = (r.values ?? {}) as Record<string, string>;
  return map;
}

export async function saveOrgYearValues(orgId: string, userId: string, year: string, values: Record<string, string>) {
  return (supabase as any).from("org_profile_years").upsert(
    { organization_id: orgId, user_id: userId, year, values },
    { onConflict: "organization_id,user_id,year" },
  );
}

/**
 * 出題条件の判定。audience は { fieldKey: ["中学1年", ...] } 形式。
 * 空 / 未設定のキーは「全員対象」とみなす。
 */
export function matchAudience(audience: any, values: Record<string, string> | undefined): boolean {
  if (!audience || typeof audience !== "object") return true;
  for (const [key, allowed] of Object.entries(audience)) {
    const list = (Array.isArray(allowed) ? allowed : []).filter(Boolean) as string[];
    if (!list.length) continue;
    const v = values?.[key];
    if (!v || !list.includes(v)) return false;
  }
  return true;
}

export const audienceLabel = (audience: any, fields: OrgField[]) => {
  const parts: string[] = [];
  for (const [key, allowed] of Object.entries(audience ?? {})) {
    const list = (Array.isArray(allowed) ? allowed : []) as string[];
    if (!list.length) continue;
    const f = fields.find((x) => x.key === key);
    parts.push(`${f?.label ?? key}: ${list.join("・")}`);
  }
  return parts.length ? parts.join(" / ") : "全員";
};
