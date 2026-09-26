import type { OrgAppKey, OrgRolePerms } from "@/lib/org-apps";

/** 組織の業態プリセット。選ぶと使うアプリと役職の初期セットが決まる。 */
export type OrgPresetKey = "school_k12" | "high_school" | "cram" | "club" | "custom";

export type RolePreset = {
  name: string;
  color: string;
  base_role: "member" | "teacher" | "admin";
  permissions: OrgRolePerms;
};

export type OrgPreset = {
  key: OrgPresetKey;
  label: string;
  hint: string;
  emoji: string;
  apps: OrgAppKey[];
  roles: RolePreset[];
};

const ALL_MANAGE = [
  "members",
  "requests",
  "invite",
  "stats",
  "assignments",
  "content",
  "profile-fields",
  "roster",
  "restrictions",
  "apps",
  "settings",
  "roles",
];

const teacherRole = (name: string, color: string, manage: string[]): RolePreset => ({
  name,
  color,
  base_role: "teacher",
  permissions: { manage, edu_author: true, apps: {} },
});

export const ORG_PRESETS: OrgPreset[] = [
  {
    key: "school_k12",
    label: "小学校・中学校",
    hint: "出欠・時間割・保健室まで学校運営をまるごと",
    emoji: "🏫",
    apps: [
      "notifications",
      "posts",
      "surveys",
      "calendar",
      "chat",
      "edu",
      "attendance",
      "timetable",
      "grades",
      "meetings",
      "health",
      "consult",
      "monitor",
    ],
    roles: [
      teacherRole("学級担任", "#6366f1", ["members", "stats", "assignments", "roster", "content"]),
      teacherRole("学年主任", "#0ea5e9", ALL_MANAGE),
      {
        name: "保護者",
        color: "#f59e0b",
        base_role: "member",
        permissions: { manage: [], apps: { edu: "none", monitor: "none", chat: "view" } },
      },
    ],
  },
  {
    key: "high_school",
    label: "高校・高専",
    hint: "進路・成績・面談を重視した構成",
    emoji: "🎓",
    apps: [
      "notifications",
      "posts",
      "surveys",
      "calendar",
      "digitalid",
      "chat",
      "edu",
      "attendance",
      "timetable",
      "grades",
      "meetings",
      "consult",
      "monitor",
    ],
    roles: [
      teacherRole("担任", "#6366f1", ["members", "stats", "assignments", "roster"]),
      teacherRole("進路指導", "#22c55e", ["members", "stats", "content"]),
    ],
  },
  {
    key: "cram",
    label: "学習塾・予備校",
    hint: "演習・成績・面談だけの軽量構成",
    emoji: "📚",
    apps: [
      "notifications",
      "posts",
      "calendar",
      "chat",
      "makron",
      "edu",
      "attendance",
      "grades",
      "meetings",
      "monitor",
    ],
    roles: [
      teacherRole("講師", "#6366f1", ["stats", "assignments", "content"]),
      teacherRole("教室長", "#ef4444", ALL_MANAGE),
    ],
  },
  {
    key: "club",
    label: "部活動・サークル",
    hint: "連絡・予定・出欠のみのシンプル運用",
    emoji: "⚽",
    apps: ["notifications", "posts", "calendar", "chat", "attendance", "surveys"],
    roles: [
      teacherRole("顧問", "#6366f1", ["members", "requests", "roster"]),
      {
        name: "キャプテン",
        color: "#22c55e",
        base_role: "member",
        permissions: { manage: [], apps: {} },
      },
    ],
  },
  {
    key: "custom",
    label: "カスタム",
    hint: "自分でアプリと役職を選ぶ",
    emoji: "⚙️",
    apps: ["notifications", "posts", "calendar", "chat"],
    roles: [],
  },
];

export const MANAGE_SECTIONS: { key: string; label: string; desc: string }[] = [
  { key: "members", label: "メンバー管理", desc: "参加者の一覧・停止" },
  { key: "requests", label: "参加申請", desc: "参加の承認・却下" },
  { key: "invite", label: "招待", desc: "参加コード・招待リンク" },
  { key: "stats", label: "学習統計", desc: "学習量の集計を見る" },
  { key: "assignments", label: "課題", desc: "課題の配信・確認" },
  { key: "content", label: "問題集・クラス", desc: "教材とクラスの編集" },
  { key: "profile-fields", label: "プロフィール項目", desc: "名簿の入力項目" },
  { key: "roster", label: "名簿", desc: "学年・クラス編成" },
  { key: "restrictions", label: "アプリ制限", desc: "利用時間などの制限" },
  { key: "apps", label: "アプリ管理", desc: "使うアプリの切替" },
  { key: "settings", label: "組織設定", desc: "組織名・基本設定" },
  { key: "roles", label: "役職・権限", desc: "役職の作成と割り当て" },
];
