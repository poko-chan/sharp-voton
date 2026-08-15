import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Paperclip, Trash2, Plus, Send, Pin, PinOff, Hash, Users, FileText, Download, X } from "lucide-react";
import { toast } from "sonner";
import { loadOrgProfiles, nameOf } from "@/lib/org-apps";

const PIN_KEY = (orgId: string) => `org.posts.pins.${orgId}`;
const isImage = (u: string) => /\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?|$)/i.test(u);
const fileName = (u: string) => decodeURIComponent(u.split("/").pop() ?? "file").replace(/^[0-9a-f-]{36}-/i, "");

export function OrgPosts({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [likes, setLikes] = useState<Record<string, string[]>>({});
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [channel, setChannel] = useState<string>("all");
  const [scope, setScope] = useState("org");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pins, setPins] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setPins(JSON.parse(localStorage.getItem(PIN_KEY(orgId)) ?? "[]")); } catch { setPins([]); }
  }, [orgId]);
  const togglePin = (id: string) => {
    setPins((p) => {
      const next = p.includes(id) ? p.filter((x) => x !== id) : [...p, id];
      localStorage.setItem(PIN_KEY(orgId), JSON.stringify(next));
      return next;
    });
  };

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
    if (images.length + files.length > 10) return toast.error("添付は10件までです");
    setBusy(true);
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 25 * 1024 * 1024) { toast.error(`${f.name} は25MBを超えています`); continue; }
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
  const countOf = (key: string) => posts.filter((p) => key === "all" ? true : key === "org" ? !p.group_id : p.group_id === key).length;

  const channels = useMemo(() => {
    const base = [{ id: "all", name: "すべての投稿", icon: "all" }, { id: "org", name: "組織全体", icon: "org" }];
    const gs = ctx.groups.map((g: any) => ({ id: g.id, name: g.name, icon: "group" }));
    const pinned = gs.filter((g: any) => pins.includes(g.id));
    const rest = gs.filter((g: any) => !pins.includes(g.id));
    return { base, pinned, rest };
  }, [ctx.groups, pins]);

  const visible = posts.filter((p) => channel === "all" ? true : channel === "org" ? !p.group_id : p.group_id === channel);

  const ChannelBtn = ({ id, name, kind }: { id: string; name: string; kind: string }) => (
    <div className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm cursor-pointer transition
      ${channel === id ? "bg-primary/12 text-primary font-medium" : "hover:bg-muted"}`} onClick={() => setChannel(id)}>
      {kind === "group" ? <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" /> : <Users className="h-3.5 w-3.5 shrink-0 opacity-70" />}
      <span className="flex-1 truncate">{name}</span>
      <span className="text-[10px] text-muted-foreground tabular-nums">{countOf(id)}</span>
      {kind === "group" && (
        <button className="opacity-0 group-hover:opacity-100 transition" title={pins.includes(id) ? "ピン解除" : "ピン止め"}
          onClick={(e) => { e.stopPropagation(); togglePin(id); }}>
          {pins.includes(id) ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </button>
      )}
    </div>
  );

  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-5">
      {/* 左のバー */}
      <aside className="space-y-3 lg:sticky lg:top-4 self-start">
        <Card className="p-2 space-y-0.5">
          <div className="px-2 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">チャンネル</div>
          {channels.base.map((c) => <ChannelBtn key={c.id} id={c.id} name={c.name} kind={c.icon} />)}
          {channels.pinned.length > 0 && (
            <>
              <div className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase flex items-center gap-1"><Pin className="h-3 w-3" />ピン止め</div>
              {channels.pinned.map((g: any) => <ChannelBtn key={g.id} id={g.id} name={g.name} kind="group" />)}
            </>
          )}
          {channels.rest.length > 0 && (
            <>
              <div className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">グループ</div>
              {channels.rest.map((g: any) => <ChannelBtn key={g.id} id={g.id} name={g.name} kind="group" />)}
            </>
          )}
          {ctx.groups.length === 0 && <div className="px-2 py-2 text-[11px] text-muted-foreground">グループはまだありません</div>}
        </Card>
        <Button className="w-full" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />投稿する</Button>
      </aside>

      {/* 本体 */}
      <div className="space-y-3 min-w-0">
        {creating && (
          <Card className="p-4 space-y-3 border-primary/40">
            <div className="flex flex-wrap gap-2 items-center">
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="org">組織全体（教師以上）</option>
                {ctx.groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <span className="text-[11px] text-muted-foreground">配信先を選んでください</span>
            </div>
            <Input placeholder="タイトル（例: 夏休みの活動について）" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea rows={5} placeholder="本文" value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="flex flex-wrap gap-2 items-center">
              <input ref={fileRef} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy || images.length >= 10}>
                <Paperclip className="h-4 w-4 mr-1" />ファイルを添付 ({images.length}/10)
              </Button>
              {images.map((u) => (
                <span key={u} className="relative">
                  {isImage(u)
                    ? <img src={u} alt="添付画像" className="h-14 w-14 object-cover rounded border" />
                    : <span className="inline-flex items-center gap-1 h-14 px-2 rounded border text-[11px] max-w-[140px] truncate"><FileText className="h-3.5 w-3.5" />{fileName(u)}</span>}
                  <button className="absolute -top-1.5 -right-1.5 bg-background border rounded-full p-0.5" title="削除"
                    onClick={() => setImages((i) => i.filter((x) => x !== u))}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={create} disabled={busy}>投稿</Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>やめる</Button>
            </div>
          </Card>
        )}

        {visible.length === 0 && <Card className="p-10 text-center text-sm text-muted-foreground">まだ投稿はありません</Card>}
        {visible.map((p) => (
          <Card key={p.id} className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={profiles[p.author_id]?.avatar_url ?? undefined} alt="" />
                <AvatarFallback>{nameOf(profiles[p.author_id]).slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-bold leading-tight">{p.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  {nameOf(profiles[p.author_id])} ・ {new Date(p.created_at).toLocaleString("ja-JP")}
                  <span className="ml-2 px-1.5 rounded bg-sky-500/15 text-sky-600">{p.group_id ? (groupName(p.group_id) ?? "グループ") : "組織全体"}</span>
                </div>
              </div>
              {(p.author_id === user?.id || ctx.canAdmin) && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
            {p.body && <div className="text-sm whitespace-pre-wrap">{p.body}</div>}
            {p.images?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {p.images.filter(isImage).map((u: string) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`${p.title}の添付画像`} loading="lazy" className="h-32 rounded-lg border object-cover" /></a>
                ))}
                {p.images.filter((u: string) => !isImage(u)).map((u: string) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" download
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:border-primary max-w-[240px]">
                    <FileText className="h-4 w-4 shrink-0" /><span className="truncate flex-1">{fileName(u)}</span><Download className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            )}
            <div className="flex gap-4 text-sm pt-1">
              <button className="flex items-center gap-1 hover:text-primary" onClick={() => toggleLike(p.id)}>
                <Heart className={`h-4 w-4 ${(likes[p.id] ?? []).includes(user?.id ?? "") ? "fill-current text-rose-500" : ""}`} />
                {(likes[p.id] ?? []).length}
              </button>
              <button className="flex items-center gap-1 hover:text-primary" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                <MessageCircle className="h-4 w-4" />{(comments[p.id] ?? []).length}
              </button>
            </div>
            {openId === p.id && (
              <div className="space-y-2 pt-2 border-t">
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
    </div>
  );
}
