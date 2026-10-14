import { cn } from "@/lib/utils";

export type CharacterConfig = {
  skin: string;
  hair: string;
  hairColor: string;
  eyes: string;
  outfit: string;
  outfitColor: string;
  accessory: string;
  background: string;
};

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
  const randomIndex = (length: number) => Math.floor(Math.random() * length);
  return {
    skin: randomIndex(SKINS.length),
    hair: randomIndex(HAIR_COUNT),
    hairColor: randomIndex(HAIR_COLORS.length),
    eyes: randomIndex(EYES_COUNT),
    mouth: randomIndex(MOUTH_COUNT),
    outfit: randomIndex(OUTFITS.length),
    bg: randomIndex(BGS.length),
    glasses: Math.random() < 0.3,
  };
}

export const DEFAULT_CHARACTER: CharacterConfig = {
  skin: "#f6c7a5",
  hair: "short",
  hairColor: "#3b2418",
  eyes: "round",
  outfit: "hoodie",
  outfitColor: "#6366f1",
  accessory: "none",
  background: "#e0e7ff",
};

export function normalizeCharacter(value: unknown): CharacterConfig {
  if (!value || typeof value !== "object") return DEFAULT_CHARACTER;
  const input = value as Partial<CharacterConfig>;
  return {
    ...DEFAULT_CHARACTER,
    ...Object.fromEntries(
      Object.entries(input).filter(([, item]) => typeof item === "string"),
    ),
  } as CharacterConfig;
}

const HAIR: Record<string, string> = {
  short: "◢◣",
  bob: "◖◗",
  long: "◥◤",
  curly: "❧❧",
};
const EYES: Record<string, string> = { round: "• •", calm: "− −", star: "★ ★" };
const ACCESSORIES: Record<string, string> = { none: "", glasses: "👓", cap: "🧢", bow: "🎀" };

export function CharacterAvatar({
  value,
  config,
  className,
  size,
  title = "キャラクター",
}: {
  value?: unknown;
  config?: Partial<AvatarConfig> | null;
  className?: string;
  size?: number;
  title?: string;
}) {
  const character = config
    ? {
        ...DEFAULT_CHARACTER,
        skin: SKINS[(config.skin ?? DEFAULT_AVATAR.skin) % SKINS.length],
        hair: ["short", "bob", "long", "curly", "short"][config.hair ?? DEFAULT_AVATAR.hair],
        hairColor: HAIR_COLORS[(config.hairColor ?? DEFAULT_AVATAR.hairColor) % HAIR_COLORS.length],
        eyes: ["round", "star", "calm", "calm"][config.eyes ?? DEFAULT_AVATAR.eyes],
        outfit: ["hoodie", "uniform", "jacket"][
          (config.outfit ?? DEFAULT_AVATAR.outfit) % 3
        ],
        outfitColor: OUTFITS[(config.outfit ?? DEFAULT_AVATAR.outfit) % OUTFITS.length],
        accessory: config.glasses ? "glasses" : "none",
        background: BGS[(config.bg ?? DEFAULT_AVATAR.bg) % BGS.length],
      }
    : normalizeCharacter(value);
  return (
    <div
      role="img"
      aria-label={title}
      className={cn("relative aspect-square overflow-hidden rounded-2xl", className)}
      style={{ backgroundColor: character.background, ...(size ? { width: size, height: size } : {}) }}
    >
      <div
        className="absolute left-1/2 top-[18%] flex h-[49%] w-[55%] -translate-x-1/2 items-center justify-center rounded-[48%] border-2 border-black/10 text-[clamp(0.6rem,4vw,1.2rem)]"
        style={{ backgroundColor: character.skin }}
      >
        <span
          className="absolute -top-[19%] whitespace-nowrap font-black tracking-[-0.35em]"
          style={{ color: character.hairColor }}
        >
          {HAIR[character.hair] ?? HAIR.short}
        </span>
        <span className="mt-[18%] whitespace-pre font-bold text-black/70">
          {EYES[character.eyes] ?? EYES.round}
        </span>
        <span className="absolute bottom-[14%] text-[0.65em] text-black/50">⌣</span>
        {ACCESSORIES[character.accessory] && (
          <span className="absolute -right-[24%] -top-[8%] text-[0.9em]">{ACCESSORIES[character.accessory]}</span>
        )}
      </div>
      <div
        className="absolute bottom-[-7%] left-1/2 h-[42%] w-[72%] -translate-x-1/2 rounded-t-[48%] border-2 border-black/10"
        style={{ backgroundColor: character.outfitColor }}
      >
        <span className="absolute left-1/2 top-[22%] -translate-x-1/2 text-[0.7em] font-black text-white/80">
          {character.outfit === "uniform" ? "✦" : character.outfit === "jacket" ? "◆" : "♡"}
        </span>
      </div>
    </div>
  );
}
