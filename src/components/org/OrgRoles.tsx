import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ORG_APPS, loadOrgProfiles, type OrgRolePerms } from "@/lib/org-apps";
import { ShieldCheck, Plus, Trash2, Save } from "lucide-react";

const MANAGE = [
  ["members", "メンバー管理"],
  ["requests", "参加申請"],
  ["invite", "招待"],
  ["stats", "学習統計"],
  ["assignments", "課題"],
  ["content", "問題集・クラス"],
  ["profile-fields", "プロフィール項目"],
  ["roster", "名簿"],
  ["restrictions", "アプリ制限"],
  ["apps", "アプリ管理"],
  ["settings", "組織設定"],
] as const;

const BASE = [
  ["member", "一般（生徒）"],
  ["teacher", "教師"],
  ["admin", "共同管理者"],
] as const;

const LEVEL = [
  ["none", "使えない"],
  ["view", "見るだけ"],
  ["edit", "編集もできる"],
] as const;

export function OrgRoles({ orgId }: { orgId: string }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState<any>(null);

  const load = async () => {
    const [{ data: r }, { data: m }] = await Promise.all([
      (supabase as any).from("org_custom_roles").select("*").eq("organization_id", orgId).order("sort_order"),
      (supabase as any)
        .from("organization_members")
        .select("user_id, role, custom_role_id")
        .eq("organization_id", orgId),
    ]);
    setRoles(r ?? []);
    setMembers(m ?? []);
    setNames(await loadOrgProfiles(orgId, (m ?? []).map((x: any) => x.user_id)));
  };
  useEffect(() => {
    load();
  }, [orgId]);

  const save = async () => {
    if (!editing?.name?.trim()) return toast.error("名前を入力してください");
    const payload = {
      organization_id: orgId,
      name: editing.name.trim(),
      color: editing.color,
      base_role: editing.base_role,
      permissions: editing.permissions,
    };
    const { error } = editing.id
      ? await (supabase as any).from("org_custom_roles").update(payload).eq("id", editing.id)
      : await (supabase as any).from("org_custom_roles").insert(payload);
    if (error) return toast.error(error.message);
    // 基本レベルを変えた場合、割り当て済みメンバーにも反映
    if (editing.id)
      for (const m of members.filter((x) => x.custom_role_id === editing.id))
        await (supabase as any).rpc("org_assign_custom_role", { _org: orgId, _user: m.user_id, _role: editing.id });
    toast.success("保存しました");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("この権限を削除しますか？割り当て中のメンバーは一般に戻ります。")) return;
    for (const m of members.filter((x) => x.custom_role_id === id))
      await (supabase as any).rpc("org_assign_custom_role", { _org: orgId, _user: m.user_id, _role: null });
    await (supabase as any).from("org_custom_roles").delete().eq("id", id);
    load();
  };

  const assign = async (userId: string, roleId: string) => {
    const { error } = await (supabase as any).rpc("org_assign_custom_role", {
      _org: orgId,
      _user: userId,
      _role: roleId || null,
    });
    if (error) return toast.error(error.message);
    toast.success("割り当てました");
    load();
  };

  const perms: OrgRolePerms = editing?.permissions ?? {};
  const setPerms = (p: OrgRolePerms) => setEditing({ ...editing, permissions: { ...perms, ...p } });

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">
      <Link to="/organizations/$orgId" params={{ orgId }} className="text-sm underline text-muted-foreground">
        ← 組織ホームへ
      </Link>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold flex-1">権限（役職）</h1>
        <Button
          size="sm"
          onClick={() =>
            setEditing({ name: "", color: "#6366f1", base_role: "member", permissions: { manage: [], apps: {} } })
          }
        >
          <Plus className="h-4 w-4 mr-1" />
          新しい権限
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        「所有者」「一般」のほかに、名前つきの権限（例：学年主任、図書委員）を作れます。作成と割り当ては所有者だけができます。
      </p>

      {editing && (
        <Card className="p-4 space-y-4 border-primary/50">
          <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
            <div>
              <label className="text-xs">名前</label>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs">色</label>
              <Input
                type="color"
                className="w-16 p-1"
                value={editing.color}
                onChange={(e) => setEditing({ ...editing, color: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs">基本レベル</label>
              <select
                className="h-10 rounded-md border bg-background px-2 text-sm"
                value={editing.base_role}
                onChange={(e) => setEditing({ ...editing, base_role: e.target.value })}
              >
                {BASE.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="text-sm font-bold mb-2">アプリごとの利用</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {ORG_APPS.map((a) => (
                <div key={a.key} className="flex items-center gap-2 text-sm border rounded p-2">
                  <span className="flex-1 truncate">{a.label}</span>
                  <select
                    className="h-8 rounded border bg-background px-1 text-xs"
                    value={perms.apps?.[a.key] ?? "edit"}
                    onChange={(e) => setPerms({ apps: { ...(perms.apps ?? {}), [a.key]: e.target.value as any } })}
                  >
                    {LEVEL.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-bold mb-2">使える管理メニュー</div>
            <div className="flex flex-wrap gap-2">
              {MANAGE.map(([k, l]) => {
                const on = (perms.manage ?? []).includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      setPerms({
                        manage: on ? (perms.manage ?? []).filter((x) => x !== k) : [...(perms.manage ?? []), k],
                      })
                    }
                    className={`text-xs px-3 py-1.5 rounded-full border ${on ? "bg-primary text-primary-foreground border-primary" : ""}`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              ※ データの変更は基本レベルが「共同管理者」の場合に有効です。
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!perms.edu_author} onCheckedChange={(v) => setPerms({ edu_author: v })} />
            Makron for education で問題作成・配布ができる
          </label>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setEditing(null)}>
              キャンセル
            </Button>
            <Button onClick={save}>
              <Save className="h-4 w-4 mr-1" />
              保存
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-2">
        {roles.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">まだ権限はありません</Card>
        )}
        {roles.map((r) => (
          <Card key={r.id} className="p-3 flex items-center gap-3">
            <span className="h-4 w-4 rounded-full" style={{ background: r.color }} />
            <div className="flex-1">
              <div className="font-bold">{r.name}</div>
              <div className="text-xs text-muted-foreground">
                {BASE.find((b) => b[0] === r.base_role)?.[1]} ・{" "}
                {members.filter((m) => m.custom_role_id === r.id).length}人
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing({ ...r, permissions: r.permissions ?? {} })}>
              編集
            </Button>
            <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-bold mb-2">メンバーへの割り当て</h2>
        <Card className="divide-y">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-2 p-2 text-sm">
              <span className="flex-1 truncate">
                {names[m.user_id]?.display_name ?? names[m.user_id]?.username ?? "ユーザー"}
              </span>
              {m.role === "owner" ? (
                <span className="text-xs text-muted-foreground">所有者</span>
              ) : (
                <select
                  className="h-8 rounded border bg-background px-1 text-xs"
                  value={m.custom_role_id ?? ""}
                  onChange={(e) => assign(m.user_id, e.target.value)}
                >
                  <option value="">一般</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
