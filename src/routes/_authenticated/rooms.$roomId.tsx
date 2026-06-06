import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Play, Square } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rooms/$roomId")({ component: RoomPage });

function RoomPage() {
  const { roomId } = Route.useParams();
  const { user } = useAuth();
  const [room, setRoom] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [tick, setTick] = useState(0);

  const load = async () => {
    const { data: r } = await supabase.from("group_rooms").select("*").eq("id", roomId).single();
    setRoom(r);
    const { data: m } = await supabase.from("group_room_members").select("*").eq("room_id", roomId);
    setMembers(m ?? []);
    const ids = (m ?? []).map((x: any) => x.user_id);
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id, display_name, username, avatar_url").in("id", ids);
      setProfiles(Object.fromEntries((p ?? []).map((x: any) => [x.id, x])));
    }
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_room_members", filter: `room_id=eq.${roomId}` }, () => load())
      .subscribe();
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [roomId]);

  const me = members.find((m) => m.user_id === user?.id);

  const toggle = async () => {
    if (!user) return;
    if (me?.status === "studying") {
      await supabase.from("group_room_members").update({ status: "idle", started_at: null }).eq("room_id", roomId).eq("user_id", user.id);
    } else {
      await supabase.from("group_room_members").upsert({ room_id: roomId, user_id: user.id, status: "studying", started_at: new Date().toISOString() });
    }
    load();
  };

  if (!room) return <div className="p-8">読み込み中...</div>;
  void tick;
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{room.name}</h1>
        <div className="text-sm text-muted-foreground">招待コード: <span className="font-mono">{room.code}</span></div>
      </div>
      <Button size="lg" onClick={toggle} className={me?.status === "studying" ? "bg-red-500 hover:bg-red-600" : ""}>
        {me?.status === "studying" ? <><Square className="h-4 w-4 mr-1" />終了</> : <><Play className="h-4 w-4 mr-1" />勉強開始</>}
      </Button>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {members.map((m) => {
          const p = profiles[m.user_id];
          const elapsed = m.status === "studying" && m.started_at ? Math.floor((Date.now() - new Date(m.started_at).getTime()) / 1000) : 0;
          return (
            <Card key={m.id} className={`p-4 flex items-center gap-3 ${m.status === "studying" ? "ring-2 ring-emerald-500" : ""}`}>
              <Avatar><AvatarImage src={p?.avatar_url ?? undefined} /><AvatarFallback>{(p?.display_name ?? "?").slice(0, 1)}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p?.display_name ?? "?"}</div>
                <div className="text-xs text-muted-foreground">
                  {m.status === "studying" ? `勉強中 ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}` : "待機"}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}