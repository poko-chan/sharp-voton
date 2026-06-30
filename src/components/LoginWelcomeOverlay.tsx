import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";

type Board = { id: string; title: string; body: string; created_at: string };

const SESSION_KEY = "lovable.loginOverlay.shownAt.v1";

/**
 * ログイン後 1 回限り表示するウェルカム＋掲示板オーバーレイ。
 * 「Welcome, {name}」が中央フェードイン → 上にスライド → 下から掲示板スライドイン。
 */
export function LoginWelcomeOverlay() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState<boolean>(true);
  const [boards, setBoards] = useState<Board[]>([]);
  const [phase, setPhase] = useState<"hidden" | "welcome" | "board" | "closing">("hidden");

  useEffect(() => {
    if (!user) return;
    // 1セッション1回
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_KEY)) return;
    (async () => {
      const { data: settings } = await (supabase as any)
        .from("app_settings").select("login_overlay_enabled").limit(1).maybeSingle();
      const on = settings?.login_overlay_enabled ?? true;
      setEnabled(on);
      const { data } = await (supabase as any)
        .from("login_boards")
        .select("id,title,body,created_at,audience,target_user_id")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(5);
      const list = (data ?? []) as any[];
      // 既読を除外
      const ids = list.map((b) => b.id);
      let seenIds: string[] = [];
      if (ids.length) {
        const { data: seen } = await (supabase as any)
          .from("user_board_seen").select("board_id").eq("user_id", user.id).in("board_id", ids);
        seenIds = (seen ?? []).map((s: any) => s.board_id);
      }
      const fresh = list.filter((b) => !seenIds.includes(b.id));
      if (!on || fresh.length === 0) return;
      setBoards(fresh);
      try { sessionStorage.setItem(SESSION_KEY, String(Date.now())); } catch {}
      setPhase("welcome");
      setTimeout(() => setPhase("board"), 2200);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const close = async () => {
    setPhase("closing");
    if (user && boards.length) {
      await (supabase as any).from("user_board_seen").upsert(
        boards.map((b) => ({ user_id: user.id, board_id: b.id })),
        { onConflict: "user_id,board_id" },
      );
    }
    setTimeout(() => setPhase("hidden"), 350);
  };

  if (phase === "hidden" || !enabled) return null;

  const displayName =
    (user?.user_metadata as any)?.username ||
    (user?.user_metadata as any)?.full_name ||
    user?.email?.split("@")[0] ||
    "you";

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center transition-opacity duration-300 ${
        phase === "closing" ? "opacity-0" : "opacity-100"
      }`}
      style={{
        background:
          "radial-gradient(ellipse at center, color-mix(in oklab, var(--background) 92%, black), color-mix(in oklab, var(--background) 70%, black))",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Welcome */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 transition-all duration-[1100ms] ease-[cubic-bezier(.2,.7,.2,1)] ${
          phase === "welcome" ? "top-1/2 -translate-y-1/2 opacity-100" : "top-[8%] -translate-y-0 opacity-90"
        }`}
      >
        <div className="flex items-center gap-3 px-6 py-4">
          <Sparkles className="h-7 w-7 text-primary animate-pulse" />
          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">welcome</div>
            <div className="text-3xl sm:text-5xl font-semibold tracking-tight">
              {displayName}<span className="text-primary">.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Board */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-[min(560px,92vw)] transition-all duration-[900ms] ease-out ${
          phase === "board"
            ? "bottom-[10%] opacity-100 translate-y-0"
            : "bottom-[-30%] opacity-0 translate-y-8"
        }`}
      >
        <div className="glass rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <div className="text-sm font-medium tracking-wide">お知らせ / 掲示板</div>
            <Button size="icon" variant="ghost" onClick={close} aria-label="閉じる">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto divide-y">
            {boards.map((b) => (
              <div key={b.id} className="p-5 space-y-1">
                <div className="text-xs text-muted-foreground">
                  {new Date(b.created_at).toLocaleString("ja-JP")}
                </div>
                <div className="text-base font-semibold">{b.title}</div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                  {b.body}
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t flex justify-end">
            <Button onClick={close}>確認した</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginWelcomeOverlay;