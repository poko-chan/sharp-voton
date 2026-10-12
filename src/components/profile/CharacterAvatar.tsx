/** Duolingo風のシンプルなキャラクターアバター（SVG・端末内描画） */
export type AvatarConfig = {
  skin: number;
  hair: number;
  hairColor: number;
  eyes: number;
  mouth: number;
  outfit: number;
  bg: number;
  glasses: boolean;
};

export const SKINS = ["#F9D9C0", "#F1C29B", "#D9A47A", "#B97E55", "#8C5A3C", "#5E3B28"];
export const HAIR_COLORS = ["#2B2420", "#5A3A22", "#A0652F", "#E2B65E", "#C2462F", "#4F6BD8", "#7C7C86"];
export const OUTFITS = ["#00C9B7", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#10B981", "#64748B"];
export const BGS = ["#CFF5F0", "#DBEAFE", "#FEF3C7", "#FCE7F3", "#EDE9FE", "#DCFCE7", "#E2E8F0"];
export const HAIR_COUNT = 5;
export const EYES_COUNT = 4;
export const MOUTH_COUNT = 4;

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: 0,
  hair: 0,
  hairColor: 0,
  eyes: 0,
  mouth: 0,
  outfit: 0,
  bg: 0,
  glasses: false,
};

export function randomAvatar(): AvatarConfig {
  const r = (n: number) => Math.floor(Math.random() * n);
  return {
    skin: r(SKINS.length),
    hair: r(HAIR_COUNT),
    hairColor: r(HAIR_COLORS.length),
    eyes: r(EYES_COUNT),
    mouth: r(MOUTH_COUNT),
    outfit: r(OUTFITS.length),
    bg: r(BGS.length),
    glasses: Math.random() < 0.3,
  };
}

export function CharacterAvatar({
  config,
  size = 80,
  className,
}: {
  config?: Partial<AvatarConfig> | null;
  size?: number;
  className?: string;
}) {
  const c = { ...DEFAULT_AVATAR, ...(config ?? {}) };
  const skin = SKINS[c.skin % SKINS.length];
  const hc = HAIR_COLORS[c.hairColor % HAIR_COLORS.length];
  const outfit = OUTFITS[c.outfit % OUTFITS.length];
  const bg = BGS[c.bg % BGS.length];
  const ink = "#1F2937";
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <circle cx="50" cy="50" r="50" fill={bg} />
      {/* back hair (long) */}
      {c.hair === 3 && <rect x="24" y="30" width="52" height="46" rx="20" fill={hc} />}
      {/* body */}
      <path d="M18 100 Q18 72 50 72 Q82 72 82 100 Z" fill={outfit} />
      <rect x="43" y="62" width="14" height="12" rx="5" fill={skin} />
      {/* head */}
      <ellipse cx="50" cy="45" rx="22" ry="24" fill={skin} />
      {/* hair */}
      {c.hair === 0 && <path d="M28 42 Q28 18 50 18 Q72 18 72 42 Q64 30 50 30 Q36 30 28 42 Z" fill={hc} />}
      {c.hair === 1 && <path d="M27 46 Q24 16 50 17 Q78 16 73 46 Q70 34 58 30 Q48 38 32 36 Z" fill={hc} />}
      {c.hair === 2 && (
        <>
          <path d="M28 40 Q30 18 50 18 Q70 18 72 40 Q50 26 28 40 Z" fill={hc} />
          <circle cx="50" cy="14" r="8" fill={hc} />
        </>
      )}
      {c.hair === 3 && <path d="M27 44 Q27 18 50 18 Q73 18 73 44 Q62 28 50 30 Q38 28 27 44 Z" fill={hc} />}
      {c.hair === 4 && <path d="M30 34 Q40 20 50 22 Q60 20 70 34 Q60 28 50 29 Q40 28 30 34 Z" fill={hc} />}
      {/* eyes */}
      {c.eyes === 0 && (
        <>
          <circle cx="41" cy="46" r="3" fill={ink} />
          <circle cx="59" cy="46" r="3" fill={ink} />
        </>
      )}
      {c.eyes === 1 && (
        <>
          <ellipse cx="41" cy="46" rx="3.5" ry="4.5" fill={ink} />
          <ellipse cx="59" cy="46" rx="3.5" ry="4.5" fill={ink} />
          <circle cx="42.2" cy="44.5" r="1.2" fill="#fff" />
          <circle cx="60.2" cy="44.5" r="1.2" fill="#fff" />
        </>
      )}
      {c.eyes === 2 && (
        <g stroke={ink} strokeWidth="2.4" fill="none" strokeLinecap="round">
          <path d="M37 47 Q41 43 45 47" />
          <path d="M55 47 Q59 43 63 47" />
        </g>
      )}
      {c.eyes === 3 && (
        <g stroke={ink} strokeWidth="2.4" strokeLinecap="round">
          <line x1="37" y1="46" x2="45" y2="46" />
          <line x1="55" y1="46" x2="63" y2="46" />
        </g>
      )}
      {c.glasses && (
        <g stroke={ink} strokeWidth="1.6" fill="none">
          <circle cx="41" cy="46" r="6.5" />
          <circle cx="59" cy="46" r="6.5" />
          <line x1="47.5" y1="46" x2="52.5" y2="46" />
        </g>
      )}
      {/* cheeks */}
      <circle cx="35" cy="54" r="3" fill="#F28B82" opacity="0.35" />
      <circle cx="65" cy="54" r="3" fill="#F28B82" opacity="0.35" />
      {/* mouth */}
      {c.mouth === 0 && <path d="M44 56 Q50 61 56 56" stroke={ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />}
      {c.mouth === 1 && <path d="M43 55 Q50 64 57 55 Z" fill={ink} />}
      {c.mouth === 2 && <line x1="45" y1="57" x2="55" y2="57" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />}
      {c.mouth === 3 && <circle cx="50" cy="57" r="2.6" fill={ink} />}
    </svg>
  );
}
