import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Users, UserPlus, Trophy, UserMinus, Coins, Gift, Search, Heart,
  MessageCircle, Inbox, Send, ShieldOff, ShieldCheck, Clock,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/friends")({ component: FriendsPage });

type Profile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
type Stats = { minutes7d: number };

function initials(p: Profile | null) {
  return (p?.display_name ?? p?.username ?? "?").slice(0, 1);
}

function FriendsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [incomingPending, setIncomingPending] = useState<Profile[]>([]);
  const [outgoingPending, setOutgoingPending] = useState<Profile[]>([]);
  const [blocked, setBlocked] = useState<Profile[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [board, setBoard] = useState<Array<Profile & { minutes: number }>>([]);
  const [giftTarget, setGiftTarget] = useState<Profile | null>(null);
  const [giftAmount, setGiftAmount] = useState(10);
  const [giftMsg, setGiftMsg] = useState("");
  const [profileTarget, setProfileTarget] = useState<Profile | null>(null);
  const [tab, setTab] = useState("friends");

  const sendGift = async () => {
    if (!giftTarget) return;
    const { error } = await (supabase as any).rpc("send_coin_gift", { _to: giftTarget.id, _amount: giftAmount, _message: giftMsg });
    if (error) return toast.error(error.message);
    toast.success(`${giftAmount}コインを送りました`);
    setGiftTarget(null); setGiftMsg("");
  };

  const load = async () => {
    if (!user) return;
    const [{ data: f1 }, { data: f2 }] = await Promise.all([
      supabase.from("follows").select("following_id, status").eq("follower_id", user.id),
      supabase.from("follows").select("follower_id, status").eq("following_id", user.id),
    ]);
    const ids1 = (f1 ?? []).filter((r: any) => r.status === "accepted").map((r: any) => r.following_id);
    const ids1Pending = (f1 ?? []).filter((r: any) => r.status === "pending").map((r: any) => r.following_id);
    const ids1Blocked = (f1 ?? []).filter((r: any) => r.status === "blocked").map((r: any) => r.following_id);
    const ids2 = (f2 ?? []).filter((r: any) => r.status === "accepted").map((r: any) => r.follower_id);
    const ids2Pending = (f2 ?? []).filter((r: any) => r.status === "pending").map((r: any) => r.follower_id);
    const all = Array.from(new Set([...ids1, ...ids2, ...ids1Pending, ...ids2Pending, ...ids1Blocked, user.id]));
    const { data: profs } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", all);
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    setFollowing(ids1.map((id) => map.get(id)).filter(Boolean) as Profile[]);
    setFollowers(ids2.map((id) => map.get(id)).filter(Boolean) as Profile[]);
    setIncomingPending(ids2Pending.map((id) => map.get(id)).filter(Boolean) as Profile[]);
    setOutgoingPending(ids1Pending.map((id) => map.get(id)).filter(Boolean) as Profile[]);
    setBlocked(ids1Blocked.map((id) => map.get(id)).filter(Boolean) as Profile[]);

    // Leaderboard + per-friend stats: me + following, last 7d study minutes
    const since = new Date(); since.setDate(since.getDate() - 7);
    const boardIds = Array.from(new Set([user.id, ...ids1, ...ids2]));
    const { data: logs } = await supabase
      .from("study_logs")
      .select("user_id, duration_minutes")
      .in("user_id", boardIds)
      .gte("date", since.toISOString().slice(0, 10));
    const totals = new Map<string, number>();
    for (const r of logs ?? []) totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + (r.duration_minutes ?? 0));
    const statsMap: Record<string, Stats> = {};
    for (const id of boardIds) statsMap[id] = { minutes7d: totals.get(id) ?? 0 };
    setStats(statsMap);
    const rows = [user.id, ...ids1].map((id) => ({ ...(map.get(id) as Profile), minutes: totals.get(id) ?? 0 }));
    rows.sort((a, b) => b.minutes - a.minutes);
    setBoard(rows);
  };

  useEffect(() => { load(); }, [user?.id]);

  const doSearch = async () => {
    if (!search.trim()) { setResults(null); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
      .limit(20);
    setResults((data ?? []).filter((p: any) => p.id !== user?.id) as Profile[]);
    setSearching(false);
  };

  const follow = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("follows").upsert(
      { follower_id: user.id, following_id: id, status: "pending" },
      { onConflict: "follower_id,following_id" }
    );
    if (error) toast.error(error.message); else { toast.success("リクエストを送りました（相手の承認待ち）"); load(); }
  };
  const unfollow = async (id: string, silent = false) => {
    if (!user) return;
    const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", id);
    if (error) return toast.error(error.message);
    if (!silent) toast.success("フォローを解除しました");
    load();
  };
  const accept = async (id: string) => {
    if (!user) return;
    await supabase.from("follows").update({ status: "accepted" }).eq("follower_id", id).eq("following_id", user.id);
    await supabase.from("follows").upsert({ follower_id: user.id, following_id: id, status: "accepted" }, { onConflict: "follower_id,following_id" });
    toast.success("フレンドリクエストを承認しました"); load();
  };
  const reject = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("follows").delete().eq("follower_id", id).eq("following_id", user.id);
    if (error) return toast.error(error.message);
    toast.success("リクエストを拒否しました");
    load();
  };
  const cancelOutgoing = async (id: string) => {
    await unfollow(id, true);
    toast.success("リクエストを取り消しました");
  };
  const block = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("follows").upsert(
      { follower_id: user.id, following_id: id, status: "blocked" },
      { onConflict: "follower_id,following_id" }
    );
    if (error) return toast.error(error.message);
    // remove their follow on us too, so they no longer see us as a friend
    await supabase.from("follows").delete().eq("follower_id", id).eq("following_id", user.id);
    toast.success("ブロックしました");
    load();
  };
  const unblock = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", id);
    if (error) return toast.error(error.message);
    toast.success("ブロックを解除しました");
    load();
  };

  const openDm = (p: Profile) => {
    navigate({ to: "/chat" });
    toast.success(`${p.display_name ?? p.username ?? "相手"}とのDMを開くには、チャット一覧から選択してください`);
  };

  const followingIds = useMemo(() => new Set(following.map((p) => p.id)), [following]);
  const followerIds = useMemo(() => new Set(followers.map((p) => p.id)), [followers]);
  const outgoingIds = useMemo(() => new Set(outgoingPending.map((p) => p.id)), [outgoingPending]);
  const blockedIds = useMemo(() => new Set(blocked.map((p) => p.id)), [blocked]);
  const mutualFriends = useMemo(() => following.filter((p) => followerIds.has(p.id)), [following, followerIds]);

  const searchResults = useMemo(() => {
    if (!results) return null;
    return results.filter((p) => !blockedIds.has(p.id));
  }, [results, blockedIds]);

  const relationBadge = (p: Profile) => {
    if (mutualFriends.some((m) => m.id === p.id)) return <Badge className="bg-pink-500/10 text-pink-600 border-pink-500/20"><Heart className="h-3 w-3 mr-1" />フレンド</Badge>;
    if (followingIds.has(p.id)) return <Badge variant="secondary">フォロー中</Badge>;
    if (outgoingIds.has(p.id)) return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />承認待ち</Badge>;
    if (followerIds.has(p.id)) return <Badge variant="outline">フォロワー</Badge>;
    return null;
  };

  const StatLine = ({ id }: { id: string }) => {
    const s = stats[id];
    if (!s) return null;
    return <div className="text-[11px] text-muted-foreground">今週の学習: <b className="text-foreground">{s.minutes7d}分</b></div>;
  };

  const FriendActions = ({ p, mutual }: { p: Profile; mutual: boolean }) => (
    <div className="flex flex-wrap items-center gap-1.5">
      {mutual && (
        <>
          <Button size="sm" variant="outline" onClick={() => openDm(p)}><MessageCircle className="h-4 w-4 mr-1" />DMを開く</Button>
          <Button size="sm" variant="outline" onClick={() => setGiftTarget(p)}><Gift className="h-4 w-4 mr-1" />コイン</Button>
        </>
      )}
      <Button size="sm" variant="ghost" onClick={() => setProfileTarget(p)}>プロフィール</Button>
      {followingIds.has(p.id) && (
        <Button size="sm" variant="outline" onClick={() => unfollow(p.id)}><UserMinus className="h-4 w-4 mr-1" />解除</Button>
      )}
      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => block(p.id)}>
        <ShieldOff className="h-4 w-4 mr-1" />ブロック
      </Button>
    </div>
  );

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-7 w-7" /><h1 className="text-3xl font-bold">フレンド</h1>
      </div>

      <Card className="p-4 space-y-2">
        <div className="font-semibold flex items-center gap-1.5"><Trophy className="h-4 w-4" />学習ランキング（過去7日・フォロー中）</div>
        {board.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 py-1">
            <div className="w-6 text-center font-bold">{i + 1}</div>
            <Avatar className="h-7 w-7"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{initials(p)}</AvatarFallback></Avatar>
            <div className="flex-1 text-sm">{p.display_name ?? p.username}</div>
            <div className="font-mono text-sm">{p.minutes}分</div>
          </div>
        ))}
        {board.length === 0 && <div className="text-muted-foreground text-sm">フォローするとランキングに表示されます</div>}
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="friends"><Heart className="h-4 w-4 mr-1" />フレンド ({mutualFriends.length})</TabsTrigger>
          <TabsTrigger value="incoming"><Inbox className="h-4 w-4 mr-1" />申請が来ている ({incomingPending.length})</TabsTrigger>
          <TabsTrigger value="outgoing"><Send className="h-4 w-4 mr-1" />申請中 ({outgoingPending.length})</TabsTrigger>
          <TabsTrigger value="search"><Search className="h-4 w-4 mr-1" />さがす</TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-2 mt-4">
          {mutualFriends.map((p) => (
            <Card key={p.id} className="p-3 flex flex-wrap items-center gap-3">
              <Avatar><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{initials(p)}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-[140px]">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{p.display_name}</div>
                  {relationBadge(p)}
                </div>
                <div className="text-xs text-muted-foreground">@{p.username}</div>
                <StatLine id={p.id} />
              </div>
              <FriendActions p={p} mutual />
            </Card>
          ))}
          {mutualFriends.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              相互フォローのフレンドはまだいません。「さがす」タブからユーザーを探してリクエストを送ってみましょう。
            </Card>
          )}
        </TabsContent>

        <TabsContent value="incoming" className="space-y-2 mt-4">
          {incomingPending.map((p) => (
            <Card key={p.id} className="p-3 flex flex-wrap items-center gap-3">
              <Avatar><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{initials(p)}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-[140px]">
                <div className="font-medium">{p.display_name}</div>
                <div className="text-xs text-muted-foreground">@{p.username}</div>
              </div>
              <Button size="sm" onClick={() => accept(p.id)}><ShieldCheck className="h-4 w-4 mr-1" />承認</Button>
              <Button size="sm" variant="outline" onClick={() => reject(p.id)}>拒否</Button>
            </Card>
          ))}
          {incomingPending.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">あなた宛のフレンドリクエストはありません</Card>
          )}
        </TabsContent>

        <TabsContent value="outgoing" className="space-y-2 mt-4">
          {outgoingPending.map((p) => (
            <Card key={p.id} className="p-3 flex flex-wrap items-center gap-3">
              <Avatar><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{initials(p)}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-[140px]">
                <div className="font-medium">{p.display_name}</div>
                <div className="text-xs text-muted-foreground">@{p.username}</div>
              </div>
              <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />承認待ち</Badge>
              <Button size="sm" variant="outline" onClick={() => cancelOutgoing(p.id)}>取消</Button>
            </Card>
          ))}
          {outgoingPending.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">送信中のリクエストはありません</Card>
          )}
        </TabsContent>

        <TabsContent value="search" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input placeholder="ユーザー名または表示名で検索" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()} />
            <Button onClick={doSearch} disabled={searching}><Search className="h-4 w-4 mr-1" />検索</Button>
          </div>
          <div className="space-y-2">
            {searchResults === null && (
              <div className="text-sm text-muted-foreground">キーワードを入力して検索してください</div>
            )}
            {searchResults?.map((p) => (
              <Card key={p.id} className="p-3 flex flex-wrap items-center gap-3">
                <Avatar><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{initials(p)}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-[140px]">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{p.display_name}</div>
                    {relationBadge(p)}
                  </div>
                  <div className="text-xs text-muted-foreground">@{p.username}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setProfileTarget(p)}>プロフィール</Button>
                {followingIds.has(p.id)
                  ? <Button size="sm" variant="outline" onClick={() => unfollow(p.id)}><UserMinus className="h-4 w-4 mr-1" />解除</Button>
                  : outgoingIds.has(p.id)
                    ? <Button size="sm" variant="outline" disabled>承認待ち</Button>
                    : <Button size="sm" onClick={() => follow(p.id)}><UserPlus className="h-4 w-4 mr-1" />フォロー</Button>}
              </Card>
            ))}
            {searchResults && searchResults.length === 0 && (
              <Card className="p-8 text-center text-sm text-muted-foreground">該当するユーザーが見つかりませんでした</Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {blocked.length > 0 && (
        <Card className="p-4 space-y-2">
          <div className="font-semibold flex items-center gap-1.5"><ShieldOff className="h-4 w-4" />ブロック中のユーザー</div>
          {blocked.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-1">
              <Avatar className="h-7 w-7"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{initials(p)}</AvatarFallback></Avatar>
              <div className="flex-1 text-sm">{p.display_name ?? p.username}</div>
              <Button size="sm" variant="outline" onClick={() => unblock(p.id)}>解除</Button>
            </div>
          ))}
        </Card>
      )}

      <Dialog open={!!giftTarget} onOpenChange={(v) => !v && setGiftTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{giftTarget?.display_name} にコインを贈る</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs">金額 (最低10コイン)</label>
              <Input type="number" min={10} max={500} value={giftAmount} onChange={(e) => setGiftAmount(Math.max(10, Number(e.target.value) || 10))} />
              <div className="text-[11px] text-amber-600 mt-1">
                税 (10%): <b>{Math.ceil(giftAmount * 0.1)}</b> コイン ／ 相手が受け取る: <b>{giftAmount - Math.ceil(giftAmount * 0.1)}</b> コイン
              </div>
            </div>
            <div>
              <label className="text-xs">メッセージ (任意)</label>
              <Input value={giftMsg} onChange={(e) => setGiftMsg(e.target.value)} placeholder="ありがとう！" />
            </div>
            <div className="text-[11px] text-muted-foreground">
              ※ 相互フォローのみ送付可能 ／ 1日最大3回・合計500コインまで ／ アカウント作成から24h以降に解放
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGiftTarget(null)}>キャンセル</Button>
            <Button onClick={sendGift}><Coins className="h-4 w-4 mr-1" />送る</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!profileTarget} onOpenChange={(v) => !v && setProfileTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>プロフィール</DialogTitle></DialogHeader>
          {profileTarget && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14"><AvatarImage src={profileTarget.avatar_url ?? undefined} /><AvatarFallback>{initials(profileTarget)}</AvatarFallback></Avatar>
                <div>
                  <div className="text-lg font-bold">{profileTarget.display_name}</div>
                  <div className="text-sm text-muted-foreground">@{profileTarget.username}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">{relationBadge(profileTarget)}</div>
              <Card className="p-3 text-sm">
                今週の学習時間: <b>{stats[profileTarget.id]?.minutes7d ?? 0}分</b>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProfileTarget(null)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
