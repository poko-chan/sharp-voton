import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, MessageCircle, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => {
    const title = "タイムライン｜Study+ — 勉強記録をシェア";
    const description = "Study+ のタイムライン。勉強記録を投稿して、いいねやコメントで仲間とモチベーションを高め合えます。";
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

type Post = {
  id: string; user_id: string; body: string; minutes: number | null; subject: string | null;
  organization_id: string | null; created_at: string;
};

function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [likes, setLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState({ body: "", minutes: "", subject: "", org: "none" });
  const [orgs, setOrgs] = useState<any[]>([]);
  const [scope, setScope] = useState<string>("all");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    let q = (supabase as any).from("social_posts").select("*").order("created_at", { ascending: false }).limit(60);
    if (scope === "all") q = q.is("organization_id", null);
    else if (scope !== "everything") q = q.eq("organization_id", scope);
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    const rows = (data ?? []) as Post[];
    setPosts(rows);
    const ids = rows.map((p) => p.id);
    const uids = [...new Set(rows.map((p) => p.user_id))];
    if (uids.length) {
      const { data: pr } = await (supabase as any).from("profiles").select("id, display_name, username, avatar_url").in("id", uids);
      setProfiles(Object.fromEntries((pr ?? []).map((p: any) => [p.id, p])));
    }
    if (ids.length) {
      const { data: lk } = await (supabase as any).from("social_likes").select("post_id, user_id").in("post_id", ids);
      const map: Record<string, { count: number; mine: boolean }> = {};
      for (const id of ids) map[id] = { count: 0, mine: false };
      for (const l of lk ?? []) {
        map[l.post_id].count++;
        if (l.user_id === user?.id) map[l.post_id].mine = true;
      }
      setLikes(map);
    }
  };

  useEffect(() => { load(); }, [scope, user?.id]);
  useEffect(() => {
    if (!user) return;
    (supabase as any).from("organization_members")
      .select("organization:organizations(id, name)").eq("user_id", user.id)
      .then(({ data }: any) => setOrgs((data ?? []).map((m: any) => m.organization).filter(Boolean)));
  }, [user?.id]);

  const post = async () => {
    if (!draft.body.trim() || !user) return;
    setBusy(true);
    const { error } = await (supabase as any).from("social_posts").insert({
      user_id: user.id,
      body: draft.body.trim(),
      minutes: draft.minutes ? Number(draft.minutes) : null,
      subject: draft.subject.trim() || null,
      organization_id: draft.org === "none" ? null : draft.org,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setDraft({ body: "", minutes: "", subject: "", org: draft.org });
    toast.success("投稿しました");
    load();
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

      <Card className="p-4 space-y-2">
        <Textarea rows={3} placeholder="今日の勉強を共有しよう！" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        <div className="flex flex-wrap gap-2">
          <Input className="w-28" type="number" placeholder="分" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value })} />
          <Input className="w-36" placeholder="教科（任意）" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
          <Select value={draft.org} onValueChange={(v) => setDraft({ ...draft, org: v })}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">全体に公開</SelectItem>
              {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name} 限定</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="ml-auto" onClick={post} disabled={busy || !draft.body.trim()}><Send className="h-4 w-4 mr-1" />投稿</Button>
        </div>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={scope === "all" ? "default" : "outline"} onClick={() => setScope("all")}>全体</Button>
        {orgs.map((o) => (
          <Button key={o.id} size="sm" variant={scope === o.id ? "default" : "outline"} onClick={() => setScope(o.id)}>{o.name}</Button>
        ))}
      </div>

      {posts.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">まだ投稿がありません。最初の一件を投稿しよう！</Card>}

      {posts.map((p) => (
        <Card key={p.id} className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">{name(p.user_id).slice(0, 1)}</div>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{name(p.user_id)}</div>
              <div className="text-[11px] text-muted-foreground">{new Date(p.created_at).toLocaleString("ja-JP")}{p.organization_id ? " ・組織限定" : ""}</div>
            </div>
            {p.user_id === user?.id && (
              <Button size="icon" variant="ghost" className="ml-auto" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap">{p.body}</p>
          {(p.minutes || p.subject) && (
            <div className="flex gap-2 text-[11px]">
              {p.subject && <span className="px-2 py-0.5 rounded bg-muted">{p.subject}</span>}
              {p.minutes ? <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">{p.minutes}分</span> : null}
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button onClick={() => toggleLike(p.id)} className={`flex items-center gap-1 text-xs ${likes[p.id]?.mine ? "text-red-500" : "text-muted-foreground"}`}>
              <Heart className={`h-4 w-4 ${likes[p.id]?.mine ? "fill-current" : ""}`} />{likes[p.id]?.count ?? 0}
            </button>
            <button onClick={() => toggleComments(p.id)} className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="h-4 w-4" />コメント
            </button>
          </div>
          {openComments[p.id] && (
            <div className="space-y-2 border-t pt-2">
              {(comments[p.id] ?? []).map((c) => (
                <div key={c.id} className="text-xs">
                  <span className="font-semibold">{name(c.user_id)}</span>：{c.body}
                </div>
              ))}
              <CommentInput onSend={(v) => addComment(p.id, v)} />
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function CommentInput({ onSend }: { onSend: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2">
      <Input value={v} placeholder="コメントを書く…" onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { onSend(v); setV(""); } }} />
      <Button size="sm" onClick={() => { onSend(v); setV(""); }} disabled={!v.trim()}>送信</Button>
    </div>
  );
}
