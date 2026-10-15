import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, Sparkles, Swords } from "lucide-react";
import { Progress } from "@/components/ui/progress";

/* 努力で解放されるゲーム要素（コイン・ショップなし）。すべて実績から計算。 */

export const ACCESSORIES = [
  { key: "none", label: "なし", icon: "", need: "最初から", ok: () => true },
  { key: "headphones", label: "ヘッドホン", icon: "🎧", need: "3日連続", ok: (s: GameStats) => s.streak >= 3 },
  { key: "glasses", label: "キラキラメガネ", icon: "🤓", need: "7日連続", ok: (s: GameStats) => s.streak >= 7 },
  { key: "cap", label: "探検キャップ", icon: "🧢", need: "累計10時間", ok: (s: GameStats) => s.total >= 600 },
  { key: "wings", label: "天使の羽", icon: "🪽", need: "14日連続", ok: (s: GameStats) => s.streak >= 14 },
  { key: "cape", label: "勇者のマント", icon: "🦸", need: "累計50時間", ok: (s: GameStats) => s.total >= 3000 },
  { key: "crown", label: "黄金の王冠", icon: "👑", need: "30日連続", ok: (s: GameStats) => s.streak >= 30 },
  { key: "star", label: "伝説の星", icon: "🌟", need: "バッジ10個", ok: (s: GameStats) => s.badges >= 10 },
] as const;

export const PETS = [
  { key: "owl", label: "フクロウ", stages: ["🥚", "🐣", "🦉"] },
  { key: "penguin", label: "ペンギン", stages: ["🥚", "🐣", "🐧"] },
  { key: "dog", label: "柴犬", stages: ["🥚", "🐶", "🐕"] },
  { key: "cat", label: "ねこ", stages: ["🥚", "🐱", "🐈"] },
  { key: "robot", label: "ロボ", stages: ["🔩", "🤖", "🦾"] },
  { key: "dragon", label: "ドラゴン", stages: ["🥚", "🦎", "🐉"] },
] as const;

const PREFIX = ["駆け出しの", "ひたむきな", "不屈の", "疾風の", "星詠みの", "伝説の"];
const NOUN = ["見習い", "探求者", "冒険者", "賢者", "勇者", "マスター"];

export type GameStats = { total: number; streak: number; badges: number; week: number };
export type GameConfig = { pet?: string; acc?: string };

export function gameLevel(s: GameStats) {
  const xp = s.total + s.streak * 30 + s.badges * 60;
  const level = Math.floor(Math.sqrt(xp / 25)) + 1;
  const cur = (level - 1) ** 2 * 25;
  const next = level ** 2 * 25;
  return { xp, level, pct: Math.round(((xp - cur) / (next - cur)) * 100), toNext: next - xp };
}

function petStage(s: GameStats) {
  const days = Math.max(s.streak, Math.floor(s.total / 60));
  return days >= 20 ? 2 : days >= 5 ? 1 : 0;
}

function speech(s: GameStats, self: boolean, name: string) {
  const h = new Date().getHours();
  if (!self) return `${name}のプロフィールへようこそ！タップでハイタッチしよう`;
  if (s.streak >= 7) return `${s.streak}日連続！もう止まらないね🔥`;
  if (s.week === 0) return "今週はまだ冒険してないよ。5分だけ始めよう！";
  if (h < 10) return "おはよう！朝の集中は最強だよ☀️";
  if (h >= 22) return "夜更かしはほどほどにね🌙";
  return "今日もいっしょにがんばろう！";
}

const CONFETTI = ["✨", "⭐", "🎉", "💫", "🌟", "💖"];

export function GameProfileCard({
  userId,
  isSelf,
  name,
  avatarConfig,
  avatar,
  stats,
}: {
  userId: string;
  isSelf: boolean;
  name: string;
  avatarConfig: any;
  avatar: React.ReactNode;
  stats: GameStats;
}) {
  const initial: GameConfig = (avatarConfig && typeof avatarConfig === "object" && avatarConfig.game) || {};
  const [cfg, setCfg] = useState<GameConfig>(initial);
  const [jump, setJump] = useState(0);
  const [burst, setBurst] = useState<{ id: number; x: number; e: string; d: number }[]>([]);
  const [bubble, setBubble] = useState<string | null>(null);
  const [tab, setTab] = useState<"acc" | "pet" | null>(null);

  const lv = gameLevel(stats);
  const unlocked = ACCESSORIES.filter((a) => a.ok(stats)).map((a) => a.key as string);
  const acc = ACCESSORIES.find((a) => a.key === cfg.acc && unlocked.includes(a.key));
  const pet = PETS.find((p) => p.key === cfg.pet) ?? PETS[0];
  const stage = petStage(stats);
  const title = `${PREFIX[Math.min(PREFIX.length - 1, Math.floor(stats.streak / 6))]}${NOUN[Math.min(NOUN.length - 1, Math.floor((lv.level - 1) / 4))]}`;
  const bars = useMemo(
    () => [
      { label: "継続力", v: Math.min(99, stats.streak * 3 + 1) },
      { label: "集中力", v: Math.min(99, Math.floor(stats.total / 60) + 1) },
      { label: "今週の勢い", v: Math.min(99, Math.floor(stats.week / 15) + 1) },
      { label: "コレクション", v: Math.min(99, stats.badges * 8 + unlocked.length * 4) },
    ],
    [stats, unlocked.length],
  );

  const tap = () => {
    setJump((j) => j + 1);
    const id = Date.now();
    setBurst(Array.from({ length: isSelf ? 6 : 14 }, (_, i) => ({ id: id + i, x: Math.random() * 100, e: CONFETTI[i % CONFETTI.length], d: Math.random() * 0.3 })));
    setTimeout(() => setBurst([]), 1300);
    const lines = isSelf
      ? ["えへへ、くすぐったい！", `Lv.${lv.level}まで来たね！`, `あと${lv.toNext}XPでレベルアップ！`, speech(stats, true, name)]
      : [`${name}にハイタッチ！🙌`, "いっしょにがんばろう！", "ナイスファイト！"];
    setBubble(lines[Math.floor(Math.random() * lines.length)]);
    if (!isSelf) toast.success(`${name}にハイタッチしました🙌`);
  };

  const save = async (next: GameConfig) => {
    setCfg(next);
    const base = avatarConfig && typeof avatarConfig === "object" ? avatarConfig : {};
    const { error } = await supabase.from("profiles").update({ avatar_config: { ...base, game: next } } as any).eq("id", userId);
    if (error) toast.error("保存できませんでした");
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1 rounded-md bg-foreground/90 px-2 py-0.5 text-[11px] font-bold text-background">
          <Swords className="h-3 w-3" /> {title}
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">LEVEL</div>
          <div className="text-2xl font-black leading-none text-primary">{lv.level}</div>
        </div>
      </div>

      <div className="relative mt-2 flex h-36 items-end justify-center">
        {burst.map((b) => (
          <span key={b.id} className="pointer-events-none absolute bottom-10 text-xl game-confetti" style={{ left: `${b.x}%`, animationDelay: `${b.d}s` }}>
            {b.e}
          </span>
        ))}
        <div className="absolute left-1/2 top-0 max-w-[90%] -translate-x-1/2 rounded-xl border bg-background px-3 py-1 text-center text-[11px] font-medium shadow-sm">
          {bubble ?? speech(stats, isSelf, name)}
        </div>
        <button key={jump} onClick={tap} className={`relative ${jump ? "game-jump" : "game-idle"}`} aria-label={isSelf ? "キャラクターをタップ" : "ハイタッチする"}>
          {acc?.icon && <span className="absolute -right-3 -top-3 z-10 text-2xl">{acc.icon}</span>}
          {avatar}
        </button>
        <span className="game-pet ml-1 text-3xl" title={`${pet.label}（${["たまご", "こども", "おとな"][stage]}）`}>
          {pet.stages[stage]}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>XP {lv.xp}</span>
          <span>次のレベルまで {lv.toNext}</span>
        </div>
        <Progress value={lv.pct} className="mt-1 h-2" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="flex justify-between text-[10px]">
              <span className="font-semibold">{b.label}</span>
              <span className="text-primary font-bold">{b.v}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${b.v}%` }} />
            </div>
          </div>
        ))}
      </div>

      {isSelf && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-1.5">
            <button onClick={() => setTab(tab === "acc" ? null : "acc")} className={`flex-1 rounded-lg border px-2 py-1 text-xs font-semibold ${tab === "acc" ? "border-primary bg-primary/10" : ""}`}>
              <Sparkles className="mr-1 inline h-3 w-3" />装備 {unlocked.length - 1}/{ACCESSORIES.length - 1}
            </button>
            <button onClick={() => setTab(tab === "pet" ? null : "pet")} className={`flex-1 rounded-lg border px-2 py-1 text-xs font-semibold ${tab === "pet" ? "border-primary bg-primary/10" : ""}`}>
              {pet.stages[stage]} 相棒をえらぶ
            </button>
          </div>
          {tab === "acc" && (
            <div className="grid grid-cols-4 gap-1.5">
              {ACCESSORIES.map((a) => {
                const ok = unlocked.includes(a.key);
                const on = (cfg.acc ?? "none") === a.key;
                return (
                  <button key={a.key} disabled={!ok} onClick={() => save({ ...cfg, acc: a.key })} title={ok ? a.label : `${a.need}で解放`}
                    className={`flex flex-col items-center rounded-lg border p-1.5 text-[9px] ${on ? "border-primary bg-primary/10" : ""} ${ok ? "" : "opacity-40 grayscale"}`}>
                    <span className="text-lg">{ok ? a.icon || "—" : <Lock className="h-4 w-4" />}</span>
                    <span className="truncate w-full text-center">{ok ? a.label : a.need}</span>
                  </button>
                );
              })}
            </div>
          )}
          {tab === "pet" && (
            <div className="grid grid-cols-3 gap-1.5">
              {PETS.map((p) => (
                <button key={p.key} onClick={() => save({ ...cfg, pet: p.key })}
                  className={`flex flex-col items-center rounded-lg border p-1.5 text-[10px] ${pet.key === p.key ? "border-primary bg-primary/10" : ""}`}>
                  <span className="text-xl">{p.stages[stage]}</span>
                  {p.label}
                </button>
              ))}
              <div className="col-span-3 text-center text-[10px] text-muted-foreground">相棒は勉強を続けると たまご→こども→おとな に進化します</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
