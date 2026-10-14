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
  className,
  title = "キャラクター",
}: {
  value?: unknown;
  className?: string;
  title?: string;
}) {
  const character = normalizeCharacter(value);
  return (
    <div
      role="img"
      aria-label={title}
      className={cn("relative aspect-square overflow-hidden rounded-2xl", className)}
      style={{ backgroundColor: character.background }}
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
