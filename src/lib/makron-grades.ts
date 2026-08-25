export const GRADES = [
  "小1", "小2", "小3", "小4", "小5", "小6",
  "中1", "中2", "中3",
  "高1", "高2", "高3",
  "その他",
] as const;

export type Grade = (typeof GRADES)[number];
