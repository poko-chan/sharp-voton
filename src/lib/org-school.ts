import { supabase } from "@/integrations/supabase/client";
import { loadOrgProfiles, nameOf } from "@/lib/org-apps";

export type Member = { user_id: string; role: string; name: string };

/** 組織のメンバーを表示名つきで取得する */
export async function loadMembers(orgId: string): Promise<Member[]> {
  const { data } = await (supabase as any)
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", orgId);
  const rows = data ?? [];
  const profiles = await loadOrgProfiles(
    orgId,
    rows.map((r: any) => r.user_id),
  );
  return rows
    .map((r: any) => ({ user_id: r.user_id, role: r.role, name: nameOf(profiles[r.user_id]) }))
    .sort((a: Member, b: Member) => a.name.localeCompare(b.name, "ja"));
}

export const ATTENDANCE_STATUS: { key: string; label: string; color: string }[] = [
  { key: "present", label: "出席", color: "#22c55e" },
  { key: "late", label: "遅刻", color: "#f59e0b" },
  { key: "early", label: "早退", color: "#38bdf8" },
  { key: "absent", label: "欠席", color: "#ef4444" },
  { key: "excused", label: "公欠", color: "#a78bfa" },
];

export const ATT_LABEL: Record<string, string> = Object.fromEntries(
  ATTENDANCE_STATUS.map((s) => [s.key, s.label]),
);
export const ATT_COLOR: Record<string, string> = Object.fromEntries(
  ATTENDANCE_STATUS.map((s) => [s.key, s.color]),
);

export const ABSENCE_KINDS: { key: string; label: string }[] = [
  { key: "absent", label: "欠席" },
  { key: "late", label: "遅刻" },
  { key: "early", label: "早退" },
];

export const INCIDENT_CATEGORIES: { key: string; label: string }[] = [
  { key: "bullying", label: "いじめ・人間関係" },
  { key: "harassment", label: "ハラスメント" },
  { key: "safety", label: "安全・設備" },
  { key: "study", label: "学習の悩み" },
  { key: "health", label: "こころ・からだ" },
  { key: "other", label: "その他" },
];

export const GUIDANCE_CATEGORIES: { key: string; label: string }[] = [
  { key: "general", label: "所見" },
  { key: "study", label: "学習指導" },
  { key: "life", label: "生活指導" },
  { key: "career", label: "進路" },
  { key: "family", label: "家庭連絡" },
];

export const WATCH_KINDS: { key: string; label: string }[] = [
  { key: "absence", label: "欠席が続いている" },
  { key: "study", label: "学習量の低下" },
  { key: "submission", label: "課題の未提出" },
  { key: "health", label: "体調・保健" },
  { key: "relation", label: "人間関係" },
  { key: "other", label: "その他" },
];

export const DAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 表形式のデータをCSVにして端末にダウンロードする */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
