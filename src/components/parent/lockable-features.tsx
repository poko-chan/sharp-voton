/** 保護者が制限できる機能の一覧（お子様側の判定でも使う） */
export const LOCKABLE_FEATURES: { key: string; label: string }[] = [
  { key: "chat", label: "チャット" },
  { key: "feed", label: "みんなの投稿" },
  { key: "friends", label: "フレンド" },
  { key: "together", label: "みんなで勉強" },
  { key: "leaderboard", label: "ランキング" },
  { key: "makron", label: "Makron（問題演習）" },
  { key: "study", label: "勉強きろく" },
  { key: "timer", label: "タイマー" },
  { key: "ai-chat", label: "AIチャット" },
  { key: "xlang", label: "Xlang（語学）" },
];
