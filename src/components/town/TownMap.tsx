import { BUILD_DEFS, type BuildingRow } from "@/lib/town-economy";

/** 街の区画マップ（2D）。3Dと同じ gx/gz 座標系で位置を示す。 */
export function TownMap({
  radius,
  buildings,
  selected,
  onPick,
  size = 260,
}: {
  radius: number;
  buildings: BuildingRow[];
  selected: [number, number] | null;
  onPick?: (gx: number, gz: number) => void;
  size?: number;
}) {
  const R = radius * 3 + 1;
  const n = R * 2 + 1;
  const cell = size / n;
  const byPos = new Map(buildings.map((b) => [`${b.gx},${b.gz}`, b]));
  const cells: number[] = [];
  for (let i = -R; i <= R; i++) cells.push(i);
  const emoji = (kind: string) => BUILD_DEFS.find((d) => d.kind === kind)?.emoji ?? "◻";

  return (
    <svg width={size} height={size} className="rounded-lg border bg-muted/20">
      {cells.map((gz) =>
        cells.map((gx) => {
          const isRoadRow = Math.abs(gx - Math.round(gx / 3) * 3) > 1 || Math.abs(gz - Math.round(gz / 3) * 3) > 1;
          const b = byPos.get(`${gx},${gz}`);
          const sel = selected && selected[0] === gx && selected[1] === gz;
          const x = (gx + R) * cell;
          const y = (gz + R) * cell;
          return (
            <g key={`${gx},${gz}`} onClick={() => !isRoadRow && onPick?.(gx, gz)} style={{ cursor: isRoadRow ? "default" : "pointer" }}>
              <rect
                x={x + 0.6} y={y + 0.6} width={cell - 1.2} height={cell - 1.2} rx={1.5}
                fill={isRoadRow ? "hsl(var(--muted))" : b ? "hsl(var(--primary) / 0.18)" : "hsl(var(--card))"}
                stroke={sel ? "hsl(var(--primary))" : "hsl(var(--border))"}
                strokeWidth={sel ? 2 : 0.6}
              />
              {b && (
                <text x={x + cell / 2} y={y + cell / 2 + cell * 0.24} textAnchor="middle" fontSize={cell * 0.62}>
                  {emoji(b.kind)}
                </text>
              )}
            </g>
          );
        }),
      )}
      {/* 中心（都心） */}
      <circle cx={size / 2} cy={size / 2} r={2.5} fill="hsl(var(--primary))" />
    </svg>
  );
}
