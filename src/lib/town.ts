// 無限成長する町。stage は 0..∞ の整数。
// 名前は基本配列 → 越えたら "Lv N" サフィックスで拡張。

const STAGE_NAMES = [
  "廃墟", "荒地", "小集落", "村", "町", "都市", "大都市", "巨大都市", "連邦首都", "軌道都市", "銀河都市",
] as const;

export function stageName(stage: number): string {
  if (stage < 0) return STAGE_NAMES[0];
  if (stage < STAGE_NAMES.length) return STAGE_NAMES[stage];
  const tier = Math.floor((stage - STAGE_NAMES.length) / 5) + 1;
  return `銀河都市 Lv${tier + 1}`;
}

export function stageDescription(stage: number): string {
  const desc: Record<number, string> = {
    0: "勉強が止まり、町は崩壊した…",
    1: "草の生えた荒地。最初の住人が来た",
    2: "数軒の小屋が並ぶ",
    3: "井戸と畑、住人も増えてきた",
    4: "市場と学校が建ち、賑やかに",
    5: "高い建物と電車、たくさんの市民",
    6: "巨大ビル群と高速鉄道。眠らない街",
    7: "巨大ドームと空中庭園を持つ未来都市",
    8: "国の首都となり、世界中から人が集まる",
    9: "宇宙ステーションと連結された軌道都市",
  };
  if (desc[stage]) return desc[stage];
  return "想像を超える発展を遂げた、伝説の都市";
}

export function stageColor(stage: number): string {
  const palette = ["#6b5b4f", "#9c8b73", "#a8b572", "#7fb069", "#65a07a", "#4a90a4", "#3a5e8c", "#6a4a9a", "#a04a8c", "#3aa0d8", "#d8a04a"];
  return palette[Math.min(stage, palette.length - 1)];
}

// MAX_STAGE に達したら「新しい町を作れる」状態
export const MAX_STAGE = 10;
export function canCreateNewTown(maxStageReached: number) {
  return maxStageReached >= MAX_STAGE;
}
