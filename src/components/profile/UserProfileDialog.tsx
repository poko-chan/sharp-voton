import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePresence } from "@/lib/presence";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CharacterAvatar } from "./CharacterAvatar";
import { Award, Clock, Flame, Lock, UserPlus, UserCheck, Hourglass, BookOpen, Pin } from "lucide-react";
import { toast } from "sonner";

export type BadgeView = {
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  image_url: string | null;
  how_to_earn: string | null;
  available_from: string | null;
  available_until: string | null;
  earned_at: string | null;
};

export type ProfileCardData = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  avatar_type: string;
  avatar_config: any;
  bio: string | null;
  status_message: string | null;
  pinned_badge_codes: string[];
  study_tags: string[];
  joined_at: string;
  relation: "self" | "friend" | "outgoing" | "incoming" | "blocked" | "none";
  stats: null | {
    total_minutes: number;
    week_minutes: number;
    month_days: number;
    heat: { d: string; m: number }[];
    top_subjects: { name: string; color: string | null; m: number }[];
    top_materials: { name: string; m: number }[];
  };
  badges: BadgeView[];
};

export const BANNER_PRESETS: Record<string, string> = {
  "preset:teal": "linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 40%, var(--accent)))",
  "preset:night": "linear-gradient(135deg, oklch(0.32 0.08 260), oklch(0.45 0.12 230))",
  "preset:sunrise": "linear-gradient(135deg, oklch(0.85 0.12 70), oklch(0.75 0.15 30))",
  "preset:forest": "linear-gradient(135deg, oklch(0.55 0.1 160), oklch(0.75 0.12 130))",
  "preset:grid":
    "repeating-linear-gradient(0deg, color-mix(in oklab, var(--primary) 18%, transparent) 0 1px, transparent 1px 16px), repeating-linear-gradient(90deg, color-mix(in oklab, var(--primary) 18%, transparent) 0 1px, transparent 1px 16px), var(--muted)",
  "preset:sakura": "linear-gradient(135deg, oklch(0.9 0.06 350), oklch(0.8 0.1 320))",
};

export function bannerStyle(url: string | null | undefined): React.CSSProperties {
  if (!url) return { background: BANNER_PRESETS["preset:teal"] };
  if (url.startsWith("preset:")) return { background: BANNER_PRESETS[url] ?? BANNER_PRESETS["preset:teal"] };
  return { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" };
}

export function badgeStatus(b: BadgeView): "earned" | "open" | "closed" | "upcoming" {
  if (b.earned_at) return "earned";
  const now = Date.now();
  if (b.available_until && new Date(b.available_until).getTime() < now) return "closed";
  if (b.available_from && new Date(b.available_from).getTime() > now) return "upcoming";
  return "open";
}

export function BadgeIcon({ b, size = 48 }: { b: Pick<BadgeView, "icon" | "image_url" | "color" | "name">; size?: number }) {
  return (
    <div
      className="rounded-full grid place-items-center overflow-hidden shrink-0 ring-2 ring-background"
      style={{ width: size, height: size, background: b.color ?? "var(--primary)" }}
    >
      {b.image_url ? (
        <img src={b.image_url} alt={b.name} className="w-full h-full object-cover" />
      ) : b.icon ? (
        <span style={{ fontSize: size * 0.48 }}>{b.icon}</span>
      ) : (
        <Award className="text-primary-foreground" style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </div>
  );
}

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}時間${m % 60 ? `${m % 60}分` : ""}` : `${m}分`);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("ja-JP");

export function ProfileAvatar({ p, size = 80 }: { p: Pick<ProfileCardData, "avatar_type" | "avatar_config" | "avatar_url" | "display_name">; size?: number }) {
  if (p.avatar_type === "character" && p.avatar_config)
    return <CharacterAvatar config={p.avatar_config} size={size} className="rounded-full" />;
  return (
    <Avatar style={{ width: size, height: size }}>
      <AvatarImage src={p.avatar_url ?? undefined} />
      <AvatarFallback>{(p.display_name ?? "?").slice(0, 1)}</AvatarFallback>
    </Avatar>
  );
}

export function UserProfileDialog({
  userId,
  onOpenChange,
  onChanged,
}: {
  userId: string | null;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<ProfileCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<BadgeView | null>(null);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const { data: d } = await supabase.rpc("profile_card", { _id: userId });
    setData((d as any) ?? null);
    setLoading(false);
  };
  useEffect(() => {
    setData(null);
    setSelected(null);
    load();
  }, [userId]);

  const isFriend = data?.relation === "friend" || data?.relation === "self";
  const presence = usePresence(userId, isFriend);

  const request = async () => {
    if (!user || !userId) return;
    const { error } = await supabase
      .from("follows")
      .upsert({ follower_id: user.id, following_id: userId, status: "pending" }, { onConflict: "follower_id,following_id" });
    if (error) return toast.error(error.message);
    toast.success("フレンド申請を送りました");
    load();
    onChanged?.();
  };
  const accept = async () => {
    if (!user || !userId) return;
    const { error } = await supabase
      .from("follows")
      .update({ status: "accepted" })
      .eq("follower_id", userId)
      .eq("following_id", user.id);
    if (error) return toast.error(error.message);
    toast.success("フレンドになりました");
    load();
    onChanged?.();
  };

  const pinned = (data?.badges ?? []).filter((b) => b.earned_at && data?.pinned_badge_codes?.includes(b.code));
  const earnedCount = (data?.badges ?? []).filter((b) => b.earned_at).length;
  const maxHeat = Math.max(1, ...(data?.stats?.heat ?? []).map((h) => h.m));
  const heatMap = new Map((data?.stats?.heat ?? []).map((h) => [h.d, h.m]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const k = d.toLocaleDateString("sv-SE");
    return { k, m: heatMap.get(k) ?? 0 };
  });

  return (
    <Dialog open={!!userId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">プロフィール</DialogTitle>
        {loading && !data && <div className="p-10 text-center text-sm text-muted-foreground">読み込み中…</div>}
        {data && (
          <div>
            <div className="h-28" style={bannerStyle(data.banner_url)} />
            <div className="px-5 -mt-10 flex items-end gap-3">
              <div className="relative">
                <div className="rounded-full ring-4 ring-background bg-background">
                  <ProfileAvatar p={data} size={84} />
                </div>
                {presence && (
                  <span
                    className={`absolute bottom-1 right-1 h-4 w-4 rounded-full ring-2 ring-background ${presence.state === "online" ? "bg-primary" : "bg-muted-foreground"}`}
                    title={presence.state === "online" ? "オンライン" : "離席中"}
                  />
                )}
              </div>
              <div className="flex gap-1 pb-1">
                {pinned.slice(0, 3).map((b) => (
                  <button key={b.code} onClick={() => setSelected(b)} title={b.name}>
                    <BadgeIcon b={b} size={30} />
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 pt-2 pb-5 space-y-4">
              <div>
                <div className="text-xl font-bold">{data.display_name ?? data.username}</div>
                <div className="text-sm text-muted-foreground">@{data.username}</div>
                <div className="text-xs mt-1 flex items-center gap-1.5">
                  {presence ? (
                    <span className="text-primary font-medium">
                      {presence.state === "online" ? "オンライン" : "離席中"}
                      {presence.activity ? ` ・ ${presence.activity}` : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">オフライン</span>
                  )}
                  <span className="text-muted-foreground">・ {fmtDate(data.joined_at)} から利用</span>
                </div>
              </div>

              {data.status_message && (
                <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm">
                  <span className="text-xs text-primary font-semibold mr-2">今日のひとこと</span>
                  {data.status_message}
                </div>
              )}
              {data.bio && <p className="text-sm whitespace-pre-wrap">{data.bio}</p>}
              {data.study_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.study_tags.map((t) => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                </div>
              )}

              {data.relation !== "self" && data.relation !== "blocked" && (
                <div className="flex gap-2">
                  {data.relation === "friend" && (
                    <Button variant="outline" size="sm" disabled>
                      <UserCheck className="h-4 w-4 mr-1" /> フレンド
                    </Button>
                  )}
                  {data.relation === "outgoing" && (
                    <Button variant="outline" size="sm" disabled>
                      <Hourglass className="h-4 w-4 mr-1" /> 申請中（承認待ち）
                    </Button>
                  )}
                  {data.relation === "incoming" && (
                    <Button size="sm" onClick={accept}>
                      <UserCheck className="h-4 w-4 mr-1" /> 申請を承認する
                    </Button>
                  )}
                  {data.relation === "none" && (
                    <Button size="sm" onClick={request}>
                      <UserPlus className="h-4 w-4 mr-1" /> フレンド申請
                    </Button>
                  )}
                </div>
              )}

              {data.stats ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <Stat icon={Clock} label="累計" value={fmtMin(data.stats.total_minutes)} />
                    <Stat icon={Clock} label="この7日" value={fmtMin(data.stats.week_minutes)} />
                    <Stat icon={Flame} label="30日中の学習日" value={`${data.stats.month_days}日`} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">直近30日</div>
                    <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-0.5">
                      {days.map((d) => (
                        <div
                          key={d.k}
                          title={`${d.k}: ${d.m}分`}
                          className="aspect-square rounded-sm bg-primary"
                          style={{ opacity: d.m ? 0.25 + 0.75 * (d.m / maxHeat) : 0.08 }}
                        />
                      ))}
                    </div>
                  </div>
                  {data.stats.top_subjects.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">よく学習している教科（30日）</div>
                      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
                        {data.stats.top_subjects.map((s) => (
                          <div key={s.name} style={{ flex: s.m, background: s.color ?? "var(--primary)" }} />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-xs mt-1">
                        {data.stats.top_subjects.map((s) => (
                          <span key={s.name}>{s.name} {fmtMin(s.m)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.stats.top_materials.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">よく使っている教材</div>
                      <ol className="text-sm space-y-0.5">
                        {data.stats.top_materials.map((m, i) => (
                          <li key={m.name} className="flex items-center gap-2">
                            <BookOpen className="h-3.5 w-3.5 text-primary" />
                            <span className="flex-1 truncate">{i + 1}. {m.name}</span>
                            <span className="text-xs text-muted-foreground">{fmtMin(m.m)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" /> 学習記録は非公開です
                </div>
              )}

              <div>
                <div className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <Award className="h-4 w-4 text-primary" /> バッジ {earnedCount}/{data.badges.length}
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {data.badges.map((b) => {
                    const st = badgeStatus(b);
                    return (
                      <button
                        key={b.code}
                        onClick={() => setSelected(b)}
                        className="flex flex-col items-center gap-1 text-center"
                      >
                        <div className={st === "earned" ? "" : "grayscale opacity-40"}>
                          <BadgeIcon b={b} size={44} />
                        </div>
                        <span className="text-[10px] leading-tight line-clamp-2">{b.name}</span>
                      </button>
                    );
                  })}
                </div>
                {selected && <BadgeDetail b={selected} />}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BadgeDetail({ b }: { b: BadgeView }) {
  const st = badgeStatus(b);
  return (
    <div className="mt-3 rounded-lg border p-3 flex gap-3">
      <div className={st === "earned" ? "" : "grayscale opacity-50"}>
        <BadgeIcon b={b} size={48} />
      </div>
      <div className="text-sm space-y-0.5 min-w-0">
        <div className="font-semibold">{b.name}</div>
        {b.description && <div className="text-muted-foreground">{b.description}</div>}
        <div className="text-xs">
          {st === "earned" && <span className="text-primary">{fmtDate(b.earned_at!)} に獲得</span>}
          {st === "open" && (
            <span>
              獲得受付中{b.available_until ? `（${fmtDate(b.available_until)}まで）` : ""}
              {b.how_to_earn ? ` ・ ${b.how_to_earn}` : ""}
            </span>
          )}
          {st === "upcoming" && <span>{fmtDate(b.available_from!)} から獲得可能</span>}
          {st === "closed" && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Lock className="h-3 w-3" /> 獲得期間は終了しました
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2">
      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="font-bold text-sm">{value}</div>
    </div>
  );
}

export { Pin };
