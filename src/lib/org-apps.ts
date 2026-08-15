import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type OrgAppKey = "notifications" | "posts" | "surveys" | "calendar" | "digitalid" | "chat" | "makron";

export const ORG_APPS: { key: OrgAppKey; label: string; desc: string; icon: string; color: string }[] = [
  { key: "notifications", label: "通知", desc: "各アプリからのお知らせ", icon: "Bell", color: "#f59e0b" },
  { key: "posts", label: "投稿", desc: "お知らせ・連絡（画像5枚まで）", icon: "Megaphone", color: "#7B6CFF" },
  { key: "surveys", label: "アンケート", desc: "組織・グループへ配信", icon: "ClipboardList", color: "#34D7B5" },
  { key: "calendar", label: "カレンダー", desc: "組織・グループの予定", icon: "CalendarDays", color: "#38bdf8" },
  { key: "digitalid", label: "デジタル証", desc: "学生証・入退室バーコード", icon: "IdCard", color: "#f472b6" },
  { key: "chat", label: "チャット", desc: "承認制のDM・グループ会話", icon: "MessagesSquare", color: "#a78bfa" },
  { key: "makron", label: "Makron for school", desc: "組織専用の問題集・課題", icon: "BookOpen", color: "#fb923c" },
];

export const GROUP_PERMS: { key: string; label: string; app: string }[] = [
  { key: "post_create", label: "一般が投稿できる", app: "投稿" },
  { key: "post_like", label: "一般がいいねできる", app: "投稿" },
  { key: "post_comment", label: "一般がコメントできる", app: "投稿" },
  { key: "member_view", label: "一般がメンバーを見られる", app: "投稿" },
  { key: "survey_create", label: "一般がアンケートを作成できる", app: "アンケート" },
  { key: "calendar_add", label: "一般が共有予定を追加できる", app: "カレンダー" },
  { key: "dm_member", label: "一般同士でDMできる", app: "チャット" },
  { key: "dm_teacher", label: "教師と一般がメッセージできる", app: "チャット" },
  { key: "group_chat_create", label: "一般がグループチャットを作れる", app: "チャット" },
];

export const DEFAULT_PERMS: Record<string, boolean> = {
  post_create: false, post_like: true, post_comment: true, member_view: true,
  survey_create: false, calendar_add: false, dm_member: true, dm_teacher: true, group_chat_create: false,
};

export function useOrg(orgId: string) {
  const { user, isAdmin } = useAuth();
  const [org, setOrg] = useState<any>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [leadGroups, setLeadGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) return;
    const [{ data: o }, { data: me }, { data: a }, { data: g }] = await Promise.all([
      (supabase as any).from("organizations").select("*").eq("id", orgId).maybeSingle(),
      (supabase as any).from("organization_members").select("role, suspended").eq("organization_id", orgId).eq("user_id", user.id).maybeSingle(),
      (supabase as any).from("org_app_settings").select("*").eq("organization_id", orgId),
      (supabase as any).from("org_groups").select("*").eq("organization_id", orgId).order("created_at"),
    ]);
    setOrg(o);
    setMyRole(me?.role ?? null);
    setApps(a ?? []);
    setGroups(g ?? []);
    const role = me?.role ?? null;
    const staffAll = isAdmin || ["owner", "admin"].includes(role ?? "");
    setLeadGroups((g ?? []).filter((x: any) => staffAll || x.leader_id === user.id));
    setLoading(false);
  }, [orgId, user?.id, isAdmin]);

  useEffect(() => { reload(); }, [reload]);

  const canAdmin = isAdmin || ["owner", "admin"].includes(myRole ?? "");
  const isStaff = canAdmin || myRole === "teacher";
  const appEnabled = (key: string) => {
    const row = apps.find((x) => x.app_key === key);
    return row ? row.enabled : true;
  };
  const appLabel = (key: string) => apps.find((x) => x.app_key === key)?.label
    || ORG_APPS.find((a) => a.key === key)?.label || key;

  return { org, setOrg, myRole, canAdmin, isStaff, isOwner: isAdmin || myRole === "owner", apps, groups, leadGroups, loading, reload, appEnabled, appLabel };
}

export async function loadProfiles(ids: string[]) {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return {} as Record<string, any>;
  const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", uniq);
  const map: Record<string, any> = {};
  for (const p of data ?? []) map[p.id] = p;
  return map;
}

/** 組織内プロフィール（表示名など）を優先して解決する */
export async function loadOrgProfiles(orgId: string, ids: string[]) {
  const base = await loadProfiles(ids);
  const { data } = await (supabase as any).from("org_profiles")
    .select("user_id, display_name, avatar_url, grade, class_name, student_number")
    .eq("organization_id", orgId).in("user_id", Array.from(new Set(ids.filter(Boolean))));
  for (const p of data ?? []) {
    base[p.user_id] = {
      ...(base[p.user_id] ?? { id: p.user_id }),
      display_name: p.display_name ?? base[p.user_id]?.display_name,
      avatar_url: p.avatar_url ?? base[p.user_id]?.avatar_url,
      grade: p.grade, class_name: p.class_name, student_number: p.student_number,
    };
  }
  return base;
}

export const nameOf = (p: any, fallback = "メンバー") =>
  p?.display_name || p?.username || fallback;
