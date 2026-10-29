/** 保護者が制限できる機能の一覧（お子様側の判定でも使う） */
export type FeatureCategory = "study" | "social";

export const LOCKABLE_FEATURES: { key: string; label: string; category: FeatureCategory }[] = [
  { key: "makron", label: "Makron（問題演習）", category: "study" },
  { key: "notebooks", label: "Cnote（ノート）", category: "study" },
  { key: "study", label: "勉強きろく", category: "study" },
  { key: "timer", label: "タイマー", category: "study" },
  { key: "flashcards", label: "単語帳", category: "study" },
  { key: "materials", label: "教材", category: "study" },
  { key: "goals", label: "目標", category: "study" },
  { key: "xlang", label: "Xlang（語学）", category: "study" },
  { key: "chat", label: "チャット", category: "social" },
  { key: "feed", label: "みんなの投稿", category: "social" },
  { key: "friends", label: "フレンド", category: "social" },
  { key: "together", label: "みんなで勉強", category: "social" },
  { key: "leaderboard", label: "ランキング", category: "social" },
  { key: "ai-chat", label: "AIチャット", category: "social" },
];

export type FeatureMode = "always" | "normal" | "limited" | "blocked";

export type Preset = {
  key: string;
  label: string;
  description: string;
  daily: number | null;
  from: string;
  to: string;
  study: FeatureMode;
  social: FeatureMode;
  socialMinutes?: number;
};

export const PRESETS: Preset[] = [
  {
    key: "elementary",
    label: "小学生向け",
    description: "1日1時間30分・7:00〜20:30・交流は30分",
    daily: 90,
    from: "07:00",
    to: "20:30",
    study: "always",
    social: "limited",
    socialMinutes: 30,
  },
  {
    key: "teen",
    label: "中高生向け",
    description: "1日3時間・6:00〜22:30・交流は60分",
    daily: 180,
    from: "06:00",
    to: "22:30",
    study: "always",
    social: "limited",
    socialMinutes: 60,
  },
  {
    key: "exam",
    label: "テスト前",
    description: "1日1時間・交流はブロック・勉強は自由",
    daily: 60,
    from: "06:00",
    to: "22:00",
    study: "always",
    social: "blocked",
  },
  {
    key: "free",
    label: "見守りのみ",
    description: "制限なし・利用時間だけ確認",
    daily: null,
    from: "",
    to: "",
    study: "normal",
    social: "normal",
  },
];
