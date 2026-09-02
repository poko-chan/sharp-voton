import { BUILD_DEFS, cellBlock, type BuildingRow } from "@/lib/town-economy";

/**
 * 街の区画マップ（2D）。3Dと同じ座標系で、1ブロック = 3x3 区画。
 * ブロックとブロックの間だけが道路になるので、道路の上に建物が建つことはない。
 */
export function TownMap({
  radius,
  buildings,
  selected,
  onPick,
  size = 300,
}: {
  radius: number;
  buildings: BuildingRow[];
  selected: [number, number] | null;
  onPick?: (gx: number, gz: number) => void;
  size?: number;
}) {
  const n = radius * 2 + 1;              // ブロック数（1辺）
  const ROAD_RATIO = 0.75;               // 道路幅 = 区画幅 × これ
  const lot = size / (n * 3 + (n + 1) * ROAD_RATIO);
  const road = lot * ROAD_RATIO;

  const pos = (g: number) => {
    const { block, offset } = cellBlock(g);
    const bi = block + radius;           // 0..n-1
    return road * (bi + 1) + lot * (bi * 3 + offset + 1);
  };
  const blockPos = (b: number) => {
    const bi = b + radius;
    return road * (bi + 1) + lot * bi * 3;
  };

  const byPos = new Map(buildings.map((b) => [`${b.gx},${b.gz}`, b]));
  const emoji = (kind: string) => BUILD_DEFS.find((d) => d.kind === kind)?.emoji ?? "◻";

  const blocks: number[] = [];
  for (let b = -radius; b <= radius; b++) blocks.push(b);
  const offsets = [-1, 0, 1];

  return (
    <svg width={size} height={size} className="rounded-xl border select-none" role="img" aria-label="街の区画マップ">
      {/* 道路（地面全体） */}
      <rect x={0} y={0} width={size} height={size} fill="hsl(var(--muted-foreground) / 0.22)" />
      {/* センターライン */}
      {blocks.map((b) => (
        <g key={"cl" + b}>
          <line x1={blockPos(b) - road / 2} y1={0} x2={blockPos(b) - road / 2} y2={size}
            stroke="hsl(var(--background))" strokeWidth={1} strokeDasharray="4 5" opacity={0.7} />
          <line x1={0} y1={blockPos(b) - road / 2} x2={size} y2={blockPos(b) - road / 2}
            stroke="hsl(var(--background))" strokeWidth={1} strokeDasharray="4 5" opacity={0.7} />
        </g>
      ))}

      {/* ブロック（3x3 区画のまとまり） */}
      {blocks.map((bz) =>
        blocks.map((bx) => (
          <rect
            key={`b${bx},${bz}`}
            x={blockPos(bx) - 1} y={blockPos(bz) - 1}
            width={lot * 3 + 2} height={lot * 3 + 2}
            rx={3} fill="hsl(var(--muted) / 0.6)" stroke="hsl(var(--border))" strokeWidth={1}
          />
        )),
      )}

      {/* 区画 */}
      {blocks.map((bz) =>
        offsets.map((oz) =>
          blocks.map((bx) =>
            offsets.map((ox) => {
              const gx = bx * 3 + ox, gz = bz * 3 + oz;
              const b = byPos.get(`${gx},${gz}`);
              const sel = selected && selected[0] === gx && selected[1] === gz;
              const x = pos(gx), y = pos(gz);
              return (
                <g key={`${gx},${gz}`} onClick={() => onPick?.(gx, gz)} style={{ cursor: "pointer" }}>
                  <rect
                    x={x + 0.5} y={y + 0.5} width={lot - 1} height={lot - 1} rx={2}
                    fill={b ? "hsl(var(--primary) / 0.18)" : "hsl(var(--card))"}
                    stroke={sel ? "hsl(var(--primary))" : "hsl(var(--border) / 0.8)"}
                    strokeWidth={sel ? 2.5 : 0.6}
                  />
                  {b && (
                    <text x={x + lot / 2} y={y + lot / 2 + lot * 0.24} textAnchor="middle" fontSize={lot * 0.62}>
                      {emoji(b.kind)}
                    </text>
                  )}
                </g>
              );
            }),
          ),
        ),
      )}

      {/* 中心（都心） */}
      <circle cx={size / 2} cy={size / 2} r={2.5} fill="hsl(var(--primary))" />
    </svg>
  );
}
