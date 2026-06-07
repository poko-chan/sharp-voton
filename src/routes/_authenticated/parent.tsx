import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyChildren, linkChildAccount, unlinkChild, updateChildProfile, getChildSummary } from "@/lib/parent.functions";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Users, Link2, Trash2, Ban } from "lucide-react";
import { toast } from "sonner";
import { SERVICES } from "@/lib/restriction-context";

export const Route = createFileRoute("/_authenticated/parent")({ component: ParentPage });

function ParentPage() {
  const { accountKind } = useAuth();
  const list = useServerFn(listMyChildren);
  const link = useServerFn(linkChildAccount);
  const unlink = useServerFn(unlinkChild);
  const [children, setChildren] = useState<any[]>([]);
  const [uname, setUname] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => setChildren(await list() as any[]);
  useEffect(() => { reload(); }, []);

  if (accountKind !== "parent") {
    return <div className="p-8 max-w-2xl mx-auto">
      <Card className="p-6 text-sm text-muted-foreground">このページは保護者アカウント専用です。</Card>
    </div>;
  }

  const onLink = async () => {
    if (!uname || !pw) return toast.error("ユーザー名とパスワードを入力");
    setBusy(true);
    try {
      await link({ data: { username: uname.trim(), password: pw } });
      toast.success("子供アカウントとリンクしました");
      setUname(""); setPw("");
      reload();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2"><Users /> 保護者ダッシュボード</h1>

      <Card className="p-6 space-y-3">
        <div className="font-semibold flex items-center gap-2"><Link2 className="h-4 w-4" /> 子供アカウントをリンク</div>
        <p className="text-xs text-muted-foreground">お子様のユーザー名とパスワードを入力すると、認証成功時に紐づけられます。</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1"><Label>ユーザー名</Label><Input value={uname} onChange={(e) => setUname(e.target.value)} /></div>
          <div className="space-y-1"><Label>パスワード</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        </div>
        <Button onClick={onLink} disabled={busy}>リンクする</Button>
      </Card>

      {children.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">リンクされた子供アカウントはまだありません。</Card>
      ) : children.map((c) => (
        <ChildPanel key={c.id} child={c} onChange={reload} unlink={unlink} />
      ))}
    </div>
  );
}

function ChildPanel({ child, onChange, unlink }: any) {
  const updateProfile = useServerFn(updateChildProfile);
  const summary = useServerFn(getChildSummary);
  const [name, setName] = useState(child.display_name ?? "");
  const [data, setData] = useState<any>(null);
  useEffect(() => { summary({ data: { childId: child.id } }).then(setData).catch(() => {}); }, [child.id]);

  const save = async () => {
    try { await updateProfile({ data: { childId: child.id, display_name: name.trim() } }); toast.success("保存しました"); }
    catch (e: any) { toast.error(e.message); }
  };
  const unlinkChild = async () => {
    if (!confirm("リンクを解除しますか？")) return;
    await unlink({ data: { childId: child.id } });
    toast.success("解除しました"); onChange();
  };

  const total = (data?.logs ?? []).reduce((s: number, r: any) => s + (r.duration_minutes ?? 0), 0);

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          {child.avatar_url ? <AvatarImage src={child.avatar_url} /> : null}
          <AvatarFallback>{(child.display_name ?? "U").slice(0,1)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{child.display_name || child.username}</div>
          <div className="text-xs text-muted-foreground truncate">@{child.username} · {child.email}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={unlinkChild}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">プロフィール</TabsTrigger>
          <TabsTrigger value="restrict"><Ban className="h-3 w-3 mr-1" /> 利用制限</TabsTrigger>
          <TabsTrigger value="study">学習状況</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="space-y-2 pt-3">
          <Label>表示名</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" onClick={save}>保存</Button>
        </TabsContent>
        <TabsContent value="restrict" className="space-y-2 pt-3">
          <ChildRestrictions childId={child.id} />
        </TabsContent>
        <TabsContent value="study" className="space-y-2 pt-3">
          <div className="text-sm">直近30日の合計学習時間: <b>{total}</b> 分</div>
          <div className="max-h-72 overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40"><tr><th className="text-left p-2">日付</th><th className="text-left p-2">分</th><th className="text-left p-2">内容</th></tr></thead>
              <tbody>
                {(data?.logs ?? []).map((r: any, i: number) => (
                  <tr key={i} className="border-t"><td className="p-2">{r.date}</td><td className="p-2">{r.duration_minutes}</td><td className="p-2">{r.content ?? ""}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function ChildRestrictions({ childId }: { childId: string }) {
  const [rows, setRows] = useState<Record<string, boolean>>({});
  useEffect(() => {
    supabase.from("user_service_restrictions").select("service_key, restricted").eq("user_id", childId)
      .then(({ data }) => {
        const m: Record<string, boolean> = {};
        for (const r of data ?? []) m[r.service_key] = !!r.restricted;
        setRows(m);
      });
  }, [childId]);
  const toggle = async (key: string, v: boolean) => {
    setRows((r) => ({ ...r, [key]: v }));
    await supabase.from("user_service_restrictions").upsert({ user_id: childId, service_key: key, restricted: v }, { onConflict: "user_id,service_key" });
    toast.success(v ? "利用停止しました" : "解除しました");
  };
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {SERVICES.map((s) => (
        <div key={s.key} className="flex items-center justify-between rounded border p-2">
          <span className="text-sm">{s.label}</span>
          <Switch checked={!!rows[s.key]} onCheckedChange={(v) => toggle(s.key, v)} />
        </div>
      ))}
    </div>
  );
}