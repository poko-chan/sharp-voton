import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PackageSearch, Trash2 } from "lucide-react";

export function OrgLostItems({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const staff = ctx.isStaff;
  const [rows, setRows] = useState<any[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    found_place: "",
    found_on: new Date().toISOString().slice(0, 10),
    note: "",
  });

  const load = async () => {
    const { data } = await (supabase as any)
      .from("org_lost_items")
      .select("*")
      .eq("organization_id", orgId)
      .order("found_on", { ascending: false })
      .limit(200);
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
  }, [orgId]);

  const add = async () => {
    if (!draft.title.trim()) return toast.error("品名を入力してください");
    const { error } = await (supabase as any).from("org_lost_items").insert({
      organization_id: orgId,
      title: draft.title.trim(),
      found_place: draft.found_place || null,
      found_on: draft.found_on,
      note: draft.note || null,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setDraft({ ...draft, title: "", found_place: "", note: "" });
    load();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any)
      .from("org_lost_items")
      .update({ status })
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("org_lost_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const list = rows.filter((r) => (showDone ? true : r.status === "keeping"));

  return (
    <div className="space-y-4">
      {staff && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PackageSearch className="h-4 w-4" /> 落とし物を登録
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              placeholder="品名（例: 青い水筒）"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <Input
              placeholder="見つけた場所"
              value={draft.found_place}
              onChange={(e) => setDraft({ ...draft, found_place: e.target.value })}
            />
            <Input
              type="date"
              value={draft.found_on}
              onChange={(e) => setDraft({ ...draft, found_on: e.target.value })}
            />
            <Input
              placeholder="メモ"
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </div>
          <Button size="sm" onClick={add}>
            登録
          </Button>
        </Card>
      )}

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setShowDone((v) => !v)}>
          {showDone ? "保管中のみ表示" : "受け渡し済みも表示"}
        </Button>
      </div>

      <Card className="p-4 space-y-2">
        {list.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-lg border p-2 text-sm"
          >
            <div>
              <div className="font-medium">
                {r.title}
                {r.status !== "keeping" && (
                  <span className="ml-2 text-xs text-muted-foreground">受け渡し済み</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {r.found_on} ・ {r.found_place || "場所不明"}
                {r.note ? ` ・ ${r.note}` : ""}
              </div>
            </div>
            {staff && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus(r.id, r.status === "keeping" ? "returned" : "keeping")}
                >
                  {r.status === "keeping" ? "受け渡し" : "保管に戻す"}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && (
          <div className="text-sm text-muted-foreground">該当する落とし物はありません。</div>
        )}
      </Card>
    </div>
  );
}
