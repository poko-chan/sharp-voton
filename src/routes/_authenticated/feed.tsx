import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { PostComposer, type Draft } from "@/components/feed/PostComposer";
import { PostCard, type FeedPost } from "@/components/feed/PostCard";
import { createSocialPost, listFeedPosts } from "@/lib/social.functions";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => {
    const title = "タイムライン｜StudyΩ — 勉強記録をシェア";
    const description = "StudyΩ のタイムライン。勉強記録を投稿して、いいねやコメントで仲間とモチベーションを高め合えます。";
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
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const loadProfilesAndSocial = async (rows: FeedPost[]) => {
    const ids = rows.map((p) => p.id);
    const uids = [...new Set(rows.map((p) => p.user_id))];
    if (uids.length) {
      const { data: pr } = await (supabase as any).from("profiles").select("id, display_name, username, avatar_url").in("id", uids);
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
    if (append) setLoadingMore(true);
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
      if (append) setLoadingMore(false);
    }
  };

  useEffect(() => { load(0, false); /* eslint-disable-next-line */ }, [scope, user?.id]);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from("organization_members")
      .select("organization:organizations(id, name)").eq("user_id", user.id)
      .then(({ data }: any) => setOrgs((data ?? []).map((m: any) => m.organization).filter(Boolean)));
  }, [user?.id]);

  // 「勉強をシェア！」用：直近7日の勉強記録
  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
      const { data } = await (supabase as any).from("study_logs")
        .select("id, date, duration_minutes, content, subject_id")
        .eq("user_id", user.id).gte("date", since)
        .order("date", { ascending: false }).limit(8);
      const logs = data ?? [];
      const sids = [...new Set(logs.map((l: any) => l.subject_id).filter(Boolean))] as string[];
      let names: Record<string, string> = {};
      if (sids.length) {
        const { data: subs } = await (supabase as any).from("subjects").select("id, name").in("id", sids);
        names = Object.fromEntries((subs ?? []).map((s: any) => [s.id, s.name]));
      }
      setRecentLogs(logs.map((l: any) => ({ ...l, subjectName: names[l.subject_id] ?? "" })));
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
      const { data: pr } = await (supabase as any).from("profiles").select("id, display_name, username").in("id", uids);
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

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" />タイムライン</h1>

      <PostComposer draft={draft} setDraft={setDraft} recentLogs={recentLogs} orgs={orgs} busy={busy} onSubmit={post} />

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={scope === "all" ? "default" : "outline"} onClick={() => setScope("all")}>すべて</Button>
        <Button size="sm" variant={scope === "following" ? "default" : "outline"} onClick={() => setScope("following")}>フォロー中</Button>
        <Button size="sm" variant={scope === "mine" ? "default" : "outline"} onClick={() => setScope("mine")}>自分</Button>
      </div>

      {posts.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">まだ投稿がありません。最初の一件を投稿しよう！</Card>}

      {posts.map((p) => (
        <PostCard
          key={p.id}
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
      ))}

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" disabled={loadingMore} onClick={() => load(page + 1, true)}>
            {loadingMore ? "読み込み中…" : "もっと見る"}
          </Button>
        </div>
      )}
    </div>
  );
}
