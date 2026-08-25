import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ArrowLeft, GraduationCap, Crown, Trash2, BookOpen, ClipboardCheck, Users, Copy, Megaphone, MessageSquare, FileText, ListChecks, FolderOpen, ShieldCheck, CalendarClock, CheckCircle2, CircleAlert, Zap } from "lucide-react";
import { toast } from "sonner";

import { ClassPermissionsPanel } from "@/components/ClassPermissionsPanel";

export const Route = createFileRoute("/_authenticated/classroom/$classId")({ component: ClassDetail });

function daysUntil(due: string) {
  const ms = new Date(due).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function DueBadge({ dueAt }: { dueAt: string | null }) {
  if (!dueAt) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">期限なし</span>;
  const d = daysUntil(dueAt);
  if (d < 0) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">期限切れ</span>;
  if (d === 0) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30">本日締切</span>;
  if (d <= 3) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30">残り{d}日</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">残り{d}日</span>;
}

function ClassDetail() {
  const { classId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [cls, setCls] = useState<any>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [mySubs, setMySubs] = useState<Record<string, any>>({});
  const [subCounts, setSubCounts] = useState<Record<string, number>>({});
  const [selectedAsg, setSelectedAsg] = useState<any>(null);
  const [tab, setTab] = useState("stream");

  const load = async () => {
    if (!user) return;
    const { data: c } = await supabase.from("classes").select("*").eq("id", classId).maybeSingle();
    setCls(c);
    const { data: mem } = await supabase.from("class_members").select("user_id, role, joined_at").eq("class_id", classId);
    const userIds = (mem ?? []).map((m) => m.user_id);
    const { data: profs } = userIds.length > 0
      ? { data: await fetchPublicProfiles(userIds) }
      : { data: [] as any[] };
    const pMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const enriched = (mem ?? []).map((m) => ({ ...m, profile: pMap.get(m.user_id) }));
    setMembers(enriched);
    const myRole = enriched.find((m) => m.user_id === user.id)?.role;
    const teacher = myRole === "teacher" || c?.owner_id === user.id;
    setIsTeacher(teacher);
    // quiz_answer_key は生徒から読めない列なので明示的に除外して取得する
    const { data: asg } = await supabase.from("assignments")
      .select("id, class_id, created_by, title, description, due_at, max_points, xp_mode, fixed_xp, attachments, allowed_file_types, kind, quiz_questions, created_at, updated_at")
      .eq("class_id", classId).order("created_at", { ascending: false });
    setAssignments(asg ?? []);

    const asgIds = (asg ?? []).map((a: any) => a.id);
    if (asgIds.length > 0) {
      if (teacher) {
        const { data: subs } = await supabase.from("submissions").select("assignment_id").in("assignment_id", asgIds);
        const counts: Record<string, number> = {};
        (subs ?? []).forEach((s: any) => { counts[s.assignment_id] = (counts[s.assignment_id] ?? 0) + 1; });
        setSubCounts(counts);
      } else {
        const { data: subs } = await supabase.from("submissions").select("*").eq("user_id", user.id).in("assignment_id", asgIds);
        const map: Record<string, any> = {};
        (subs ?? []).forEach((s: any) => { map[s.assignment_id] = s; });
        setMySubs(map);
      }
    } else {
      setSubCounts({}); setMySubs({});
    }
  };
  useEffect(() => { load(); }, [classId, user]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return assignments
      .filter((a) => a.due_at && new Date(a.due_at).getTime() - now < 7 * 24 * 60 * 60 * 1000 && new Date(a.due_at).getTime() > now - 24 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
      .slice(0, 4);
  }, [assignments]);

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
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      <Link to="/classroom" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" />クラス一覧</Link>

      <Card className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2 flex-wrap">
              <GraduationCap className="h-7 w-7 text-primary shrink-0" />
              <span className="truncate">{cls.name}</span>
              {isTeacher && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 border border-amber-500/30 flex items-center gap-1">
                  <Crown className="h-3 w-3" />教師
                </span>
              )}
            </h1>
            {cls.description && <p className="text-muted-foreground text-sm mt-1 whitespace-pre-wrap">{cls.description}</p>}
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
              <Users className="h-3 w-3" />メンバー {members.length}人
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={copyCode} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 text-sm font-mono hover:bg-muted">
              <Copy className="h-3 w-3" />{cls.invite_code}
            </button>
            <Button variant="outline" size="sm" onClick={leaveOrDelete}>
              <Trash2 className="h-3 w-3 mr-1" />{cls.owner_id === user?.id ? "クラス削除" : "退会"}
            </Button>
          </div>
        </div>

        {isTeacher && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button size="sm" variant="secondary" onClick={() => setTab("stream")}><Megaphone className="h-3 w-3 mr-1" />お知らせ</Button>
            <Button size="sm" variant="secondary" onClick={() => setTab("assignments")}><BookOpen className="h-3 w-3 mr-1" />課題を管理</Button>
            <Button size="sm" variant="secondary" onClick={() => setTab("members")}><Users className="h-3 w-3 mr-1" />メンバー管理</Button>
            <Button size="sm" variant="secondary" onClick={() => setTab("permissions")}><ShieldCheck className="h-3 w-3 mr-1" />権限設定</Button>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-2"><CalendarClock className="h-4 w-4 text-primary" />今週の予定・締切</div>
        {upcoming.length === 0 && <p className="text-xs text-muted-foreground">今週の締切はありません</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {upcoming.map((a) => {
            const submitted = isTeacher ? undefined : !!mySubs[a.id];
            return (
              <button key={a.id} onClick={() => { setTab("assignments"); setSelectedAsg(a); }} className="text-left p-2.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition space-y-1">
                <div className="text-xs font-medium truncate flex items-center gap-1">
                  {a.kind === "quiz" ? <ListChecks className="h-3 w-3 text-primary shrink-0" /> : <FileText className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <span className="truncate">{a.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <DueBadge dueAt={a.due_at} />
                  {!isTeacher && (submitted ? (
                    <span className="text-[10px] text-emerald-600 flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" />提出済</span>
                  ) : (
                    <span className="text-[10px] text-destructive flex items-center gap-0.5"><CircleAlert className="h-3 w-3" />未提出</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto">
          <TabsList className="flex-nowrap h-auto w-max min-w-full md:w-auto">
            <TabsTrigger value="stream" className="whitespace-nowrap"><Megaphone className="h-3 w-3 mr-1" />ストリーム</TabsTrigger>
            <TabsTrigger value="assignments" className="whitespace-nowrap"><BookOpen className="h-3 w-3 mr-1" />課題</TabsTrigger>
            <TabsTrigger value="files" className="whitespace-nowrap"><FolderOpen className="h-3 w-3 mr-1" />共有フォルダー</TabsTrigger>
            <TabsTrigger value="chat" className="whitespace-nowrap"><MessageSquare className="h-3 w-3 mr-1" />チャット</TabsTrigger>
            <TabsTrigger value="members" className="whitespace-nowrap"><Users className="h-3 w-3 mr-1" />メンバー ({members.length})</TabsTrigger>
            {isTeacher && <TabsTrigger value="logs" className="whitespace-nowrap"><ClipboardCheck className="h-3 w-3 mr-1" />生徒の学習記録</TabsTrigger>}
            {isTeacher && <TabsTrigger value="permissions" className="whitespace-nowrap"><ShieldCheck className="h-3 w-3 mr-1" />権限</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="stream" className="space-y-3 mt-4">
          <Stream classId={classId} isTeacher={isTeacher} members={members} />
        </TabsContent>

        <TabsContent value="assignments" className="space-y-3 mt-4">
          {isTeacher && <CreateAssignment classId={classId} onCreated={load} />}
          {assignments.length === 0 && <Card className="p-6 text-center text-muted-foreground text-sm">課題はまだありません</Card>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assignments.map((a) => {
              const submitted = !!mySubs[a.id];
              const count = subCounts[a.id] ?? 0;
              return (
                <Card key={a.id} className="p-4 hover:shadow-md transition cursor-pointer" onClick={() => setSelectedAsg(a)}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {a.kind === "quiz" ? <ListChecks className="h-4 w-4 text-primary shrink-0" /> : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <div className="font-semibold truncate">{a.title}</div>
                    </div>
                    <DueBadge dueAt={a.due_at} />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 whitespace-pre-wrap">{a.description}</p>
                  <div className="flex items-center justify-between text-xs mt-2 flex-wrap gap-1">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">配点 {a.max_points}</span>
                    {isTeacher ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Zap className="h-3 w-3" />提出者 {count}/{members.length}人
                      </span>
                    ) : submitted ? (
                      <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" />提出済</span>
                    ) : (
                      <span className="flex items-center gap-1 text-destructive"><CircleAlert className="h-3 w-3" />未提出</span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <FilesTab classId={classId} isTeacher={isTeacher} userId={user?.id} />
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <ClassChatTab classId={classId} userId={user?.id} />
        </TabsContent>
        <TabsContent value="members" className="mt-4">
          <Card className="p-0 overflow-hidden overflow-x-auto">
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
import { fetchPublicProfiles } from "@/lib/public-profiles";
