import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users, UserPlus, Trophy, UserMinus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/friends")({ component: FriendsPage });

type Profile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };

function FriendsPage() {
  const { user } = useAuth();
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [board, setBoard] = useState<Array<Profile & { minutes: number }>>([]);

  const load = async () => {
    if (!user) return;
    const [{ data: f1 }, { data: f2 }] = await Promise.all([
      supabase.from("follows").select("following_id").eq("follower_id", user.id),
      supabase.from("follows").select("follower_id").eq("following_id", user.id),
    ]);
    const ids1 = (f1 ?? []).map((r: any) => r.following_id);
    const ids2 = (f2 ?? []).map((r: any) => r.follower_id);
    const all = Array.from(new Set([...ids1, ...ids2, user.id]));
    const { data: profs } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", all);
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    setFollowing(ids1.map((id) => map.get(id)).filter(Boolean) as Profile[]);
    setFollowers(ids2.map((id) => map.get(id)).filter(Boolean) as Profile[]);

    // Leaderboard: me + following, last 7d study minutes
    const since = new Date(); since.setDate(since.getDate() - 7);
    const boardIds = [user.id, ...ids1];
    const { data: logs } = await supabase
      .from("study_logs")
      .select("user_id, duration_minutes")
      .in("user_id", boardIds)
      .gte("date", since.toISOString().slice(0, 10));
    const totals = new Map<string, number>();
    for (const r of logs ?? []) totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + (r.duration_minutes ?? 0));
    const rows = boardIds.map((id) => ({ ...(map.get(id) as Profile), minutes: totals.get(id) ?? 0 }));
    rows.sort((a, b) => b.minutes - a.minutes);
    setBoard(rows);
  };

  useEffect(() => { load(); }, [user?.id]);

  const doSearch = async () => {
    if (!search.trim()) return setResults([]);
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
      .limit(20);
    setResults((data ?? []).filter((p: any) => p.id !== user?.id) as Profile[]);
  };

  const follow = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: id, status: "pending" });
    if (error) toast.error(error.message); else { toast.success("リクエストを送りました（相手の承認待ち）"); load(); }
  };
  const unfollow = async (id: string) => {
    if (!user) return;
    await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", id);
    load();
  };
  const accept = async (id: string) => {
    if (!user) return;
    // accept the incoming request
    await supabase.from("follows").update({ status: "accepted" }).eq("follower_id", id).eq("following_id", user.id);
    // ensure reverse direction so they are mutual
    await supabase.from("follows").upsert({ follower_id: user.id, following_id: id, status: "accepted" }, { onConflict: "follower_id,following_id" });
    toast.success("承認しました"); load();
  };
  const reject = async (id: string) => {
    if (!user) return;
    await supabase.from("follows").delete().eq("follower_id", id).eq("following_id", user.id);
    load();
  };

  const followingIds = new Set(following.map((p) => p.id));

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-7 w-7" /><h1 className="text-3xl font-bold">フレンド</h1>
      </div>
      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board"><Trophy className="h-4 w-4 mr-1" />ランキング</TabsTrigger>
          <TabsTrigger value="find"><UserPlus className="h-4 w-4 mr-1" />探す</TabsTrigger>
          <TabsTrigger value="following">フォロー中 ({following.length})</TabsTrigger>
          <TabsTrigger value="followers">フォロワー ({followers.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="board" className="space-y-2 mt-4">
          <p className="text-sm text-muted-foreground">過去7日間の学習時間ランキング</p>
          {board.map((p, i) => (
            <Card key={p.id} className="p-3 flex items-center gap-3">
              <div className="w-8 text-center font-bold text-xl">{i + 1}</div>
              <Avatar><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{(p.display_name ?? "?").slice(0, 1)}</AvatarFallback></Avatar>
              <div className="flex-1">
                <div className="font-medium">{p.display_name ?? p.username}</div>
                <div className="text-xs text-muted-foreground">@{p.username}</div>
              </div>
              <div className="font-mono text-lg">{p.minutes}分</div>
            </Card>
          ))}
          {board.length === 0 && <div className="text-muted-foreground text-sm">フォローするとランキングに表示されます</div>}
        </TabsContent>
        <TabsContent value="find" className="space-y-2 mt-4">
          <div className="flex gap-2">
            <Input placeholder="ユーザー名で検索" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()} />
            <Button onClick={doSearch}>検索</Button>
          </div>
          {results.map((p) => (
            <Card key={p.id} className="p-3 flex items-center gap-3">
              <Avatar><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{(p.display_name ?? "?").slice(0, 1)}</AvatarFallback></Avatar>
              <div className="flex-1"><div className="font-medium">{p.display_name}</div><div className="text-xs text-muted-foreground">@{p.username}</div></div>
              {followingIds.has(p.id)
                ? <Button size="sm" variant="outline" onClick={() => unfollow(p.id)}><UserMinus className="h-4 w-4 mr-1" />解除</Button>
                : <Button size="sm" onClick={() => follow(p.id)}><UserPlus className="h-4 w-4 mr-1" />フォロー</Button>}
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="following" className="space-y-2 mt-4">
          {following.map((p) => (
            <Card key={p.id} className="p-3 flex items-center gap-3">
              <Avatar><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{(p.display_name ?? "?").slice(0, 1)}</AvatarFallback></Avatar>
              <div className="flex-1"><div className="font-medium">{p.display_name}</div><div className="text-xs text-muted-foreground">@{p.username}</div></div>
              <Button size="sm" variant="outline" onClick={() => unfollow(p.id)}>解除</Button>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="followers" className="space-y-2 mt-4">
          {followers.map((p) => (
            <Card key={p.id} className="p-3 flex items-center gap-3">
              <Avatar><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{(p.display_name ?? "?").slice(0, 1)}</AvatarFallback></Avatar>
              <div className="flex-1"><div className="font-medium">{p.display_name}</div><div className="text-xs text-muted-foreground">@{p.username}</div></div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}