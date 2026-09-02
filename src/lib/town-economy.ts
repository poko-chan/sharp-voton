// 街の経済シミュレーション。指標(人口・GDP・CO2)はすべて「勉強の内容」から決まり、
// 建設した建物と有効化した経済政策が補正としてかかる。

export type BuildKind =
  | "house" | "apartment" | "office" | "tower" | "factory"
  | "school" | "hospital" | "park" | "solar" | "wind"
  | "road" | "station";

export type BuildDef = {
  kind: BuildKind;
  label: string;
  emoji: string;
  cost: number;
  pop: number;      // 人口
  gdp: number;      // GDP (百万円/年)
  co2: number;      // CO2 (t/年, 負は削減)
  desc: string;
  minStage: number;
};

export const BUILD_DEFS: BuildDef[] = [
  { kind: "road",      label: "道路",     emoji: "🛣", cost: 30,  pop: 0,   gdp: 6,   co2: 2,   minStage: 0, desc: "区画をつなぐ。周辺の生産性が少し上がる" },
  { kind: "house",     label: "住宅",     emoji: "🏠", cost: 60,  pop: 45,  gdp: 4,   co2: 4,   minStage: 0, desc: "住人が増える基本の建物" },
  { kind: "park",      label: "公園",     emoji: "🌳", cost: 110, pop: 15,  gdp: 2,   co2: -30, minStage: 1, desc: "CO2を吸収し、住みやすさが上がる" },
  { kind: "school",    label: "学校",     emoji: "🏫", cost: 260, pop: 40,  gdp: 26,  co2: 6,   minStage: 2, desc: "教育水準が上がり生産性が伸びる" },
  { kind: "apartment", label: "集合住宅", emoji: "🏢", cost: 220, pop: 260, gdp: 14,  co2: 14,  minStage: 2, desc: "一気に人口が増える" },
  { kind: "hospital",  label: "病院",     emoji: "🏥", cost: 360, pop: 55,  gdp: 30,  co2: 10,  minStage: 3, desc: "人口の維持力が上がる" },
  { kind: "office",    label: "オフィス", emoji: "🏬", cost: 320, pop: 25,  gdp: 75,  co2: 20,  minStage: 3, desc: "GDPの主力。CO2はやや増える" },
  { kind: "solar",     label: "太陽光",   emoji: "🔆", cost: 200, pop: 0,   gdp: 10,  co2: -70, minStage: 4, desc: "再エネでCO2を大きく削減" },
  { kind: "station",   label: "駅",       emoji: "🚉", cost: 520, pop: 90,  gdp: 55,  co2: -18, minStage: 4, desc: "人が集まり、車の排出が減る" },
  { kind: "factory",   label: "工場",     emoji: "🏭", cost: 420, pop: 20,  gdp: 140, co2: 110, minStage: 5, desc: "GDPは大きいがCO2も大きい" },
  { kind: "wind",      label: "風力発電", emoji: "🌀", cost: 300, pop: 0,   gdp: 14,  co2: -105,minStage: 5, desc: "強力なCO2削減設備" },
  { kind: "tower",     label: "高層ビル", emoji: "🏙", cost: 900, pop: 150, gdp: 230, co2: 55,  minStage: 6, desc: "都心のシンボル。人もお金も集まる" },
];

export const buildDef = (k: string) => BUILD_DEFS.find((b) => b.kind === k);
export const refundOf = (cost: number) => Math.floor(cost * 0.4);

// ---------------- 政策 ----------------
export type PolicyDef = {
  key: string;
  label: string;
  emoji: string;
  desc: string;
  // 倍率補正
  pop: number; gdp: number; co2: number;
  // 解放条件（勉強データ）
  requires: (s: StudyInput) => boolean;
  requireLabel: string;
};

export type StudyInput = {
  minutes30: number;     // 直近30日の学習時間(分)
  activeDays30: number;  // 活動日数
  avgScore: number;      // 採点平均点
  subjects: number;      // 学習した教科数
  goalsDone: number;     // 達成した目標数
  streak: number;        // 連続日数
};

export const POLICY_DEFS: PolicyDef[] = [
  {
    key: "carbon_tax", label: "炭素税", emoji: "🌍",
    desc: "排出に課税。CO2を大きく減らすがGDPはやや落ちる",
    pop: 1.0, gdp: 0.92, co2: 0.72,
    requires: (s) => s.activeDays30 >= 5, requireLabel: "直近30日で5日以上の学習",
  },
  {
    key: "green_subsidy", label: "再エネ補助金", emoji: "🔋",
    desc: "再エネ設備の効果を強化。CO2 -15%、GDP -3%",
    pop: 1.0, gdp: 0.97, co2: 0.85,
    requires: (s) => s.minutes30 >= 600, requireLabel: "直近30日で600分以上の学習",
  },
  {
    key: "education_first", label: "教育立国", emoji: "🎓",
    desc: "教育投資でGDP +12%、人口 +5%",
    pop: 1.05, gdp: 1.12, co2: 1.0,
    requires: (s) => s.avgScore >= 60, requireLabel: "採点平均60点以上",
  },
  {
    key: "tech_invest", label: "産業技術投資", emoji: "⚙️",
    desc: "生産性が上がりGDP +18%、CO2 +6%",
    pop: 1.0, gdp: 1.18, co2: 1.06,
    requires: (s) => s.minutes30 >= 1200, requireLabel: "直近30日で1200分以上の学習",
  },
  {
    key: "transit_pass", label: "公共交通無償化", emoji: "🚇",
    desc: "人口 +8%、CO2 -12%、GDP -4%",
    pop: 1.08, gdp: 0.96, co2: 0.88,
    requires: (s) => s.streak >= 5, requireLabel: "5日以上の連続学習",
  },
  {
    key: "immigration", label: "移住促進", emoji: "🧳",
    desc: "人口 +18%、GDP +6%、CO2 +8%",
    pop: 1.18, gdp: 1.06, co2: 1.08,
    requires: (s) => s.subjects >= 3, requireLabel: "3教科以上を学習",
  },
  {
    key: "tourism", label: "観光立国", emoji: "🎏",
    desc: "GDP +10%、CO2 +4%",
    pop: 1.02, gdp: 1.1, co2: 1.04,
    requires: (s) => s.goalsDone >= 1, requireLabel: "目標を1つ以上達成",
  },
  {
    key: "smart_grid", label: "スマートグリッド", emoji: "📡",
    desc: "CO2 -20%、GDP +4%",
    pop: 1.0, gdp: 1.04, co2: 0.8,
    requires: (s) => s.avgScore >= 80 && s.minutes30 >= 900, requireLabel: "平均80点以上かつ900分以上の学習",
  },
];

export const policyDef = (k: string) => POLICY_DEFS.find((p) => p.key === k);

// ---------------- 指標計算 ----------------
export type Metrics = {
  population: number;
  gdp: number;          // 百万円/年
  gdpPerCapita: number; // 万円/人
  co2: number;          // t/年
  co2PerCapita: number; // kg/人
  happiness: number;    // 0-100
  green: number;        // 0-100 環境スコア
  growthPct: number;    // 学習ベースの成長率
};

export type BuildingRow = { id: string; kind: string; gx: number; gz: number; level: number };

export function computeMetrics(
  stage: number,
  study: StudyInput,
  buildings: BuildingRow[],
  policies: string[],
): Metrics {
  // --- 勉強がすべての土台 ---
  const effort = study.minutes30;                    // 学習量
  const consistency = study.activeDays30 / 30;       // 継続率 0..1
  const quality = Math.max(0.4, study.avgScore / 70); // 学力による生産性
  const diversity = 1 + Math.min(0.3, study.subjects * 0.05);

  let population = Math.round(
    (stage * stage * 320 + effort * 2.4 + study.streak * 120) * (0.6 + consistency * 0.8),
  );
  let gdp = Math.round((population / 1000) * 42 * quality * diversity + effort * 0.8);
  let co2 = Math.round(population * 0.0042 * 1000 * (1.15 - consistency * 0.25) / 10);

  // --- 建物 ---
  for (const b of buildings) {
    const d = buildDef(b.kind);
    if (!d) continue;
    const lv = b.level ?? 1;
    population += d.pop * lv;
    gdp += Math.round(d.gdp * lv * quality);
    co2 += d.co2 * lv;
  }

  // --- 政策 ---
  for (const key of policies) {
    const p = policyDef(key);
    if (!p) continue;
    population = Math.round(population * p.pop);
    gdp = Math.round(gdp * p.gdp);
    co2 = Math.round(co2 * p.co2);
  }

  population = Math.max(0, population);
  gdp = Math.max(0, gdp);
  const perCapitaCo2 = population > 0 ? (co2 * 1000) / population : 0;
  const green = Math.max(0, Math.min(100, Math.round(100 - perCapitaCo2 / 8)));
  const happiness = Math.max(
    0,
    Math.min(100, Math.round(40 + consistency * 30 + Math.min(20, gdp / Math.max(1, population / 1000) / 6) + green * 0.15 - 10)),
  );
  const growthPct = Math.round((consistency * 60 + Math.min(40, effort / 40)) - 30);

  return {
    population,
    gdp,
    gdpPerCapita: population > 0 ? Math.round((gdp * 100) / population) : 0,
    co2,
    co2PerCapita: Math.round(perCapitaCo2),
    happiness,
    green,
    growthPct,
  };
}

export function metricsDiff(before: Metrics, after: Metrics) {
  return {
    population: after.population - before.population,
    gdp: after.gdp - before.gdp,
    co2: after.co2 - before.co2,
  };
}

export const fmtNum = (n: number) =>
  n >= 100000000 ? `${(n / 100000000).toFixed(2)}億`
  : n >= 10000 ? `${(n / 10000).toFixed(2)}万`
  : n.toLocaleString("ja-JP");

// ---------------- 区画グリッド ----------------
// gx/gz は整数。1ブロック = 3x3 の区画で、ブロックとブロックの間が道路になる。
export const CELL = 12.2;
export const LOT = 3.0;
export function cellToWorld(gx: number, gz: number): [number, number] {
  const bx = Math.round(gx / 3), bz = Math.round(gz / 3);
  return [bx * CELL + (gx - bx * 3) * LOT, bz * CELL + (gz - bz * 3) * LOT];
}
export function worldToCell(x: number, z: number): [number, number] {
  const bx = Math.round(x / CELL), bz = Math.round(z / CELL);
  const ix = Math.max(-1, Math.min(1, Math.round((x - bx * CELL) / LOT)));
  const iz = Math.max(-1, Math.min(1, Math.round((z - bz * CELL) / LOT)));
  return [bx * 3 + ix, bz * 3 + iz];
}

/** その区画が属するブロックと、ブロック内のオフセット(-1..1) */
export function cellBlock(g: number): { block: number; offset: number } {
  const block = Math.round(g / 3);
  return { block, offset: g - block * 3 };
}

/** 建設できる区画かどうか（道路の上や範囲外は不可） */
export function isBuildableCell(gx: number, gz: number, radius: number): boolean {
  const a = cellBlock(gx), b = cellBlock(gz);
  if (Math.abs(a.offset) > 1 || Math.abs(b.offset) > 1) return false;
  return Math.abs(a.block) <= radius && Math.abs(b.block) <= radius;
}

/** 指定半径内の全区画（ブロック順） */
export function cellsInRadius(radius: number): [number, number][] {
  const out: [number, number][] = [];
  for (let bz = -radius; bz <= radius; bz++)
    for (let oz = -1; oz <= 1; oz++)
      for (let bx = -radius; bx <= radius; bx++)
        for (let ox = -1; ox <= 1; ox++) out.push([bx * 3 + ox, bz * 3 + oz]);
  return out;
}

