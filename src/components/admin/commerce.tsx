import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";

// ========== Organizations admin ==========
export function OrgsAdminTab() {
  const [pending, setPending] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const load = async () => {
    const { data: p } = await (supabase as any).from("organizations")
      .select("*, profile:profiles!organizations_created_by_fkey(username, display_name)")
      .eq("status", "pending").order("created_at", { ascending: false });
    setPending(p ?? []);
    const { data: a } = await (supabase as any).from("organizations").select("*").order("created_at", { ascending: false }).limit(50);
    setOrgs(a ?? []);
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!name.trim()) return;
    const { error } = await (supabase as any).from("organizations").insert({ name, description: desc || null, status: "approved" });
    if (error) return toast.error(error.message);
    setName(""); setDesc(""); toast.success("組織を作成しました"); load();
  };
  const review = async (id: string, approve: boolean) => {
    const { error } = await (supabase as any).rpc("admin_review_organization", { _org_id: id, _approve: approve });
    if (error) return toast.error(error.message);
    toast.success(approve ? "承認しました" : "却下しました"); load();
  };
  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4 space-y-2">
        <div className="font-bold flex items-center gap-1"><Plus className="h-4 w-4" />新規組織を作成（管理者のみ）</div>
        <Input placeholder="組織名" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea rows={2} placeholder="説明" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Button onClick={create}>作成</Button>
      </Card>
      {pending.length > 0 && (
        <Card className="p-3 space-y-2">
          <div className="font-bold">審査待ち ({pending.length})</div>
          {pending.map((o: any) => (
            <div key={o.id} className="flex items-center gap-2 border rounded p-2 text-sm">
              <div className="flex-1">
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-muted-foreground">{o.description} ・ 申請者 {o.profile?.display_name ?? o.profile?.username}</div>
              </div>
              <Button size="sm" onClick={() => review(o.id, true)}>承認</Button>
              <Button size="sm" variant="outline" onClick={() => review(o.id, false)}>却下</Button>
            </div>
          ))}
        </Card>
      )}
      <Card className="p-3 space-y-2">
        <div className="font-bold">既存組織</div>
        {orgs.map((o: any) => (
          <div key={o.id} className="flex items-center gap-2 border rounded p-2 text-sm">
            <div className="flex-1">
              <div className="font-medium">{o.name} <span className="text-[10px] px-1.5 rounded bg-muted ml-1">{o.status}</span></div>
              <div className="text-xs text-muted-foreground">{o.description}</div>
            </div>
            <a href={`/organizations/${o.id}`} className="text-sm underline">管理 →</a>
          </div>
        ))}
      </Card>
    </div>
  );
}

