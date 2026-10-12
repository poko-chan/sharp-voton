import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/**
 * オンライン状況・今開いている画面の共有。
 * Realtime Presence のみを使い、DBへは書き込まない（通信のみ）。
 * 公開範囲は profiles.privacy_online / privacy_activity に従う。
 */
export type PresenceState = "online" | "away";
export type PresenceInfo = {
  state: PresenceState;
  activity: string | null;
  scope: "public" | "friends";
  at: number;
};

const ACTIVITY: [string, string][] = [
  ["/flashcards", "暗記カードで学習中"],
  ["/makron", "Makronで演習中"],
  ["/notebooks", "ノートを作成中"],
  ["/notes", "ノートを作成中"],
  ["/timer", "タイマーで学習中"],
  ["/study", "学習記録を確認中"],
  ["/materials", "教材を見ています"],
  ["/exams", "試験対策中"],
  ["/meetings", "会議に参加中"],
  ["/calendar", "カレンダーを確認中"],
  ["/goals", "目標を確認中"],
  ["/chat", "チャット中"],
  ["/feed", "フィードを見ています"],
  ["/friends", "フレンドを見ています"],
  ["/dashboard", "ホームにいます"],
];

export function activityLabel(path: string): string | null {
  const hit = ACTIVITY.find(([p]) => path === p || path.startsWith(p + "/"));
  return hit ? hit[1] : null;
}

const Ctx = createContext<Record<string, PresenceInfo>>({});

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const path = useLocation({ select: (l) => l.pathname });
  const [peers, setPeers] = useState<Record<string, PresenceInfo>>({});
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const prefsRef = useRef<{ online: string; activity: string }>({ online: "friends", activity: "simple" });
  const stateRef = useRef<PresenceState>("online");
  const pathRef = useRef(path);
  pathRef.current = path;

  const send = () => {
    const ch = chRef.current;
    if (!ch) return;
    const p = prefsRef.current;
    if (p.online === "private") {
      ch.untrack();
      return;
    }
    const label = activityLabel(pathRef.current);
    const activity =
      p.activity === "private" ? null : p.activity === "detailed" ? label : label ? "勉強中" : null;
    ch.track({
      state: stateRef.current,
      activity,
      scope: p.online === "public" ? "public" : "friends",
      at: Date.now(),
    });
  };

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const loadPrefs = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("privacy_online, privacy_activity")
        .eq("id", user.id)
        .maybeSingle();
      if (data) prefsRef.current = { online: data.privacy_online, activity: data.privacy_activity };
    };
    const ch = supabase.channel("study-presence", { config: { presence: { key: user.id } } });
    chRef.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const raw = ch.presenceState() as Record<string, any[]>;
      const next: Record<string, PresenceInfo> = {};
      for (const [k, arr] of Object.entries(raw)) {
        const v =
          arr.find((entry) => entry.state === "online") ??
          arr.reduce(
            (latest, entry) => (entry.at > (latest?.at ?? 0) ? entry : latest),
            null as any,
          );
        if (v) next[k] = { state: v.state, activity: v.activity ?? null, scope: v.scope, at: v.at };
      }
      if (alive) setPeers(next);
    });
    ch.subscribe(async (s) => {
      if (s === "SUBSCRIBED") {
        await loadPrefs();
        send();
      }
    });
    const onPrefs = async () => {
      await loadPrefs();
      send();
    };
    window.addEventListener("study-presence-prefs", onPrefs);

    // 5分無操作で離席
    let idle: ReturnType<typeof setTimeout>;
    const bump = () => {
      clearTimeout(idle);
      if (stateRef.current !== "online") {
        stateRef.current = "online";
        send();
      }
      idle = setTimeout(() => {
        stateRef.current = "away";
        send();
      }, 5 * 60 * 1000);
    };
    const evs = ["pointerdown", "keydown", "visibilitychange"];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    bump();
    return () => {
      alive = false;
      clearTimeout(idle);
      evs.forEach((e) => window.removeEventListener(e, bump));
      window.removeEventListener("study-presence-prefs", onPrefs);
      supabase.removeChannel(ch);
      chRef.current = null;
    };
  }, [user?.id]);

  useEffect(() => {
    send();
  }, [path]);

  return <Ctx.Provider value={peers}>{children}</Ctx.Provider>;
}

/** isFriend=false のときは「全員に公開」の人だけ見える */
export function usePresence(userId: string | null | undefined, isFriend: boolean) {
  const peers = useContext(Ctx);
  if (!userId) return null;
  const p = peers[userId];
  if (!p) return null;
  if (p.scope === "friends" && !isFriend) return null;
  return p;
}

export function notifyPresencePrefsChanged() {
  window.dispatchEvent(new Event("study-presence-prefs"));
}
