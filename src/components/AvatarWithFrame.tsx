import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  name?: string | null;
  frame?: string | null;
  size?: number;
  className?: string;
};

const FRAME_STYLES: Record<string, string> = {
  gold: "ring-2 ring-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.6)]",
  silver: "ring-2 ring-gray-300 shadow-[0_0_10px_rgba(209,213,219,0.6)]",
  bronze: "ring-2 ring-orange-400",
  rainbow: "ring-2 ring-pink-400 [background:conic-gradient(from_0deg,#f87171,#fbbf24,#34d399,#60a5fa,#a78bfa,#f87171)] p-[2px]",
  neon: "ring-2 ring-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.7)]",
  sakura: "ring-2 ring-pink-300 shadow-[0_0_10px_rgba(244,114,182,0.5)]",
  star: "ring-2 ring-amber-300",
};

export function AvatarWithFrame({ src, name, frame, size = 40, className }: Props) {
  const frameCls = frame ? FRAME_STYLES[frame] ?? "" : "";
  const initials = (name ?? "?").slice(0, 2).toUpperCase();
  return (
    <div
      className={cn("relative inline-flex rounded-full", frameCls, className)}
      style={{ width: size, height: size }}
    >
      <Avatar style={{ width: size, height: size }} className="rounded-full">
        {src && <AvatarImage src={src} alt={name ?? ""} />}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
    </div>
  );
}

export default AvatarWithFrame;