import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Image as ImageIcon, Trash2, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { loadOrgProfiles, nameOf } from "@/lib/org-apps";
import { OrgScopePicker } from "./OrgScopePicker";

export function OrgPosts({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [likes, setLikes] = useState<Record<string, string[]>>({});
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [scope, setScope] = useState("org");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data, error } = await (supabase as any).from("org_posts")
      .select("*").eq("organization_id", orgId).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(100);
    if (error) return toast.error(error.message);
    setPosts(data ?? []);
    setProfiles(await loadOrgProfiles(orgId, (data ?? []).map((p: any) => p.author_id)));
    const ids = (data ?? []).map((p: any) => p.id);
    if (ids.length) {
      const [{ data: lk }, { data: cm }] = await Promise.all([
        (supabase as any).from("org_post_likes").select("post_id, user_id").in("post_id", ids),
        (supabase as any).from("org_post_comments").select("*").in("post_id", ids).order("created_at"),
      ]);
      const lmap: Record<string, string[]> = {}, cmap: Record<string, any[]> = {};
      for (const l of lk ?? []) (lmap[l.post_id] ??= []).push(l.user_id);
      for (const c of cm ?? []) (cmap[c.post_id] ??= []).push(c);
      setLikes(lmap); setComments(cmap);
      const more = await loadOrgProfiles(orgId, (cm ?? []).map((c: any) => c.user_id));
      setProfiles((p) => ({ ...more, ...p, ...more }));
    } else { setLikes({}); setComments({}); }
  };
  useEffect(() => { load(); }, [orgId]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (images.length + files.length > 5) return toast.error("画像は5枚までです");
    setBusy(true);
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      const path = `org/${orgId}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("classroom-files").upload(path, f, { upsert: false });
      if (error) { toast.error(error.message); continue; }
      urls.push(supabase.storage.from("classroom-files").getPublicUrl(path).data.publicUrl);
    }
    setImages((i) => [...i, ...urls]); setBusy(false);
  };

  const create = async () => {
    if (!title.trim()) return toast.error("タイトルを入力してください");
    setBusy(true);
    const { error } = await (supabase as any).from("org_posts").insert({
      organization_id: orgId, group_id: scope === "org" ? null : scope,
      author_id: user!.id, title: title.trim(), body, images,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    await (supabase as any).rpc("org_notify_members", {
      _org: orgId, _group: scope === "org" ? null : scope, _app: "posts", _title: `新しい投稿: ${title.trim()}`, _body: body.slice(0, 80),
    });
    toast.success("投稿しました");
    setTitle(""); setBody(""); setImages([]); setCreating(false); load();
  };

  const toggleLike = async (postId: string) => {
    const mine = (likes[postId] ?? []).includes(user!.id);
    if (mine) await (supabase as any).from("org_post_likes").delete().eq("post_id", postId).eq("user_id", user!.id);
    else {
      const { error } = await (supabase as any).from("org_post_likes").insert({ post_id: postId, user_id: user!.id });
      if (error) return toast.error("いいねの権限がありません");
    }
    load();
  };

  const comment = async (postId: string) => {
    const b = (draft[postId] ?? "").trim();
    if (!b) return;
    const { error } = await (supabase as any).from("org_post_comments").insert({ post_id: postId, user_id: user!.id, body: b });
    if (error) return toast.error("コメントの権限がありません");
    setDraft((d) => ({ ...d, [postId]: "" })); load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("org_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const groupName = (id: string | null) => ctx.groups.find((g: any) => g.id === id)?.name;

  return (
    <div className="space-y-3">
      {!creating ? (
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />投稿する</Button>
      ) : (
        <Card className="p-4 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <OrgScopePicker groups={ctx.groups} value={scope} onChange={setScope} orgLabel="組織全体（教師以上）" />
            <span className="text-[11px] text-muted-foreground">配信先を選んでください</span>
          </div>
          <Input placeholder="タイトル（例: 夏休みの活動について）" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={5} placeholder="本文" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex flex-wrap gap-2 items-center">
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy || images.length >= 5}>
              <ImageIcon className="h-4 w-4 mr-1" />画像を追加 ({images.length}/5)
            </Button>
            {images.map((u) => (
              <img key={u} src={u} alt="添付画像" className="h-14 w-14 object-cover rounded border" />
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={create} disabled={busy}>投稿</Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>やめる</Button>
          </div>
        </Card>
      )}

      {posts.length === 0 && <Card className="p-6 text-sm text-muted-foreground">まだ投稿はありません</Card>}
      {posts.map((p) => (
        <Card key={p.id} className="p-4 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="font-bold">{p.title}</div>
              <div className="text-[11px] text-muted-foreground">
                {nameOf(profiles[p.author_id])} ・ {new Date(p.created_at).toLocaleString("ja-JP")}
                {p.group_id && <span className="ml-2 px-1.5 rounded bg-sky-500/15 text-sky-600">{groupName(p.group_id) ?? "グループ"}</span>}
              </div>
            </div>
            {(p.author_id === user?.id || ctx.canAdmin) && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
          {p.body && <div className="text-sm whitespace-pre-wrap">{p.body}</div>}
          {p.images?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {p.images.map((u: string) => <img key={u} src={u} alt={`${p.title}の添付画像`} loading="lazy" className="h-32 rounded border object-cover" />)}
            </div>
          )}
          <div className="flex gap-3 text-sm">
            <button className="flex items-center gap-1 hover:text-primary" onClick={() => toggleLike(p.id)}>
              <Heart className={`h-4 w-4 ${(likes[p.id] ?? []).includes(user?.id ?? "") ? "fill-current text-rose-500" : ""}`} />
              {(likes[p.id] ?? []).length}
            </button>
            <button className="flex items-center gap-1 hover:text-primary" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
              <MessageCircle className="h-4 w-4" />{(comments[p.id] ?? []).length}
            </button>
          </div>
          {openId === p.id && (
            <div className="space-y-2 pt-1 border-t">
              {(comments[p.id] ?? []).map((c) => (
                <div key={c.id} className="text-sm flex gap-2">
                  <span className="font-medium">{nameOf(profiles[c.user_id])}</span>
                  <span className="flex-1">{c.body}</span>
                  {c.user_id === user?.id && (
                    <button className="text-destructive text-xs" onClick={async () => {
                      await (supabase as any).from("org_post_comments").delete().eq("id", c.id); load();
                    }}>削除</button>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <Input placeholder="コメントを書く" value={draft[p.id] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && comment(p.id)} />
                <Button size="sm" onClick={() => comment(p.id)}><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
