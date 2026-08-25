import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createClass, joinClass } from "@/lib/classroom.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Plus, LogIn, Users, Crown, Search, Copy, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/classroom/")({ component: ClassroomList });

type ClassRow = { id: string; name: string; description: string | null; invite_code: string; owner_id: string };

const ACCENTS = [
  "from-sky-500/80 to-blue-600/80",
  "from-emerald-500/80 to-teal-600/80",
  "from-amber-500/80 to-orange-600/80",
  "from-fuchsia-500/80 to-purple-600/80",
  "from-rose-500/80 to-pink-600/80",
  "from-indigo-500/80 to-violet-600/80",
];
function accentFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

function ClassroomList() {
  const { user } = useAuth();
  const create = useServerFn(createClass);
  const join = useServerFn(joinClass);
  const [classes, setClasses] = useState<(ClassRow & { role: string; memberCount: number; pending: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [code, setCode] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [openJoin, setOpenJoin] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "teacher" | "student">("all");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: mem } = await supabase.from("class_members").select("class_id, role").eq("user_id", user.id);
    const ids = (mem ?? []).map((m) => m.class_id);
    if (ids.length === 0) { setClasses([]); setLoading(false); return; }
    const { data: cls } = await supabase.from("classes").select("*").in("id", ids);
    const { data: counts } = await supabase.from("class_members").select("class_id").in("class_id", ids);
    const countMap = new Map<string, number>();
    (counts ?? []).forEach((c) => countMap.set(c.class_id, (countMap.get(c.class_id) ?? 0) + 1));
    const roleMap = new Map((mem ?? []).map((m) => [m.class_id, m.role]));

    // 未提出課題バッジ（生徒として参加しているクラスのみ）
    const studentIds = ids.filter((id) => roleMap.get(id) !== "teacher" && (cls ?? []).find((c: any) => c.id === id)?.owner_id !== user.id);
    const pendingMap = new Map<string, number>();
    if (studentIds.length > 0) {
      const { data: asg } = await supabase.from("assignments").select("id, class_id").in("class_id", studentIds);
      const asgIds = (asg ?? []).map((a: any) => a.id);
      const { data: subs } = asgIds.length > 0
        ? await supabase.from("submissions").select("assignment_id").eq("user_id", user.id).in("assignment_id", asgIds)
        : { data: [] as any[] };
      const submittedSet = new Set((subs ?? []).map((s: any) => s.assignment_id));
      (asg ?? []).forEach((a: any) => {
        if (!submittedSet.has(a.id)) pendingMap.set(a.class_id, (pendingMap.get(a.class_id) ?? 0) + 1);
      });
    }

    setClasses((cls ?? []).map((c: any) => ({
      ...c,
      role: roleMap.get(c.id) ?? "student",
      memberCount: countMap.get(c.id) ?? 0,
      pending: pendingMap.get(c.id) ?? 0,
    })));
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const submitCreate = async () => {
    if (!name.trim()) return toast.error("クラス名を入力してください");
    try {
      await create({ data: { name: name.trim(), description: desc.trim() } });
      toast.success("クラスを作成しました");
      setName(""); setDesc(""); setOpenCreate(false); load();
    } catch (e: any) { toast.error(e.message); }
  };
  const submitJoin = async () => {
    if (!code.trim()) return;
    try {
      await join({ data: { code: code.trim() } });
      toast.success("クラスに参加しました");
      setCode(""); setOpenJoin(false); load();
    } catch (e: any) { toast.error(e.message); }
  };
  const copyCode = (e: React.MouseEvent, invCode: string) => {
    e.preventDefault(); e.stopPropagation();
    navigator.clipboard.writeText(invCode);
    toast.success("招待コードをコピーしました");
  };

  const filtered = useMemo(() => {
    return classes.filter((c) => {
      const isTeacher = c.role === "teacher" || c.owner_id === user?.id;
      if (filter === "teacher" && !isTeacher) return false;
      if (filter === "student" && isTeacher) return false;
      if (search.trim() && !c.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [classes, filter, search, user]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><GraduationCap className="h-7 w-7 text-primary" />Voton Classroom</h1>
          <p className="text-muted-foreground text-sm">クラスを作って課題を出したり、招待コードで参加しよう</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openJoin} onOpenChange={setOpenJoin}>
            <DialogTrigger asChild><Button variant="outline" size="lg"><LogIn className="h-4 w-4 mr-2" />参加する（コード）</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>クラスに参加</DialogTitle></DialogHeader>
              <Label>招待コード</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="例: ABC123" maxLength={12} />
              <Button onClick={submitJoin} className="w-full mt-2">参加</Button>
            </DialogContent>
          </Dialog>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild><Button size="lg"><Plus className="h-4 w-4 mr-2" />クラス作成</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>クラスを作成</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>クラス名</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></div>
                <div><Label>説明（任意）</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} /></div>
                <Button onClick={submitCreate} className="w-full">作成</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {classes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="クラス名で検索" className="pl-8" />
          </div>
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="teacher">担当</SelectItem>
              <SelectItem value="student">参加中</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {!loading && classes.length === 0 && (
        <Card className="p-12 text-center space-y-3">
          <Sparkles className="h-10 w-10 mx-auto text-primary/60" />
          <div className="font-semibold">まだクラスがありません</div>
          <p className="text-muted-foreground text-sm">クラスを作成するか、先生から受け取った招待コードで参加しましょう。</p>
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpenJoin(true)}><LogIn className="h-4 w-4 mr-2" />参加する</Button>
            <Button onClick={() => setOpenCreate(true)}><Plus className="h-4 w-4 mr-2" />クラス作成</Button>
          </div>
        </Card>
      )}

      {!loading && classes.length > 0 && filtered.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground text-sm">条件に一致するクラスがありません</Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => {
          const isTeacher = c.role === "teacher" || c.owner_id === user?.id;
          return (
            <Link key={c.id} to="/classroom/$classId" params={{ classId: c.id }}>
              <Card className="overflow-hidden hover:shadow-md transition cursor-pointer h-full p-0">
                <div className={`h-16 bg-gradient-to-r ${accentFor(c.id)} relative`}>
                  {isTeacher && (
                    <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-white/90 text-amber-600 flex items-center gap-1 font-medium">
                      <Crown className="h-3 w-3" />担当
                    </span>
                  )}
                </div>
                <div className="p-5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-lg truncate">{c.name}</div>
                    {c.pending > 0 && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />未提出{c.pending}
                      </span>
                    )}
                  </div>
                  {c.description && <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.memberCount}人</span>
                    {isTeacher ? (
                      <button
                        onClick={(e) => copyCode(e, c.invite_code)}
                        className="font-mono px-2 py-0.5 rounded bg-muted hover:bg-muted/70 flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" />{c.invite_code}
                      </button>
                    ) : (
                      <span className="font-mono px-2 py-0.5 rounded bg-muted">{c.invite_code}</span>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
