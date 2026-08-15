import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Trash2, Save, Plus } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_PERMS, GROUP_PERMS, loadOrgProfiles, nameOf, useOrg } from "@/lib/org-apps";
import { ROLE_LABEL } from "@/lib/org-roles";
import { OrgChat } from "@/components/org/OrgChat";

export const Route = createFileRoute("/_authenticated/organizations/$orgId/group/$groupId")({ component: GroupPage });

function GroupPage() {
  const { orgId, groupId } = Route.useParams();
  const isNew = groupId === "new";
  const ctx = useOrg(orgId);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<any>(null);
  const [perms, setPerms] = useState<Record<string, boolean>>(DEFAULT_PERMS);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [members, setMembers] = useState<any[]>([]);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [picked, setPicked] = useState<Record<string, string>>({});

  const load = async () => {
    const { data: om } = await (supabase as any).from("organization_members").select("user_id, role").eq("organization_id", orgId);
    setOrgMembers(om ?? []);
    setProfiles(await loadOrgProfiles(orgId, (om ?? []).map((m: any) => m.user_id)));
    if (isNew) return;
    const { data: g } = await (supabase as any).from("org_groups").select("*").eq("id", groupId).maybeSingle();
    if (g) { setGroup(g); setName(g.name); setDesc(g.description ?? ""); setColor(g.color); setPerms({ ...DEFAULT_PERMS, ...(g.perms ?? {}) }); }
    const { data: gm } = await (supabase as any).from("org_group_members").select("*").eq("group_id", groupId);
    setMembers(gm ?? []);
  };
  useEffect(() => { load(); }, [orgId, groupId]);

  if (ctx.loading) return <div className="p-6 text-sm text-muted-foreground">読み込み中…</div>;
  const canEdit = isNew ? ctx.isStaff : (ctx.canAdmin || group?.leader_id === user?.id);
  if (!canEdit) return (
    <div className="p-6 text-sm text-muted-foreground space-y-2">
      <div>このグループを管理する権限がありません。</div>
      <Link to="/organizations/$orgId" params={{ orgId }} className="underline">← 組織ホームへ</Link>
    </div>
  );

  const create = async () => {
    if (!name.trim()) return toast.error("グループ名を入力してください");
    const memberList = Object.entries(picked).map(([user_id, role]) => ({ user_id, role }));
    const { data, error } = await (supabase as any).rpc("org_create_group", {
      _org: orgId, _name: name.trim(), _description: desc || null, _color: color, _perms: perms, _members: memberList,
    });
    if (error) return toast.error(error.message);
    toast.success("グループを作成しました");
    ctx.reload();
    navigate({ to: "/organizations/$orgId/group/$groupId", params: { orgId, groupId: data } });
  };

  const save = async () => {
    const { error } = await (supabase as any).from("org_groups")
      .update({ name, description: desc || null, color, perms }).eq("id", groupId);
    if (error) return toast.error(error.message);
    toast.success("保存しました"); ctx.reload(); load();
  };

  const addMember = async (userId: string, role = "member") => {
    const { error } = await (supabase as any).from("org_group_members").insert({ group_id: groupId, user_id: userId, role });
    if (error) return toast.error(error.message);
    load();
  };

  const PermList = (
    <div className="space-y-2">
      {GROUP_PERMS.map((p) => (
        <label key={p.key} className="flex items-center gap-2 text-sm border rounded p-2">
          <span className="text-[10px] px-1.5 rounded bg-muted">{p.app}</span>
          <span className="flex-1">{p.label}</span>
          <Switch checked={!!perms[p.key]} onCheckedChange={(v) => setPerms((s) => ({ ...s, [p.key]: v }))} />
        </label>
      ))}
      <p className="text-[11px] text-muted-foreground">教師以上の権限を持つ人は、この設定にかかわらず操作できます。</p>
    </div>
  );

  const Basics = (
    <div className="space-y-2">
      <Input placeholder="グループ名（例: 1年C組、野球部）" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea rows={2} placeholder="説明（任意）" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <div className="flex items-center gap-2 text-sm">色 <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-14 rounded" /></div>
    </div>
  );

  if (isNew) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Link to="/organizations/$orgId" params={{ orgId }} className="text-sm underline text-muted-foreground">← 組織ホームへ</Link>
        <h1 className="text-xl font-bold flex items-center gap-2"><Users className="h-5 w-5 text-sky-600" />グループを作成</h1>
        <Card className="p-4 space-y-3">{Basics}</Card>
        <Card className="p-4 space-y-2">
          <div className="font-bold text-sm">1. メンバーと権限を選ぶ</div>
          <div className="max-h-64 overflow-auto space-y-1">
            {orgMembers.filter((m) => m.user_id !== user?.id).map((m) => (
              <div key={m.user_id} className="flex items-center gap-2 border rounded p-2 text-sm">
                <div className="flex-1">{nameOf(profiles[m.user_id])} <span className="text-[10px] px-1.5 rounded bg-muted">{ROLE_LABEL[m.role] ?? m.role}</span></div>
                <Select value={picked[m.user_id] ?? "none"} onValueChange={(v) => setPicked((p) => {
                  const n = { ...p }; if (v === "none") delete n[m.user_id]; else n[m.user_id] = v; return n;
                })}>
                  <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">追加しない</SelectItem>
                    <SelectItem value="member">一般</SelectItem>
                    <SelectItem value="admin">共同管理者</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="font-bold text-sm">2. アプリごとの権限</div>
          {PermList}
        </Card>
        <Button onClick={create}><Plus className="h-4 w-4 mr-1" />作成する</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <Link to="/organizations/$orgId" params={{ orgId }} className="text-sm underline text-muted-foreground">← 組織ホームへ</Link>
      <h1 className="text-xl font-bold flex items-center gap-2">
        <span className="inline-block h-4 w-4 rounded" style={{ background: color }} />{group?.name} の管理
      </h1>
      <Tabs defaultValue="members">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="members">メンバー ({members.length})</TabsTrigger>
          <TabsTrigger value="perms">権限</TabsTrigger>
          <TabsTrigger value="settings">基本設定</TabsTrigger>
          <TabsTrigger value="chat">チャット閲覧</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-2">
          {members.map((m) => (
            <Card key={m.id} className="p-3 flex items-center gap-2 text-sm">
              <div className="flex-1">{nameOf(profiles[m.user_id])}</div>
              <Select value={m.role} onValueChange={async (v) => {
                await (supabase as any).from("org_group_members").update({ role: v }).eq("id", m.id); load();
              }}>
                <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">一般</SelectItem>
                  <SelectItem value="admin">共同管理者</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                await (supabase as any).from("org_group_members").delete().eq("id", m.id); load();
              }}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
          <Card className="p-3 space-y-1">
            <div className="text-sm font-bold">メンバーを追加</div>
            <div className="max-h-56 overflow-auto space-y-1">
              {orgMembers.filter((om) => !members.some((m) => m.user_id === om.user_id)).map((om) => (
                <div key={om.user_id} className="flex items-center gap-2 border rounded p-2 text-sm">
                  <div className="flex-1">{nameOf(profiles[om.user_id])}</div>
                  <Button size="sm" variant="outline" onClick={() => addMember(om.user_id)}>追加</Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="perms" className="space-y-2">
          {PermList}
          <Button onClick={save}><Save className="h-4 w-4 mr-1" />保存</Button>
        </TabsContent>

        <TabsContent value="settings" className="space-y-2">
          <Card className="p-4 space-y-2">
            {Basics}
            <div className="flex gap-2">
              <Button onClick={save}><Save className="h-4 w-4 mr-1" />保存</Button>
              <Button variant="ghost" className="text-destructive" onClick={async () => {
                if (!confirm("グループを削除しますか？")) return;
                const { error } = await (supabase as any).from("org_groups").delete().eq("id", groupId);
                if (error) return toast.error(error.message);
                ctx.reload(); navigate({ to: "/organizations/$orgId", params: { orgId } });
              }}><Trash2 className="h-4 w-4 mr-1" />グループを削除</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <p className="text-xs text-muted-foreground mb-2">教師以上の権限を持つ人は、グループのチャット内容を閲覧できます。</p>
          <OrgChat orgId={orgId} ctx={ctx} moderateGroupId={groupId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
