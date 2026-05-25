import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { GraduationCap, Plus, LogIn, Users, Crown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/classroom/")({ component: ClassroomList });

type ClassRow = { id: string; name: string; description: string | null; invite_code: string; owner_id: string };

function ClassroomList() {
  const { user } = useAuth();
  const create = useServerFn(createClass);
  const join = useServerFn(joinClass);
  const [classes, setClasses] = useState<(ClassRow & { role: string; memberCount: number })[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [code, setCode] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [openJoin, setOpenJoin] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: mem } = await supabase.from("class_members").select("class_id, role").eq("user_id", user.id);
    const ids = (mem ?? []).map((m) => m.class_id);
    if (ids.length === 0) { setClasses([]); return; }
    const { data: cls } = await supabase.from("classes").select("*").in("id", ids);
    const { data: counts } = await supabase.from("class_members").select("class_id").in("class_id", ids);
    const countMap = new Map<string, number>();
    (counts ?? []).forEach((c) => countMap.set(c.class_id, (countMap.get(c.class_id) ?? 0) + 1));
    const roleMap = new Map((mem ?? []).map((m) => [m.class_id, m.role]));
    setClasses((cls ?? []).map((c: any) => ({ ...c, role: roleMap.get(c.id) ?? "student", memberCount: countMap.get(c.id) ?? 0 })));
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

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><GraduationCap className="h-7 w-7 text-primary" />Voton Classroom</h1>
          <p className="text-muted-foreground text-sm">クラスを作って課題を出したり、招待コードで参加しよう</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openJoin} onOpenChange={setOpenJoin}>
            <DialogTrigger asChild><Button variant="outline"><LogIn className="h-4 w-4 mr-2" />招待コードで参加</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>クラスに参加</DialogTitle></DialogHeader>
              <Label>招待コード</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="例: ABC123" maxLength={12} />
              <Button onClick={submitJoin} className="w-full mt-2">参加</Button>
            </DialogContent>
          </Dialog>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />クラスを作成</Button></DialogTrigger>
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

      {classes.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">
          まだクラスがありません。作成するか招待コードで参加しよう。
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((c) => (
          <Link key={c.id} to="/classroom/$classId" params={{ classId: c.id }}>
            <Card className="p-5 hover:shadow-md transition cursor-pointer h-full">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-lg truncate">{c.name}</div>
                {(c.role === "teacher" || c.owner_id === user?.id) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 border border-amber-500/30 flex items-center gap-1">
                    <Crown className="h-3 w-3" />教師
                  </span>
                )}
              </div>
              {c.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.description}</p>}
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.memberCount}人</span>
                <span className="font-mono px-2 py-0.5 rounded bg-muted">{c.invite_code}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
