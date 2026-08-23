import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createPost, deletePost, addComment, deleteComment } from "@/lib/classroom-posts.functions";
import { uploadClassroomFile, type ClassroomAttachment } from "@/lib/classroom-files";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Megaphone, Paperclip, Lock, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";
import { toast } from "sonner";

export function Stream({ classId, isTeacher, members }: { classId: string; isTeacher: boolean; members: any[] }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [profMap, setProfMap] = useState<Map<string, any>>(new Map());
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const create = useServerFn(createPost);
  const remove = useServerFn(deletePost);

  const load = async () => {
    const { data: ps } = await supabase.from("class_posts").select("*")
      .eq("class_id", classId).order("pinned", { ascending: false }).order("created_at", { ascending: false });
    setPosts(ps ?? []);
    const ids = (ps ?? []).map((p) => p.id);
    if (ids.length > 0) {
      const { data: cs } = await supabase.from("class_post_comments").select("*")
        .in("post_id", ids).order("created_at", { ascending: true });
      const map: Record<string, any[]> = {};
      (cs ?? []).forEach((c) => { (map[c.post_id] ||= []).push(c); });
      setComments(map);
      const authorIds = new Set<string>();
      (ps ?? []).forEach((p) => authorIds.add(p.author_id));
      (cs ?? []).forEach((c) => authorIds.add(c.author_id));
      const { data: profs } = await supabase.from("profiles").select("id, display_name, username, avatar_url").in("id", Array.from(authorIds));
      setProfMap(new Map((profs ?? []).map((p: any) => [p.id, p])));
    } else {
      setComments({}); setProfMap(new Map());
    }
  };
  useEffect(() => { load(); }, [classId]);
  const profName = (id: string) => profMap.get(id)?.display_name ?? profMap.get(id)?.username ?? "?";

  return (
    <div className="space-y-4">
      {isTeacher && <PostComposer classId={classId} onPosted={load} create={create} />}
      {posts.length === 0 && <Card className="p-6 text-center text-muted-foreground text-sm">投稿はまだありません</Card>}
      {posts.map((p) => (
        <Card key={p.id} className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{profName(p.author_id)}</span>
                <span>{new Date(p.created_at).toLocaleString("ja-JP")}</span>
              </div>
              {p.title && <div className="font-semibold mt-1">{p.title}</div>}
            </div>
            {(isTeacher || p.author_id === user?.id) && (
              <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={async () => {
                if (!confirm("投稿を削除しますか？")) return;
                try { await remove({ data: { postId: p.id } }); toast.success("削除"); load(); }
                catch (e: any) { toast.error(e.message); }
              }}><Trash2 className="h-3 w-3" /></Button>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap">{p.body}</p>
          <AttachmentList attachments={p.attachments ?? []} />
          <CommentSection
            postId={p.id}
            classId={classId}
            comments={comments[p.id] ?? []}
            members={members}
            isTeacher={isTeacher}
            profName={profName}
            currentUserId={user?.id ?? ""}
            onChange={load}
          />
        </Card>
      ))}
    </div>
  );
}

export function PostComposer({ classId, onPosted, create }: { classId: string; onPosted: () => void; create: any }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<ClassroomAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const onFile = async (f: File) => {
    if (!user) return;
    if (f.size > 20 * 1024 * 1024) return toast.error("20MB以下にしてください");
    setUploading(true);
    try { const a = await uploadClassroomFile(user.id, f); setFiles((arr) => [...arr, a]); }
    catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };
  const submit = async () => {
    if (!body.trim()) return toast.error("本文を入力してください");
    try {
      await create({ data: { classId, title: title.trim(), body: body.trim(), attachments: files } });
      toast.success("投稿しました");
      setOpen(false); setTitle(""); setBody(""); setFiles([]); onPosted();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Megaphone className="h-4 w-4 mr-2" />お知らせを投稿</Button></DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>クラスに投稿</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル（任意）" maxLength={200} />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="本文・連絡事項・参考リンクなど" rows={6} maxLength={10000} />
          <FileUploader onFile={onFile} uploading={uploading} />
          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/40">
                  <span className="truncate">📎 {f.name}</span>
                  <button onClick={() => setFiles((arr) => arr.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button onClick={submit} disabled={uploading} className="w-full">投稿</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CommentSection({ postId, classId, comments, members, isTeacher, profName, currentUserId, onChange }: any) {
  const [body, setBody] = useState("");
  const [privateTo, setPrivateTo] = useState<string>("");
  const add = useServerFn(addComment);
  const del = useServerFn(deleteComment);
  const submit = async () => {
    if (!body.trim()) return;
    try {
      await add({ data: { postId, classId, body: body.trim(), privateTo: privateTo || null } });
      setBody(""); setPrivateTo(""); onChange();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <div className="pt-2 border-t space-y-2">
      <div className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" />コメント ({comments.length})</div>
      {comments.map((c: any) => (
        <div key={c.id} className={`text-xs rounded p-2 ${c.private_to ? "bg-amber-500/10 border border-amber-500/30" : "bg-muted/30"}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">{profName(c.author_id)}</span>
              <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString("ja-JP")}</span>
              {c.private_to && (
                <span className="inline-flex items-center gap-1 text-amber-700"><Lock className="h-3 w-3" />限定 → {profName(c.private_to)}</span>
              )}
            </div>
            {(c.author_id === currentUserId || isTeacher) && (
              <button onClick={async () => { try { await del({ data: { commentId: c.id } }); onChange(); } catch (e: any) { toast.error(e.message); } }} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="mt-1 whitespace-pre-wrap">{c.body}</div>
        </div>
      ))}
      <div className="flex gap-2 items-start">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="コメントを書く..." className="text-xs flex-1" maxLength={4000} />
        <div className="space-y-1">
          {isTeacher && (
            <Select value={privateTo || "all"} onValueChange={(v) => setPrivateTo(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全員に公開</SelectItem>
                {members.filter((m: any) => m.user_id !== currentUserId).map((m: any) => (
                  <SelectItem key={m.user_id} value={m.user_id}>🔒 {m.profile?.display_name ?? m.profile?.username ?? "?"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" onClick={submit}>送信</Button>
        </div>
      </div>
    </div>
  );
}

export function AttachmentList({ attachments }: { attachments: ClassroomAttachment[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((f, i) => (
        <a key={i} href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted/40 text-xs hover:bg-muted">
          <Paperclip className="h-3 w-3" /> {f.name}
        </a>
      ))}
    </div>
  );
}

export function FileUploader({ onFile, uploading, accept }: { onFile: (f: File) => void; uploading: boolean; accept?: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-primary hover:underline">
      <Paperclip className="h-3 w-3" />
      {uploading ? "アップロード中..." : "ファイルを添付"}
      <input type="file" accept={accept} hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </label>
  );
}

// ============ Assignment Creation (with quiz mode + attachments + file-type restriction) ============
