import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users, Search, PlusCircle, Rows3, LayoutList, Flame, Clock, BookOpen, X } from "lucide-react";
import { toast } from "sonner";
import { PostComposer, type Draft } from "@/components/feed/PostComposer";
import { PostCard, type FeedPost } from "@/components/feed/PostCard";
import { createSocialPost, listFeedPosts } from "@/lib/social.functions";
import { fetchPublicProfiles } from "@/lib/public-profiles";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => {
    const title = "タイムライン｜Study# — 勉強記録をシェア";
    const description = "Study# のタイムライン。勉強記録を投稿して、いいねやコメントで仲間とモチベーションを高め合えます。";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: FeedPage,
});

type Scope = "all" | "following" | "mine";
type SortMode = "new" | "popular";

function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [likes, setLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Draft>({ body: "", minutes: "", subject: "", org: "none", visibility: "public" });
  const [orgs, setOrgs] = useState<any[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [sortMode, setSortMode] = useState<SortMode>("new");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [compact, setCompact] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [topSubjects, setTopSubjects] = useState<Array<{ name: string; minutes: number }>>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadProfilesAndSocial = async (rows: FeedPost[]) => {
    const ids = rows.map((p) => p.id);
    const uids = [...new Set(rows.map((p) => p.user_id))];
    if (uids.length) {
      const pr = await fetchPublicProfiles(uids);
      setProfiles((prev) => ({ ...prev, ...Object.fromEntries((pr ?? []).map((p: any) => [p.id, p])) }));
    }
    if (ids.length) {
      const { data: lk } = await (supabase as any).from("social_likes").select("post_id, user_id").in("post_id", ids);
      setLikes((prev) => {
        const map = { ...prev };
        for (const id of ids) map[id] = { count: 0, mine: false };
        for (const l of lk ?? []) {
          map[l.post_id].count++;
          if (l.user_id === user?.id) map[l.post_id].mine = true;
        }
        return map;
      });
    }
  };

  const load = async (targetPage = 0, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await listFeedPosts({ data: { scope, page: targetPage } });
      const rows = res.posts as FeedPost[];
      setPosts((prev) => (append ? [...prev, ...rows] : rows));
      setHasMore(res.hasMore);
      setPage(targetPage);
      await loadProfilesAndSocial(rows);
    } catch (e: any) {
      toast.error(e.message ?? "読み込みに失敗しました");
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  };

  useEffect(() => { load(0, false); /* eslint-disable-next-line */ }, [scope, user?.id]);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from("organization_members")
      .select("organization:organizations(id, name)").eq("user_id", user.id)
      .then(({ data }: any) => setOrgs((data ?? []).map((m: any) => m.organization).filter(Boolean)));
  }, [user?.id]);

  // 「勉強をシェア！」用：直近7日の勉強記録 ＋ サマリー（今週の学習時間・よく使う教科）
  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
      const { data } = await (supabase as any).from("study_logs")
        .select("id, date, duration_minutes, content, subject_id")
        .eq("user_id", user.id).gte("date", since)
        .order("date", { ascending: false }).limit(50);
      const logs = data ?? [];
      const sids = [...new Set(logs.map((l: any) => l.subject_id).filter(Boolean))] as string[];
      let names: Record<string, string> = {};
      if (sids.length) {
        const { data: subs } = await (supabase as any).from("subjects").select("id, name").in("id", sids);
        names = Object.fromEntries((subs ?? []).map((s: any) => [s.id, s.name]));
      }
      const withNames = logs.map((l: any) => ({ ...l, subjectName: names[l.subject_id] ?? "" }));
      setRecentLogs(withNames.slice(0, 8));
      setWeekMinutes(withNames.reduce((sum: number, l: any) => sum + (l.duration_minutes ?? 0), 0));
      const bySubject = new Map<string, number>();
      for (const l of withNames) {
        const key = l.subjectName || "その他";
        bySubject.set(key, (bySubject.get(key) ?? 0) + (l.duration_minutes ?? 0));
      }
      setTopSubjects(Array.from(bySubject.entries()).map(([name, minutes]) => ({ name, minutes })).sort((a, b) => b.minutes - a.minutes).slice(0, 5));
    })();
  }, [user?.id]);

  const post = async () => {
    if (!draft.body.trim() || !user) return;
    setBusy(true);
    try {
      await createSocialPost({
        data: {
          body: draft.body,
          minutes: draft.minutes ? Number(draft.minutes) : null,
          subject: draft.subject || null,
          organizationId: draft.org === "none" ? null : draft.org,
          visibility: draft.visibility,
        },
      });
      setDraft({ body: "", minutes: "", subject: "", org: draft.org, visibility: draft.visibility });
      toast.success("投稿しました");
      setComposerOpen(false);
      load(0, false);
    } catch (e: any) {
      toast.error(e.message ?? "投稿に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const toggleLike = async (id: string) => {
    if (!user) return;
    const cur = likes[id];
    setLikes({ ...likes, [id]: { count: (cur?.count ?? 0) + (cur?.mine ? -1 : 1), mine: !cur?.mine } });
    if (cur?.mine) await (supabase as any).from("social_likes").delete().eq("post_id", id).eq("user_id", user.id);
    else await (supabase as any).from("social_likes").insert({ post_id: id, user_id: user.id });
  };

  const loadComments = async (id: string) => {
    const { data } = await (supabase as any).from("social_comments").select("*").eq("post_id", id).order("created_at");
    const uids = [...new Set((data ?? []).map((c: any) => c.user_id))] as string[];
    if (uids.length) {
      const pr = await fetchPublicProfiles(uids);
      setProfiles((prev) => ({ ...prev, ...Object.fromEntries((pr ?? []).map((p: any) => [p.id, p])) }));
    }
    setComments((c) => ({ ...c, [id]: data ?? [] }));
  };

  const toggleComments = (id: string) => {
    const next = !openComments[id];
    setOpenComments({ ...openComments, [id]: next });
    if (next && !comments[id]) loadComments(id);
  };

  const addComment = async (id: string, body: string) => {
    if (!body.trim() || !user) return;
    const { error } = await (supabase as any).from("social_comments").insert({ post_id: id, user_id: user.id, body: body.trim() });
    if (error) return toast.error(error.message);
    loadComments(id);
  };

  const del = async (id: string) => {
    const { error } = await (supabase as any).from("social_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setPosts((p) => p.filter((x) => x.id !== id));
  };

  const name = (uid: string) => profiles[uid]?.display_name || profiles[uid]?.username || "名無し";

  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of posts) if (p.subject) set.add(p.subject);
    return Array.from(set);
  }, [posts]);

  const visiblePosts = useMemo(() => {
    let rows = posts;
    if (subjectFilter !== "all") rows = rows.filter((p) => p.subject === subjectFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((p) => p.body.toLowerCase().includes(q) || (p.subject ?? "").toLowerCase().includes(q) || name(p.user_id).toLowerCase().includes(q));
    }
    if (sortMode === "popular") {
      rows = [...rows].sort((a, b) => (likes[b.id]?.count ?? 0) - (likes[a.id]?.count ?? 0));
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, subjectFilter, query, sortMode, likes, profiles]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    load(page + 1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, hasMore, page, scope]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-6">
        <div className="min-w-0 space-y-4">
          <div className="sticky top-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background/95 backdrop-blur border-b space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 shrink-0"><Users className="h-6 w-6 text-primary" />タイムライン</h1>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant={compact ? "outline" : "default"}
                  onClick={() => setCompact(false)}
                  title="ゆったり表示"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={compact ? "default" : "outline"}
                  onClick={() => setCompact(true)}
                  title="コンパクト表示"
                >
                  <Rows3 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="投稿・教科・投稿者を検索"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setQuery("")}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button onClick={() => setComposerOpen((v) => !v)} className="shrink-0">
                <PlusCircle className="h-4 w-4 mr-1" />勉強記録を共有
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1.5 flex-wrap">
                <Button size="sm" variant={scope === "all" ? "default" : "outline"} onClick={() => setScope("all")}>すべて</Button>
                <Button size="sm" variant={scope === "following" ? "default" : "outline"} onClick={() => setScope("following")}>フレンド</Button>
                <Button size="sm" variant={scope === "mine" ? "default" : "outline"} onClick={() => setScope("mine")}>自分</Button>
              </div>
              {subjectOptions.length > 0 && (
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="教科別" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">教科：すべて</SelectItem>
                    {subjectOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" variant={sortMode === "new" ? "default" : "outline"} onClick={() => setSortMode("new")}><Clock className="h-3.5 w-3.5 mr-1" />新着</Button>
                <Button size="sm" variant={sortMode === "popular" ? "default" : "outline"} onClick={() => setSortMode("popular")}><Flame className="h-3.5 w-3.5 mr-1" />人気</Button>
              </div>
            </div>
          </div>

          {composerOpen && (
            <PostComposer draft={draft} setDraft={setDraft} recentLogs={recentLogs} orgs={orgs} busy={busy} onSubmit={post} />
          )}

          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </Card>
              ))}
            </div>
          )}

          {!loading && visiblePosts.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {query || subjectFilter !== "all" ? "条件に一致する投稿がありません" : "まだ投稿がありません。最初の一件を投稿しよう！"}
            </Card>
          )}

          <div className={compact ? "space-y-2" : "space-y-4"}>
            {visiblePosts.map((p) => (
              <div key={p.id} className={compact ? "[&_p]:text-sm [&_.p-4]:p-3" : undefined}>
                <PostCard
                  post={p}
                  name={name}
                  isMine={p.user_id === user?.id}
                  like={likes[p.id]}
                  onToggleLike={() => toggleLike(p.id)}
                  onToggleComments={() => toggleComments(p.id)}
                  commentsOpen={!!openComments[p.id]}
                  comments={comments[p.id]}
                  onAddComment={(body) => addComment(p.id, body)}
                  onDelete={() => del(p.id)}
                />
              </div>
            ))}
          </div>

          <div ref={sentinelRef} />
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" disabled={loadingMore} onClick={() => load(page + 1, true)}>
                {loadingMore ? "読み込み中…" : "もっと読む"}
              </Button>
            </div>
          )}
        </div>

        <aside className="hidden lg:block space-y-4">
          <Card className="p-4 space-y-2 sticky top-4">
            <div className="font-semibold text-sm flex items-center gap-1.5"><Flame className="h-4 w-4 text-primary" />今週の自分</div>
            <div className="text-2xl font-bold">{weekMinutes}<span className="text-sm font-normal text-muted-foreground ml-1">分</span></div>
            <div className="text-[11px] text-muted-foreground">過去7日間の学習時間</div>
          </Card>
          <Card className="p-4 space-y-2">
            <div className="font-semibold text-sm flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-primary" />よく使う教科</div>
            {topSubjects.length === 0 && <div className="text-xs text-muted-foreground">記録がまだありません</div>}
            {topSubjects.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <Badge variant="secondary" className="font-normal">{s.name}</Badge>
                <span className="text-muted-foreground">{s.minutes}分</span>
              </div>
            ))}
          </Card>
        </aside>
      </div>
    </div>
  );
}
