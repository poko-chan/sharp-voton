import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessagesSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { levelFromMinutes } from "@/lib/level";
import { localDateStr } from "@/lib/date";

type Msg = { id: string; sender_id: string; recipient_id: string; content: string; created_at: string };
type Profile = { id: string; display_name: string | null; email: string | null };

function ChatPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const profiles = useQuery({
    queryKey: ["profiles", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .neq("id", user!.id)
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: !!user,
  });

  const ranks = useQuery({
    queryKey: ["user-ranks", profiles.data?.map((p) => p.id).join(",")],
    queryFn: async () => {
      const ids = (profiles.data ?? []).map((p) => p.id);
      if (ids.length === 0) return {} as Record<string, number>;
      const { data, error } = await supabase.rpc("get_user_study_stats", { _user_ids: ids });
      if (error) throw error;
      const today = localDateStr();
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        const days = r.last_date
          ? Math.floor((new Date(today + "T00:00:00").getTime() - new Date(r.last_date + "T00:00:00").getTime()) / 86400000)
          : 999;
        map[r.user_id] = levelFromMinutes(r.total_minutes ?? 0, days);
      });
      return map;
    },
    enabled: !!profiles.data && profiles.data.length > 0,
  });

  const rankOf = (id: string): number => ranks.data?.[id] ?? 1;

  const messages = useQuery({
    queryKey: ["chat", partnerId],
    queryFn: async () => {
      if (!partnerId || !user) return [] as Msg[];
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
    enabled: !!partnerId && !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("chat-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const m = payload.new as Msg;
        if (
          partnerId &&
          ((m.sender_id === user.id && m.recipient_id === partnerId) ||
            (m.sender_id === partnerId && m.recipient_id === user.id))
        ) {
          qc.invalidateQueries({ queryKey: ["chat", partnerId] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, partnerId, qc]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.data]);

  const send = async () => {
    const t = text.trim();
    if (!t || !partnerId || !user) return;
    setText("");
    const { error } = await supabase.from("chat_messages").insert({
      sender_id: user.id, recipient_id: partnerId, content: t,
    });
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["chat", partnerId] });
  };

  const partner = useMemo(() => profiles.data?.find((p) => p.id === partnerId), [profiles.data, partnerId]);

  return (
    <div className="flex h-[calc(100vh-0px)]">
      <aside className="w-72 border-r bg-card overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2"><MessagesSquare className="h-5 w-5" />ユーザー</h2>
        </div>
        <div className="p-2 space-y-1">
          {profiles.data?.map((p) => (
            <button
              key={p.id}
              onClick={() => setPartnerId(p.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${partnerId === p.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <div className="font-medium flex items-center gap-1.5">
                <span className="truncate">{p.display_name ?? "(no name)"}</span>
                <RankBadge level={rankOf(p.id)} active={partnerId === p.id} />
              </div>
              <div className="text-xs opacity-70 truncate">{p.email}</div>
            </button>
          ))}
          {profiles.data?.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">他のユーザーがいません</p>}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        {!partner ? (
          <div className="flex-1 grid place-items-center text-muted-foreground text-sm">
            左側からチャット相手を選んでください
          </div>
        ) : (
          <>
            <div className="border-b p-3 font-medium flex items-center gap-2">
              <span>{partner.display_name ?? partner.email}</span>
              <RankBadge level={rankOf(partner.id)} />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.data?.map((m) => (
                <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                  <Card className={`px-3 py-2 max-w-[70%] ${m.sender_id === user?.id ? "bg-primary text-primary-foreground" : ""}`}>
                    <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                  </Card>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <form className="border-t p-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="メッセージを入力…" />
              <Button type="submit" disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

function RankBadge({ level, active }: { level: number; active?: boolean }) {
  return (
    <span
      title={`レベル ${level}`}
      className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
        active
          ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30"
          : "bg-primary/10 text-primary border-primary/30"
      }`}
    >
      Lv{level}
    </span>
  );
}

export const Route = createFileRoute("/_authenticated/chat")({ component: ChatPage });
