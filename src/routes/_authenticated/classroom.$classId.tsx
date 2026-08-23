import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { ArrowLeft, Plus, GraduationCap, Crown, Trash2, BookOpen, ClipboardCheck, Users, Copy, Megaphone, Paperclip, Lock, MessageSquare, FileText, ListChecks, X, FolderOpen, ShieldCheck, Send } from "lucide-react";
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
          <TabsTrigger value="chat"><MessageSquare className="h-3 w-3 mr-1" />チャット</TabsTrigger>
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

        <TabsContent value="chat" className="mt-4">
          <ClassChatTab classId={classId} userId={user?.id} />
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

import { Stream } from "@/components/classroom/stream";
import { CreateAssignment, AssignmentDialog } from "@/components/classroom/assignments";
import { StudentLogs, FilesTab, ClassChatTab } from "@/components/classroom/panels";
