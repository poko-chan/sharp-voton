import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Users, Trophy, HandHeart, Sparkles, Plus, LogIn } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const db = supabase as any;

function weekStart(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

const CHEERS = ["👏", "🔥", "💪", "🌟", "☕"];

type Member = { user_id: string; minutes: number; focus_until: string | null };
type Room = { id: string; name: string; join_code: string; host_id: string; status: string };

function TogetherPage() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const ws = useMemo(() => weekStart(), []);

  const [names, setNames] = useState<Record<string, string>>({});
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [ranking, setRanking] = useState<{ user_id: string; minutes: number }[]>([]);
  const [target, setTarget] = useState(300);
  const [note, setNote] = useState("");
  const [logs, setLogs] = useState<{ date: string; start_time: string | null; duration_minutes: number }[]>([]);

  const loadNames = async (ids: string[]) => {
    const missing = ids.filter((i) => i && !names[i]);
    if (!missing.length) return;
    const { data } = await db.from("profiles").select("id,display_name").in("id", missing);
    if (data) {
      setNames((p) => {
        const n = { ...p };
        for (const r of data) n[r.id] = r.display_name ?? "名無し";
        return n;
      });
    }
  };

  const loadRoom = async () => {
    const { data: mine } = await db
      .from("fr_room_members")
      .select("room_id")
      .eq("user_id", uid)
      .order("joined_at", { ascending: false })
      .limit(1);
    const rid = mine?.[0]?.room_id;
    if (!rid) {
      setRoom(null);
      setMembers([]);
      return;
    }
    const { data: r } = await db.from("fr_rooms").select("*").eq("id", rid).maybeSingle();
    if (!r || r.status !== "open") {
      setRoom(null);
      setMembers([]);
      return;
    }
    setRoom(r);
    const { data: ms } = await db
      .from("fr_room_members")
      .select("user_id,minutes,focus_until")
      .eq("room_id", rid);
    setMembers(ms ?? []);
    await loadNames((ms ?? []).map((m: Member) => m.user_id));
  };

  useEffect(() => {
    if (!uid) return;
    (async () => {
      await loadRoom();
      const { data: rank } = await db.rpc("friend_weekly_ranking", { _week_start: ws });
      setRanking(rank ?? []);
      await loadNames((rank ?? []).map((r: any) => r.user_id));
      const { data: p } = await db
        .from("fr_pledges")
        .select("*")
        .eq("user_id", uid)
        .eq("week_start", ws)
        .maybeSingle();
      if (p) {
        setTarget(p.target_minutes);
        setNote(p.note ?? "");
      }
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const { data: l } = await db
        .from("study_logs")
        .select("date,start_time,duration_minutes")
        .eq("user_id", uid)
        .gte("date", from.toISOString().slice(0, 10));
      setLogs(l ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const createRoom = async () => {
    if (!roomName.trim()) return;
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data, error } = await db
      .from("fr_rooms")
      .insert({ host_id: uid, name: roomName.trim(), join_code: code })
      .select()
      .maybeSingle();
    if (error) return toast.error(error.message);
    await db.from("fr_room_members").insert({ room_id: data.id, user_id: uid });
    setRoomName("");
    toast.success(`ルームを作成しました（コード: ${code}）`);
    loadRoom();
  };

  const join = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    const { data: r } = await db
      .from("fr_rooms")
      .select("id")
      .eq("join_code", code)
      .eq("status", "open")
      .maybeSingle();
    if (!r) return toast.error("そのコードのルームは見つかりませんでした");
    const { error } = await db
      .from("fr_room_members")
      .upsert({ room_id: r.id, user_id: uid }, { onConflict: "room_id,user_id" });
    if (error) return toast.error(error.message);
    setJoinCode("");
    loadRoom();
  };

  const leave = async () => {
    if (!room) return;
    await db.from("fr_room_members").delete().eq("room_id", room.id).eq("user_id", uid);
    if (room.host_id === uid) await db.from("fr_rooms").update({ status: "closed" }).eq("id", room.id);
    loadRoom();
  };

  const addMinutes = async (n: number) => {
    if (!room) return;
    const me = members.find((m) => m.user_id === uid);
    const next = Math.max(0, (me?.minutes ?? 0) + n);
    await db
      .from("fr_room_members")
      .update({ minutes: next })
      .eq("room_id", room.id)
      .eq("user_id", uid);
    loadRoom();
  };

  const cheer = async (to: string, emoji: string) => {
    if (to === uid) return;
    const { error } = await db.from("fr_cheers").insert({ from_user: uid, to_user: to, emoji });
    if (error) return toast.error(error.message);
    toast.success("応援を送りました");
  };

  const savePledge = async () => {
    const { error } = await db
      .from("fr_pledges")
      .upsert(
        { user_id: uid, week_start: ws, target_minutes: target, note },
        { onConflict: "user_id,week_start" },
      );
    if (error) return toast.error(error.message);
    toast.success("今週の約束を保存しました");
  };

  // 学習タイプ診断（記録の集計のみ。AIは使いません）
  const diagnosis = useMemo(() => {
    if (!logs.length) return null;
    let morning = 0;
    let night = 0;
    let total = 0;
    const perDay: Record<string, number> = {};
    for (const l of logs) {
      const m = l.duration_minutes ?? 0;
      total += m;
      perDay[l.date] = (perDay[l.date] ?? 0) + m;
      const h = Number((l.start_time ?? "12:00").slice(0, 2));
      if (h < 12) morning += m;
      else if (h >= 18) night += m;
    }
    const days = Object.keys(perDay).length || 1;
    const avgSession = Math.round(total / logs.length);
    const type =
      morning > night * 1.2 ? "朝型" : night > morning * 1.2 ? "夜型" : "バランス型";
    const style =
      avgSession >= 60 ? "長時間集中タイプ" : avgSession <= 25 ? "こまぎれ学習タイプ" : "標準ペース";
    const consistency = Math.round((days / 30) * 100);
    return { type, style, avgSession, consistency, days, total };
  }, [logs]);

  const me = members.find((m) => m.user_id === uid);
  const mineRank = ranking.find((r) => r.user_id === uid);

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">みんなで勉強</h1>
        <p className="text-sm text-muted-foreground">
          フレンドと同時に勉強したり、週の目標を約束したり、応援を送り合えます。
        </p>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> 一緒に勉強（ルーム）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!room ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-2">
                <Input
                  placeholder="ルーム名"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
                <Button onClick={createRoom} className="gap-1 shrink-0">
                  <Plus className="h-4 w-4" />
                  作成
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="参加コード"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
                <Button variant="secondary" onClick={join} className="gap-1 shrink-0">
                  <LogIn className="h-4 w-4" />
                  参加
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{room.name}</span>
                <Badge variant="secondary">コード {room.join_code}</Badge>
                <Button size="sm" variant="ghost" onClick={leave} className="ml-auto">
                  退出
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>自分の記録: {me?.minutes ?? 0}分</span>
                <Button size="sm" variant="outline" onClick={() => addMinutes(25)}>
                  +25分
                </Button>
                <Button size="sm" variant="outline" onClick={() => addMinutes(5)}>
                  +5分
                </Button>
              </div>
              <ul className="divide-y rounded-md border">
                {members
                  .slice()
                  .sort((a, b) => b.minutes - a.minutes)
                  .map((m) => (
                    <li key={m.user_id} className="flex items-center gap-2 p-2 text-sm">
                      <span className="flex-1 truncate">{names[m.user_id] ?? "..."}</span>
                      <span className="text-muted-foreground">{m.minutes}分</span>
                      {m.user_id !== uid && (
                        <span className="flex gap-1">
                          {CHEERS.map((c) => (
                            <button
                              key={c}
                              onClick={() => cheer(m.user_id, c)}
                              className="rounded px-1 hover:bg-accent"
                            >
                              {c}
                            </button>
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" /> 今週の対決
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ranking.length === 0 && (
              <p className="text-sm text-muted-foreground">
                相互フォローのフレンドができると、今週の勉強時間を比べられます。
              </p>
            )}
            <ol className="space-y-1 text-sm">
              {ranking.map((r, i) => (
                <li
                  key={r.user_id}
                  className={`flex items-center gap-2 rounded px-2 py-1 ${
                    r.user_id === uid ? "bg-primary/10 font-medium" : ""
                  }`}
                >
                  <span className="w-5 text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{names[r.user_id] ?? "..."}</span>
                  <span>{r.minutes}分</span>
                  {r.user_id !== uid && (
                    <button onClick={() => cheer(r.user_id, "👏")} className="hover:opacity-70">
                      👏
                    </button>
                  )}
                </li>
              ))}
            </ol>
            {mineRank && (
              <p className="text-xs text-muted-foreground">
                あなたは今週 {mineRank.minutes} 分勉強しています。
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HandHeart className="h-4 w-4" /> 今週の約束
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">目標の勉強時間（分）</Label>
              <Input
                type="number"
                min={30}
                step={30}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value) || 30)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ひとこと</Label>
              <Input
                value={note}
                placeholder="今週は英単語を毎日！"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Button onClick={savePledge} className="w-full">
              フレンドに宣言する
            </Button>
            {mineRank && (
              <p className="text-xs text-muted-foreground">
                達成状況: {mineRank.minutes} / {target} 分（
                {Math.min(100, Math.round((mineRank.minutes / Math.max(1, target)) * 100))}%）
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" /> 学習タイプ診断
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!diagnosis ? (
            <p className="text-sm text-muted-foreground">
              勉強記録がたまると、あなたの学習タイプを表示します。
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">時間帯</div>
                <div className="text-lg font-bold">{diagnosis.type}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">集中の長さ</div>
                <div className="text-lg font-bold">{diagnosis.style}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">1回あたり平均</div>
                <div className="text-lg font-bold">{diagnosis.avgSession}分</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">30日の継続率</div>
                <div className="text-lg font-bold">{diagnosis.consistency}%</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/together")({
  head: () => ({
    meta: [
      { title: "みんなで勉強｜Study#" },
      {
        name: "description",
        content: "フレンドと一緒に勉強するルーム、週間対決、応援スタンプ、学習タイプ診断。",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: TogetherPage,
});
