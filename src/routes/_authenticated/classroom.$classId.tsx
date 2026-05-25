import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { gradeSubmission } from "@/lib/classroom.functions";
import { createPost, deletePost, addComment, deleteComment, submitQuiz } from "@/lib/classroom-posts.functions";
import { uploadClassroomFile, fileExt, type ClassroomAttachment } from "@/lib/classroom-files";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, GraduationCap, Crown, Trash2, BookOpen, ClipboardCheck, Users, Copy, Megaphone, Paperclip, Lock, MessageSquare, FileText, ListChecks, X, FolderOpen, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ClassFilesPanel } from "@/components/ClassFilesPanel";
import { ClassPermissionsPanel, useMyClassPermissions } from "@/components/ClassPermissionsPanel";

export const Route = createFileRoute("/_authenticated/classroom/$classId")({ component: ClassDetail });

function ClassDetail() {
  const { classId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [cls, setCls] = useState<any>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAsg, setSelectedAsg] = useState<any>(null);

  const load = async () => {
    if (!user) return;
    const { data: c } = await supabase.from("classes").select("*").eq("id", classId).maybeSingle();
    setCls(c);
    const { data: mem } = await supabase.from("class_members").select("user_id, role, joined_at").eq("class_id", classId);
    const userIds = (mem ?? []).map((m) => m.user_id);
    const { data: profs } = userIds.length > 0
      ? await supabase.from("profiles").select("id, display_name, username, avatar_url").in("id", userIds)
      : { data: [] as any[] };
    const pMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const enriched = (mem ?? []).map((m) => ({ ...m, profile: pMap.get(m.user_id) }));
    setMembers(enriched);
    const myRole = enriched.find((m) => m.user_id === user.id)?.role;
    setIsTeacher(myRole === "teacher" || c?.owner_id === user.id);
    const { data: asg } = await supabase.from("assignments").select("*").eq("class_id", classId).order("created_at", { ascending: false });
    setAssignments(asg ?? []);
  };
  useEffect(() => { load(); }, [classId, user]);

  if (!cls) return <div className="p-8 text-muted-foreground">読み込み中...</div>;

  const copyCode = () => { navigator.clipboard.writeText(cls.invite_code); toast.success("コピーしました"); };
  const leaveOrDelete = async () => {
    if (cls.owner_id === user?.id) {
      if (!confirm("クラスを削除しますか？")) return;
      await supabase.from("classes").delete().eq("id", classId);
      toast.success("削除しました"); nav({ to: "/classroom" });
    } else {
      if (!confirm("退会しますか？")) return;
      await supabase.from("class_members").delete().eq("class_id", classId).eq("user_id", user!.id);
      toast.success("退会しました"); nav({ to: "/classroom" });
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-5">
      <Link to="/classroom" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" />クラス一覧</Link>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><GraduationCap className="h-7 w-7 text-primary" />{cls.name}</h1>
          {cls.description && <p className="text-muted-foreground text-sm mt-1 whitespace-pre-wrap">{cls.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyCode} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 text-sm font-mono hover:bg-muted">
            <Copy className="h-3 w-3" />{cls.invite_code}
          </button>
          <Button variant="outline" size="sm" onClick={leaveOrDelete}>
            <Trash2 className="h-3 w-3 mr-1" />{cls.owner_id === user?.id ? "クラス削除" : "退会"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="stream">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="stream"><Megaphone className="h-3 w-3 mr-1" />ストリーム</TabsTrigger>
          <TabsTrigger value="assignments"><BookOpen className="h-3 w-3 mr-1" />課題</TabsTrigger>
          <TabsTrigger value="files"><FolderOpen className="h-3 w-3 mr-1" />共有フォルダー</TabsTrigger>
          <TabsTrigger value="members"><Users className="h-3 w-3 mr-1" />メンバー ({members.length})</TabsTrigger>
          {isTeacher && <TabsTrigger value="logs"><ClipboardCheck className="h-3 w-3 mr-1" />生徒の学習記録</TabsTrigger>}
          {isTeacher && <TabsTrigger value="permissions"><ShieldCheck className="h-3 w-3 mr-1" />権限</TabsTrigger>}
        </TabsList>



        <TabsContent value="stream" className="space-y-3 mt-4">
          <Stream classId={classId} isTeacher={isTeacher} members={members} />
        </TabsContent>

        <TabsContent value="assignments" className="space-y-3 mt-4">
          {isTeacher && <CreateAssignment classId={classId} onCreated={load} />}
          {assignments.length === 0 && <Card className="p-6 text-center text-muted-foreground text-sm">課題はまだありません</Card>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assignments.map((a) => (
              <Card key={a.id} className="p-4 hover:shadow-md transition cursor-pointer" onClick={() => setSelectedAsg(a)}>
                <div className="flex items-center gap-2">
                  {a.kind === "quiz" ? <ListChecks className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                  <div className="font-semibold">{a.title}</div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1 whitespace-pre-wrap">{a.description}</p>
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-muted-foreground">{a.due_at ? `期限: ${new Date(a.due_at).toLocaleString("ja-JP")}` : "期限なし"}</span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">配点 {a.max_points}</span>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <FilesTab classId={classId} isTeacher={isTeacher} userId={user?.id} />
        </TabsContent>



        <TabsContent value="members" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr className="text-left"><th className="p-3">ユーザー</th><th className="p-3">役割</th><th className="p-3">参加日</th>{isTeacher && <th className="p-3">操作</th>}</tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id} className="border-t">
                    <td className="p-3">{m.profile?.display_name ?? m.profile?.username ?? "?"}</td>
                    <td className="p-3">
                      {m.user_id === cls.owner_id ? (
                        <span className="text-xs flex items-center gap-1 text-amber-600"><Crown className="h-3 w-3" />オーナー</span>
                      ) : m.role === "teacher" ? <span className="text-xs px-2 py-0.5 rounded bg-primary/15 text-primary">教師</span> : <span className="text-xs text-muted-foreground">生徒</span>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(m.joined_at).toLocaleDateString("ja-JP")}</td>
                    {isTeacher && (
                      <td className="p-3">
                        {m.user_id === cls.owner_id ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Select
                            value={m.role}
                            onValueChange={async (v) => {
                              const { error } = await supabase.from("class_members").update({ role: v }).eq("class_id", classId).eq("user_id", m.user_id);
                              if (error) toast.error(error.message);
                              else { toast.success("役割を変更しました"); load(); }
                            }}
                          >
                            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="student">生徒</SelectItem>
                              <SelectItem value="teacher">教師</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {isTeacher && (
          <TabsContent value="logs" className="mt-4">
            <StudentLogs members={members.filter((m) => m.user_id !== user?.id)} />
          </TabsContent>
        )}

        {isTeacher && (
          <TabsContent value="permissions" className="mt-4">
            <ClassPermissionsPanel classId={classId} members={members} ownerId={cls.owner_id} />
          </TabsContent>
        )}
      </Tabs>


      {selectedAsg && (
        <AssignmentDialog
          assignment={selectedAsg}
          isTeacher={isTeacher}
          members={members}
          onClose={() => { setSelectedAsg(null); load(); }}
        />
      )}
    </div>
  );
}

// ============ Stream ============
function Stream({ classId, isTeacher, members }: { classId: string; isTeacher: boolean; members: any[] }) {
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

function PostComposer({ classId, onPosted, create }: { classId: string; onPosted: () => void; create: any }) {
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

function CommentSection({ postId, classId, comments, members, isTeacher, profName, currentUserId, onChange }: any) {
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

function AttachmentList({ attachments }: { attachments: ClassroomAttachment[] }) {
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

function FileUploader({ onFile, uploading, accept }: { onFile: (f: File) => void; uploading: boolean; accept?: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-primary hover:underline">
      <Paperclip className="h-3 w-3" />
      {uploading ? "アップロード中..." : "ファイルを添付"}
      <input type="file" accept={accept} hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </label>
  );
}

// ============ Assignment Creation (with quiz mode + attachments + file-type restriction) ============
function CreateAssignment({ classId, onCreated }: { classId: string; onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [max, setMax] = useState(100);
  const [mode, setMode] = useState<"score" | "fixed" | "none">("score");
  const [fixed, setFixed] = useState(50);
  const [kind, setKind] = useState<"standard" | "quiz">("standard");
  const [allowedTypes, setAllowedTypes] = useState("");
  const [attachments, setAttachments] = useState<ClassroomAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [quiz, setQuiz] = useState<any[]>([]);

  const onFile = async (f: File) => {
    if (!user) return;
    setUploading(true);
    try { const a = await uploadClassroomFile(user.id, f); setAttachments((arr) => [...arr, a]); }
    catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };
  const addQ = () => setQuiz((q) => [...q, { id: crypto.randomUUID(), type: "short", question: "", answer: "", points: 1, options: [] }]);

  const submit = async () => {
    if (!title.trim()) return toast.error("タイトルを入力");
    if (kind === "quiz" && quiz.length === 0) return toast.error("問題を1つ以上追加してください");
    const payload: any = {
      class_id: classId, title: title.trim(), description: desc, max_points: max,
      due_at: due ? new Date(due).toISOString() : null, xp_mode: mode, fixed_xp: fixed,
      created_by: (await supabase.auth.getUser()).data.user!.id,
      attachments,
      kind,
      allowed_file_types: allowedTypes.trim() ? allowedTypes.split(",").map((s) => s.trim().toLowerCase().replace(/^\./, "")).filter(Boolean) : null,
      quiz_questions: kind === "quiz" ? quiz : null,
    };
    const { error } = await supabase.from("assignments").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("課題を作成しました");
    setOpen(false); setTitle(""); setDesc(""); setDue(""); setAttachments([]); setQuiz([]); setAllowedTypes("");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />課題を作成</Button></DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>課題を作成</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>種別</Label>
            <Select value={kind} onValueChange={(v: any) => setKind(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">標準課題（レポート・記述提出）</SelectItem>
                <SelectItem value="quiz">自動採点小テスト（選択式/短答式）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>タイトル</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>内容・指示</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>期限</Label><Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></div>
            <div><Label>配点</Label><Input type="number" value={max} onChange={(e) => setMax(+e.target.value)} /></div>
          </div>

          {kind === "standard" && (
            <div>
              <Label>提出ファイル形式制限（カンマ区切り。空欄=制限なし）</Label>
              <Input value={allowedTypes} onChange={(e) => setAllowedTypes(e.target.value)} placeholder="pdf, docx, jpg" />
            </div>
          )}

          <div className="space-y-2">
            <Label>配布資料・添付ファイル</Label>
            <FileUploader onFile={onFile} uploading={uploading} />
            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/40">
                    <span className="truncate">📎 {f.name}</span>
                    <button onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {kind === "quiz" && (
            <div className="space-y-2 border rounded p-3">
              <div className="flex items-center justify-between">
                <Label>問題</Label>
                <Button size="sm" variant="outline" onClick={addQ}><Plus className="h-3 w-3 mr-1" />問題追加</Button>
              </div>
              {quiz.length === 0 && <p className="text-xs text-muted-foreground">問題を追加してください</p>}
              {quiz.map((q, idx) => (
                <QuizQuestionEditor
                  key={q.id}
                  q={q}
                  index={idx}
                  onChange={(nq) => setQuiz((arr) => arr.map((x, i) => i === idx ? nq : x))}
                  onRemove={() => setQuiz((arr) => arr.filter((_, i) => i !== idx))}
                />
              ))}
            </div>
          )}

          <div>
            <Label>レベルへの加算方法</Label>
            <Select value={mode} onValueChange={(v: any) => setMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="score">採点点数 = XP</SelectItem>
                <SelectItem value="fixed">提出時に固定XPを付与</SelectItem>
                <SelectItem value="none">XP加算なし</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "fixed" && (
            <div><Label>固定XP</Label><Input type="number" value={fixed} onChange={(e) => setFixed(+e.target.value)} /></div>
          )}
          <Button onClick={submit} className="w-full" disabled={uploading}>作成して全員に配布</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuizQuestionEditor({ q, index, onChange, onRemove }: { q: any; index: number; onChange: (q: any) => void; onRemove: () => void }) {
  return (
    <div className="border rounded p-2 space-y-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Q{index + 1}</span>
        <button onClick={onRemove} className="text-destructive"><X className="h-3 w-3" /></button>
      </div>
      <Select value={q.type} onValueChange={(v) => onChange({ ...q, type: v, options: v === "choice" ? (q.options?.length ? q.options : ["", ""]) : [] })}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="short">短答式</SelectItem>
          <SelectItem value="choice">選択式</SelectItem>
        </SelectContent>
      </Select>
      <Textarea value={q.question} onChange={(e) => onChange({ ...q, question: e.target.value })} placeholder="問題文" rows={2} className="text-xs" />
      {q.type === "choice" && (
        <div className="space-y-1">
          {(q.options ?? []).map((op: string, i: number) => (
            <div key={i} className="flex items-center gap-1">
              <Input value={op} onChange={(e) => {
                const arr = [...q.options]; arr[i] = e.target.value; onChange({ ...q, options: arr });
              }} placeholder={`選択肢${i + 1}`} className="h-7 text-xs" />
              <button onClick={() => onChange({ ...q, options: q.options.filter((_: any, j: number) => j !== i) })}><X className="h-3 w-3" /></button>
            </div>
          ))}
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => onChange({ ...q, options: [...(q.options ?? []), ""] })}>+ 選択肢追加</Button>
        </div>
      )}
      <Input value={q.answer} onChange={(e) => onChange({ ...q, answer: e.target.value })} placeholder="正解（短答=正解文字列 / 選択=選択肢の文字列と完全一致）" className="h-7 text-xs" />
      <Input type="number" value={q.points} onChange={(e) => onChange({ ...q, points: +e.target.value })} placeholder="配点" className="h-7 text-xs w-20" />
    </div>
  );
}

// ============ Assignment Dialog ============
function AssignmentDialog({ assignment, isTeacher, members, onClose }: any) {
  const { user } = useAuth();
  const grade = useServerFn(gradeSubmission);
  const submitQuizFn = useServerFn(submitQuiz);
  const [mySub, setMySub] = useState<any>(null);
  const [allSubs, setAllSubs] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<ClassroomAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [quizAns, setQuizAns] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
    if (isTeacher) {
      const { data } = await supabase.from("submissions").select("*").eq("assignment_id", assignment.id);
      setAllSubs(data ?? []);
    } else {
      const { data } = await supabase.from("submissions").select("*").eq("assignment_id", assignment.id).eq("user_id", user.id).maybeSingle();
      setMySub(data);
      setContent(data?.content ?? "");
      setFiles(((data?.attachments as any) ?? []) as ClassroomAttachment[]);
      const qa = (data?.quiz_answers as any) ?? null;
      if (qa?.answers) {
        const m: Record<string, string> = {};
        (qa.answers as any[]).forEach((a: any) => { m[a.questionId] = a.answer; });
        setQuizAns(m);
      }
    }
  };
  useEffect(() => { load(); }, [assignment.id, user, isTeacher]);

  const onFile = async (f: File) => {
    if (!user) return;
    const allowed: string[] | null = assignment.allowed_file_types ?? null;
    if (allowed && allowed.length > 0) {
      const ext = fileExt(f.name);
      if (!allowed.includes(ext)) return toast.error(`許可された形式: ${allowed.join(", ")}`);
    }
    if (f.size > 20 * 1024 * 1024) return toast.error("20MB以下にしてください");
    setUploading(true);
    try { const a = await uploadClassroomFile(user.id, f); setFiles((arr) => [...arr, a]); }
    catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!user) return;
    const payload: any = { assignment_id: assignment.id, user_id: user.id, content, attachments: files, submitted_at: new Date().toISOString() };
    if (assignment.xp_mode === "fixed" && !mySub) payload.xp_awarded = assignment.fixed_xp;
    const { error } = mySub
      ? await supabase.from("submissions").update({ content, attachments: files, submitted_at: new Date().toISOString() }).eq("id", mySub.id)
      : await supabase.from("submissions").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("提出しました");
    load();
  };

  const submitQuizAns = async () => {
    const answers = (assignment.quiz_questions ?? []).map((q: any) => ({ questionId: q.id, answer: quizAns[q.id] ?? "" }));
    try {
      const r = await submitQuizFn({ data: { assignmentId: assignment.id, answers } });
      toast.success(`自動採点: ${r.earnedPts}/${r.totalPts}点（${r.score}/${assignment.max_points}）`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {assignment.kind === "quiz" ? <ListChecks className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5" />}
            {assignment.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            {assignment.due_at ? `期限: ${new Date(assignment.due_at).toLocaleString("ja-JP")}` : "期限なし"} ・ 配点 {assignment.max_points}
            {assignment.allowed_file_types?.length > 0 && <> ・ 提出形式: {assignment.allowed_file_types.join(", ")}</>}
          </div>
          <p className="text-sm whitespace-pre-wrap">{assignment.description}</p>
          <AttachmentList attachments={assignment.attachments ?? []} />

          {!isTeacher && assignment.kind === "quiz" && (
            <Card className="p-4 space-y-3">
              <div className="font-semibold text-sm">小テスト{mySub?.graded_at && " (採点済)"}</div>
              {mySub?.graded_at && (
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-sm">
                  自動採点: <span className="font-bold">{mySub.score}/{assignment.max_points} 点</span> ・ XP {mySub.xp_awarded}
                </div>
              )}
              {(assignment.quiz_questions ?? []).map((q: any, i: number) => {
                const sub = mySub?.quiz_answers?.detail?.find((d: any) => d.questionId === q.id);
                return (
                  <div key={q.id} className="space-y-1">
                    <div className="text-sm font-medium">Q{i + 1}. {q.question} <span className="text-xs text-muted-foreground">({q.points}pt)</span></div>
                    {q.type === "choice" ? (
                      <div className="space-y-1">
                        {(q.options ?? []).map((op: string, j: number) => (
                          <label key={j} className="flex items-center gap-2 text-sm">
                            <input type="radio" name={q.id} value={op} checked={quizAns[q.id] === op} onChange={() => setQuizAns({ ...quizAns, [q.id]: op })} />
                            {op}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <Input value={quizAns[q.id] ?? ""} onChange={(e) => setQuizAns({ ...quizAns, [q.id]: e.target.value })} />
                    )}
                    {sub && (
                      <div className={`text-xs ${sub.correct ? "text-emerald-600" : "text-red-600"}`}>
                        {sub.correct ? "✓ 正解" : `✗ 不正解（正解: ${sub.expected}）`}
                      </div>
                    )}
                  </div>
                );
              })}
              <Button onClick={submitQuizAns}>{mySub ? "再提出して再採点" : "提出して自動採点"}</Button>
            </Card>
          )}

          {!isTeacher && assignment.kind !== "quiz" && (
            <Card className="p-4 space-y-2">
              <div className="font-semibold text-sm">あなたの提出</div>
              {mySub?.graded_at && (
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-sm">
                  <div>採点: <span className="font-bold">{mySub.score}/{assignment.max_points} 点</span> ・ 獲得XP: {mySub.xp_awarded}</div>
                  {mySub.feedback && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{mySub.feedback}</div>}
                </div>
              )}
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="解答や提出内容を入力" rows={5} />
              <FileUploader
                onFile={onFile}
                uploading={uploading}
                accept={assignment.allowed_file_types?.length ? assignment.allowed_file_types.map((t: string) => "." + t).join(",") : undefined}
              />
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/40">
                      <span className="truncate">📎 {f.name}</span>
                      <button onClick={() => setFiles((arr) => arr.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={submit} disabled={uploading}>{mySub ? "更新して再提出" : "提出"}</Button>
            </Card>
          )}

          {isTeacher && (
            <Card className="p-4 space-y-3">
              <div className="font-semibold text-sm">提出一覧 ({allSubs.length}/{members.length}人)</div>
              {allSubs.length === 0 && <p className="text-xs text-muted-foreground">まだ提出はありません</p>}
              {allSubs.map((s) => {
                const m = members.find((mm: any) => mm.user_id === s.user_id);
                return <GradeRow key={s.id} sub={s} memberName={m?.profile?.display_name ?? m?.profile?.username ?? "?"} max={assignment.max_points} isQuiz={assignment.kind === "quiz"} onGrade={grade} reload={load} />;
              })}
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GradeRow({ sub, memberName, max, isQuiz, onGrade, reload }: any) {
  const [score, setScore] = useState<number>(sub.score ?? 0);
  const [fb, setFb] = useState<string>(sub.feedback ?? "");
  const save = async () => {
    try {
      await onGrade({ data: { submissionId: sub.id, score, feedback: fb } });
      toast.success(`${memberName} を採点しました`);
      reload();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <div className="p-3 rounded border space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">{memberName}{isQuiz && <span className="ml-2 text-xs text-primary">自動採点</span>}</div>
        <div className="text-xs text-muted-foreground">{new Date(sub.submitted_at).toLocaleString("ja-JP")}</div>
      </div>
      {sub.content && <p className="text-sm whitespace-pre-wrap bg-muted/30 p-2 rounded">{sub.content}</p>}
      <AttachmentList attachments={sub.attachments ?? []} />
      {isQuiz && sub.quiz_answers?.detail && (
        <div className="text-xs space-y-0.5 bg-muted/30 p-2 rounded">
          {sub.quiz_answers.detail.map((d: any, i: number) => (
            <div key={i} className={d.correct ? "text-emerald-600" : "text-red-600"}>
              {d.correct ? "✓" : "✗"} 回答: {d.userAnswer || "(無回答)"} {!d.correct && `／正解: ${d.expected}`}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input type="number" value={score} onChange={(e) => setScore(+e.target.value)} className="w-20 h-8" max={max} />
        <span className="text-xs text-muted-foreground">/ {max}</span>
        <Input value={fb} onChange={(e) => setFb(e.target.value)} placeholder="フィードバック（個別コメント）" className="h-8" />
        <Button size="sm" onClick={save}>採点</Button>
      </div>
      {sub.graded_at && <div className="text-[10px] text-emerald-600">採点済 ・ 付与XP {sub.xp_awarded}</div>}
    </div>
  );
}

function StudentLogs({ members }: { members: any[] }) {
  const [logs, setLogs] = useState<Record<string, any[]>>({});
  useEffect(() => {
    (async () => {
      const ids = members.map((m) => m.user_id);
      if (ids.length === 0) return;
      const { data } = await supabase.from("study_logs")
        .select("user_id, date, duration_minutes, content, subjects(name, color)")
        .in("user_id", ids).order("date", { ascending: false }).limit(500);
      const map: Record<string, any[]> = {};
      (data ?? []).forEach((l: any) => { (map[l.user_id] ||= []).push(l); });
      setLogs(map);
    })();
  }, [members]);
  return (
    <div className="space-y-3">
      {members.map((m) => {
        const items = logs[m.user_id] ?? [];
        const total = items.reduce((s, l) => s + (l.duration_minutes ?? 0), 0);
        return (
          <Card key={m.user_id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{m.profile?.display_name ?? m.profile?.username ?? "?"}</div>
              <div className="text-xs text-muted-foreground">合計 {Math.floor(total / 60)}h {total % 60}m / {items.length}件</div>
            </div>
            <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
              {items.slice(0, 30).map((l, i) => (
                <div key={i} className="text-xs flex items-center gap-2 p-1.5 rounded hover:bg-muted/30">
                  <span className="text-muted-foreground w-20">{l.date}</span>
                  {l.subjects && <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: l.subjects.color + "33", color: l.subjects.color }}>{l.subjects.name}</span>}
                  <span className="font-medium">{l.duration_minutes}分</span>
                  {l.content && <span className="text-muted-foreground truncate">{l.content}</span>}
                </div>
              ))}
              {items.length === 0 && <p className="text-xs text-muted-foreground">記録なし</p>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function FilesTab({ classId, isTeacher, userId }: { classId: string; isTeacher: boolean; userId: string | undefined }) {
  const perm = useMyClassPermissions(classId, userId, isTeacher);
  return <ClassFilesPanel classId={classId} isTeacher={isTeacher} canUpload={isTeacher || perm.can_upload_files} />;
}
