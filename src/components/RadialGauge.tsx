import type { ReactNode } from "react";

type Props = {
  /** 0-100 */
  value: number;
  size?: number;
  thickness?: number;
  /** グラデーションの開始/終了色（CSS カラー） */
  from?: string;
  to?: string;
  label?: ReactNode;
  sub?: ReactNode;
  /** 目盛りを描く */
  ticks?: number;
  className?: string;
};

let uid = 0;

export function RadialGauge({
  value,
  size = 168,
  thickness = 14,
  from = "oklch(0.72 0.19 150)",
  to = "oklch(0.62 0.21 265)",
  label,
  sub,
  ticks = 0,
  className = "",
}: Props) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const id = `gauge-${++uid}`;

  return (
    <div className={`relative inline-grid place-items-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="currentColor"
          className="text-muted/40"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          filter={pct > 0 ? `url(#${id}-glow)` : undefined}
          style={{ transition: "stroke-dasharray 900ms cubic-bezier(.22,1,.36,1)" }}
        />
        {ticks > 0 &&
          Array.from({ length: ticks }).map((_, i) => {
            const a = (i / ticks) * 2 * Math.PI;
            const r1 = r + thickness / 2 + 3;
            const r2 = r1 + 4;
            return (
              <line
                key={i}
                x1={size / 2 + Math.cos(a) * r1}
                y1={size / 2 + Math.sin(a) * r1}
                x2={size / 2 + Math.cos(a) * r2}
                y2={size / 2 + Math.sin(a) * r2}
                stroke="currentColor"
                className="text-muted-foreground/35"
                strokeWidth={2}
                strokeLinecap="round"
              />
            );
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center px-4">
        <div>
          <div className="text-3xl font-extrabold tabular-nums leading-none tracking-tight">{label}</div>
          {sub && <div className="text-[11px] text-muted-foreground mt-1.5 leading-tight">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/** 横型の迫力バー。目標ページなどで使用。 */
export function PowerBar({
  value,
  height = 18,
  from = "oklch(0.75 0.19 150)",
  to = "oklch(0.62 0.21 265)",
  striped = true,
}: { value: number; height?: number; from?: string; to?: string; striped?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className="relative w-full overflow-hidden rounded-full bg-muted/60 ring-1 ring-inset ring-border/60"
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full relative"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${from}, ${to})`,
          boxShadow: pct > 0 ? `0 0 18px -2px ${to}` : undefined,
          transition: "width 900ms cubic-bezier(.22,1,.36,1)",
        }}
      >
        {striped && (
          <div
            className="absolute inset-0 rounded-full opacity-25"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,.9) 0 8px, transparent 8px 16px)",
            }}
          />
        )}
      </div>
      {[25, 50, 75].map((m) => (
        <div key={m} className="absolute top-0 bottom-0 w-px bg-background/50" style={{ left: `${m}%` }} />
      ))}
    </div>
  );
}
