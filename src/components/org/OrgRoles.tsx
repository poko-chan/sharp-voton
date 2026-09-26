import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ORG_APPS, loadOrgProfiles, nameOf, useOrg, type OrgRolePerms } from "@/lib/org-apps";
import { MANAGE_SECTIONS, ORG_PRESETS } from "@/lib/org-presets";
import { Copy, Eye, Plus, Save, ShieldCheck, Trash2, Users } from "lucide-react";

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

const PALETTE = ["#6366f1", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6"];

export function OrgRoles({ orgId }: { orgId: string }) {
  const { isOwner, canManage } = useOrg(orgId);
  const allowed = isOwner || canManage("roles");
  const [roles, setRoles] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, any>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [preview, setPreview] = useState(false);

  const load = async () => {
    const [{ data: r }, { data: m }] = await Promise.all([
      (supabase as any)
        .from("org_custom_roles")
        .select("*")
        .eq("organization_id", orgId)
        .order("sort_order"),
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

  const openRole = (r: any) => {
    setSelected(r.id ?? "new");
    setDraft({ ...r, permissions: r.permissions ?? { manage: [], apps: {} } });
    setPreview(false);
  };

  const newRole = () =>
    openRole({
      name: "",
      color: PALETTE[roles.length % PALETTE.length],
      base_role: "member",
      permissions: { manage: [], apps: {} },
    });

  const save = async () => {
    if (!draft?.name?.trim()) return toast.error("役職名を入力してください");
    const payload = {
      organization_id: orgId,
      name: draft.name.trim(),
      color: draft.color,
      base_role: draft.base_role,
      permissions: draft.permissions,
    };
    const { error } = draft.id
      ? await (supabase as any).from("org_custom_roles").update(payload).eq("id", draft.id)
      : await (supabase as any).from("org_custom_roles").insert(payload);
    if (error) return toast.error(error.message);
    if (draft.id)
      for (const m of members.filter((x) => x.custom_role_id === draft.id))
        await (supabase as any).rpc("org_assign_custom_role", {
          _org: orgId,
          _user: m.user_id,
          _role: draft.id,
        });
    toast.success("保存しました");
    setSelected(null);
    setDraft(null);
    load();
  };

  const duplicate = async (r: any) => {
    const { error } = await (supabase as any).from("org_custom_roles").insert({
      organization_id: orgId,
      name: `${r.name} のコピー`,
      color: r.color,
      base_role: r.base_role,
      permissions: r.permissions ?? {},
    });
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("この役職を削除しますか？割り当て中のメンバーは一般に戻ります。")) return;
    for (const m of members.filter((x) => x.custom_role_id === id))
      await (supabase as any).rpc("org_assign_custom_role", {
        _org: orgId,
        _user: m.user_id,
        _role: null,
      });
    await (supabase as any).from("org_custom_roles").delete().eq("id", id);
    if (selected === id) setSelected(null);
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

  const addPresetRoles = async () => {
    const all = ORG_PRESETS.flatMap((p) => p.roles);
    const have = new Set(roles.map((r) => r.name));
    const uniq: any[] = [];
    for (const r of all)
      if (!have.has(r.name) && !uniq.some((x) => x.name === r.name))
        uniq.push({ organization_id: orgId, ...r });
    if (!uniq.length) return toast.info("追加できるひな形はありません");
    const { error } = await (supabase as any).from("org_custom_roles").insert(uniq);
    if (error) return toast.error(error.message);
    toast.success(`${uniq.length}件のひな形を追加しました`);
    load();
  };

  const perms: OrgRolePerms = draft?.permissions ?? {};
  const setPerms = (p: OrgRolePerms) =>
    setDraft({ ...draft, permissions: { ...perms, ...p } });

  const memberCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of members) if (m.custom_role_id) map[m.custom_role_id] = (map[m.custom_role_id] ?? 0) + 1;
    return map;
  }, [members]);

  if (!allowed)
    return (
      <div className="p-6 text-sm text-muted-foreground">この画面を開く権限がありません。</div>
    );

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-4">
      <Link to="/organizations/$orgId" params={{ orgId }} className="text-sm underline text-muted-foreground">
        ← 組織ホームへ
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold flex-1">役職・権限マネージャー</h1>
        <Button size="sm" variant="outline" onClick={addPresetRoles}>
          ひな形から追加
        </Button>
        <Button size="sm" onClick={newRole}>
          <Plus className="h-4 w-4 mr-1" />
          新しい役職
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[19rem_1fr]">
        {/* 左：役職一覧 */}
        <div className="space-y-3">
          <Card className="divide-y overflow-hidden">
            {roles.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                まだ役職はありません
              </div>
            )}
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => openRole(r)}
                className={`w-full flex items-center gap-3 p-3 text-left transition hover:bg-muted/60 ${
                  selected === r.id ? "bg-primary/10" : ""
                }`}
              >
                <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ background: r.color }} />
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-sm truncate">{r.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {BASE.find((b) => b[0] === r.base_role)?.[1]}・{memberCount[r.id] ?? 0}人
                  </span>
                </span>
              </button>
            ))}
          </Card>

          <Card className="p-3 space-y-2">
            <div className="text-xs font-bold flex items-center gap-1 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              メンバーへの割り当て
            </div>
            <div className="max-h-80 overflow-y-auto divide-y">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="flex-1 truncate">{nameOf(names[m.user_id], "ユーザー")}</span>
                  {m.role === "owner" ? (
                    <span className="text-xs text-muted-foreground">所有者</span>
                  ) : (
                    <select
                      className="h-8 rounded border bg-background px-1 text-xs max-w-[9rem]"
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
            </div>
          </Card>
        </div>

        {/* 右：編集エリア */}
        {draft ? (
          <Card className="p-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] items-end">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">役職名</label>
                <Input
                  value={draft.name}
                  placeholder="例：学級担任"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">色</label>
                <div className="flex gap-1">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDraft({ ...draft, color: c })}
                      className={`h-7 w-7 rounded-full border-2 ${
                        draft.color === c ? "border-foreground" : "border-transparent"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">基本レベル</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                  value={draft.base_role}
                  onChange={(e) => setDraft({ ...draft, base_role: e.target.value })}
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
              <div className="text-sm font-bold mb-2">アプリごとの権限</div>
              <div className="overflow-hidden rounded-lg border">
                <div className="grid grid-cols-[1fr_repeat(3,5.5rem)] bg-muted/60 px-3 py-2 text-[11px] font-bold text-muted-foreground">
                  <span>アプリ</span>
                  {LEVEL.map(([, l]) => (
                    <span key={l} className="text-center">
                      {l}
                    </span>
                  ))}
                </div>
                <div className="divide-y">
                  {ORG_APPS.map((a) => {
                    const cur = perms.apps?.[a.key] ?? "edit";
                    return (
                      <div
                        key={a.key}
                        className="grid grid-cols-[1fr_repeat(3,5.5rem)] items-center px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ background: a.color }}
                          />
                          <span className="truncate">{a.label}</span>
                        </span>
                        {LEVEL.map(([v]) => (
                          <label key={v} className="flex justify-center">
                            <input
                              type="radio"
                              name={`app-${a.key}`}
                              checked={cur === v}
                              onChange={() =>
                                setPerms({ apps: { ...(perms.apps ?? {}), [a.key]: v as any } })
                              }
                            />
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-bold mb-2">管理メニューの許可</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {MANAGE_SECTIONS.map((s) => {
                  const on = (perms.manage ?? []).includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() =>
                        setPerms({
                          manage: on
                            ? (perms.manage ?? []).filter((x) => x !== s.key)
                            : [...(perms.manage ?? []), s.key],
                        })
                      }
                      className={`rounded-lg border p-2.5 text-left transition ${
                        on ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="text-sm font-bold">{s.label}</div>
                      <div className="text-[11px] text-muted-foreground">{s.desc}</div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                ※ データの変更は基本レベルが「共同管理者」の場合に有効です。
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={!!perms.edu_author}
                onCheckedChange={(v) => setPerms({ edu_author: v })}
              />
              Makron for education で問題作成・配布ができる
            </label>

            {preview && (
              <Card className="p-4 bg-muted/40 space-y-2">
                <div className="text-xs font-bold">この役職で見えるもの</div>
                <div className="flex flex-wrap gap-1.5">
                  {ORG_APPS.filter((a) => (perms.apps?.[a.key] ?? "edit") !== "none").map((a) => (
                    <span key={a.key} className="text-[11px] rounded-full border px-2 py-1">
                      {a.label}
                    </span>
                  ))}
                </div>
                <div className="text-xs font-bold pt-1">使える管理メニュー</div>
                <div className="flex flex-wrap gap-1.5">
                  {(perms.manage ?? []).length === 0 ? (
                    <span className="text-[11px] text-muted-foreground">なし</span>
                  ) : (
                    MANAGE_SECTIONS.filter((s) => (perms.manage ?? []).includes(s.key)).map((s) => (
                      <span
                        key={s.key}
                        className="text-[11px] rounded-full border border-primary/50 px-2 py-1 text-primary"
                      >
                        {s.label}
                      </span>
                    ))
                  )}
                </div>
              </Card>
            )}

            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="ghost" onClick={() => setPreview((p) => !p)}>
                <Eye className="h-4 w-4 mr-1" />
                {preview ? "プレビューを閉じる" : "この役職でプレビュー"}
              </Button>
              {draft.id && (
                <>
                  <Button variant="outline" onClick={() => duplicate(draft)}>
                    <Copy className="h-4 w-4 mr-1" />
                    複製
                  </Button>
                  <Button variant="ghost" onClick={() => remove(draft.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(null);
                  setSelected(null);
                }}
              >
                キャンセル
              </Button>
              <Button onClick={save}>
                <Save className="h-4 w-4 mr-1" />
                保存
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            左の一覧から役職を選ぶか、「新しい役職」で作成してください。
          </Card>
        )}
      </div>
    </div>
  );
}
