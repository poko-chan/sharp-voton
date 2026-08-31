import { BUILD_DEFS, type BuildingRow } from "@/lib/town-economy";

/** 街の区画マップ（2D）。3Dと同じ gx/gz 座標系。3区画ごとに道路（ブロック境界）が入る。 */
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
  const R = radius * 3 + 1;
  const n = R * 2 + 1;
  const cell = size / n;
  const byPos = new Map(buildings.map((b) => [`${b.gx},${b.gz}`, b]));
  const cells: number[] = [];
  for (let i = -R; i <= R; i++) cells.push(i);
  const emoji = (kind: string) => BUILD_DEFS.find((d) => d.kind === kind)?.emoji ?? "◻";
  // ブロック境界（道路）の位置：gx = 3k+1 と 3k+2 の間
  const roadAt = (i: number) => (i - (-R)) % 3 === 0 && i !== -R;

  return (
    <svg width={size} height={size} className="rounded-xl border bg-muted/20 select-none">
      {/* 道路 */}
      {cells.map((i) =>
        roadAt(i) ? (
          <g key={"r" + i}>
            <rect x={(i + R) * cell - cell * 0.16} y={0} width={cell * 0.32} height={size} fill="hsl(var(--muted-foreground) / 0.22)" />
            <rect x={0} y={(i + R) * cell - cell * 0.16} width={size} height={cell * 0.32} fill="hsl(var(--muted-foreground) / 0.22)" />
          </g>
        ) : null,
      )}
      {cells.map((gz) =>
        cells.map((gx) => {
          const b = byPos.get(`${gx},${gz}`);
          const sel = selected && selected[0] === gx && selected[1] === gz;
          const x = (gx + R) * cell;
          const y = (gz + R) * cell;
          return (
            <g key={`${gx},${gz}`} onClick={() => onPick?.(gx, gz)} style={{ cursor: "pointer" }}>
              <rect
                x={x + 1} y={y + 1} width={cell - 2} height={cell - 2} rx={2}
                fill={b ? "hsl(var(--primary) / 0.18)" : "hsl(var(--card))"}
                stroke={sel ? "hsl(var(--primary))" : "hsl(var(--border))"}
                strokeWidth={sel ? 2.5 : 0.6}
              />
              {b && (
                <text x={x + cell / 2} y={y + cell / 2 + cell * 0.24} textAnchor="middle" fontSize={cell * 0.6}>
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
