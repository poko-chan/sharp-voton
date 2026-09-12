import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BookMarked, Plus, Trash2, Undo2 } from "lucide-react";
import { loadMembers, type Member } from "@/lib/org-school";

export function OrgLibrary({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const staff = ctx.isStaff;
  const [items, setItems] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [item, setItem] = useState({ title: "", kind: "book", location: "", total_count: "1" });
  const [loan, setLoan] = useState({ item_id: "", borrower_id: "", due_on: "" });

  const load = async () => {
    const [{ data: i }, { data: l }] = await Promise.all([
      (supabase as any)
        .from("org_library_items")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("org_library_loans")
        .select("*")
        .eq("organization_id", orgId)
        .order("loaned_on", { ascending: false })
        .limit(300),
    ]);
    setItems(i ?? []);
    setLoans(l ?? []);
  };

  useEffect(() => {
    load();
    if (staff) loadMembers(orgId).then(setMembers);
  }, [orgId, staff]);

  const nameOfId = (id: string) => members.find((m) => m.user_id === id)?.name ?? "メンバー";
  const titleOf = (id: string) => items.find((x) => x.id === id)?.title ?? "貸出物";
  const activeCount = (itemId: string) =>
    loans.filter((l) => l.item_id === itemId && !l.returned_on).length;

  const addItem = async () => {
    if (!item.title.trim()) return toast.error("名称を入力してください");
    const { error } = await (supabase as any).from("org_library_items").insert({
      organization_id: orgId,
      title: item.title.trim(),
      kind: item.kind,
      location: item.location || null,
      total_count: Number(item.total_count) || 1,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setItem({ title: "", kind: "book", location: "", total_count: "1" });
    load();
  };

  const addLoan = async () => {
    if (!loan.item_id || !loan.borrower_id) return toast.error("貸出物と借りる人を選んでください");
    const { error } = await (supabase as any).from("org_library_loans").insert({
      organization_id: orgId,
      item_id: loan.item_id,
      borrower_id: loan.borrower_id,
      due_on: loan.due_on || null,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setLoan({ item_id: "", borrower_id: "", due_on: "" });
    load();
  };

  const giveBack = async (id: string) => {
    const { error } = await (supabase as any)
      .from("org_library_loans")
      .update({ returned_on: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const removeItem = async (id: string) => {
    const { error } = await (supabase as any).from("org_library_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {staff && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Plus className="h-4 w-4" /> 貸出物を登録
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              placeholder="名称（例: 図書『坊っちゃん』）"
              value={item.title}
              onChange={(e) => setItem({ ...item, title: e.target.value })}
            />
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={item.kind}
              onChange={(e) => setItem({ ...item, kind: e.target.value })}
            >
              <option value="book">図書</option>
              <option value="equipment">備品</option>
              <option value="device">端末</option>
              <option value="other">その他</option>
            </select>
            <Input
              placeholder="保管場所"
              value={item.location}
              onChange={(e) => setItem({ ...item, location: e.target.value })}
            />
            <Input
              type="number"
              min={1}
              value={item.total_count}
              onChange={(e) => setItem({ ...item, total_count: e.target.value })}
            />
          </div>
          <Button size="sm" onClick={addItem}>
            登録
          </Button>
        </Card>
      )}

      {staff && (
        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold">貸し出す</div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={loan.item_id}
              onChange={(e) => setLoan({ ...loan, item_id: e.target.value })}
            >
              <option value="">貸出物を選ぶ</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}（残り {Math.max(0, (i.total_count ?? 1) - activeCount(i.id))}）
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={loan.borrower_id}
              onChange={(e) => setLoan({ ...loan, borrower_id: e.target.value })}
            >
              <option value="">借りる人</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={loan.due_on}
              onChange={(e) => setLoan({ ...loan, due_on: e.target.value })}
            />
          </div>
          <Button size="sm" onClick={addLoan}>
            貸出を記録
          </Button>
        </Card>
      )}

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BookMarked className="h-4 w-4" /> 貸出中
        </div>
        {loans.filter((l) => !l.returned_on).length === 0 && (
          <div className="text-sm text-muted-foreground">貸出中のものはありません。</div>
        )}
        {loans
          .filter((l) => !l.returned_on)
          .map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between rounded-lg border p-2 text-sm"
            >
              <div>
                <div className="font-medium">{titleOf(l.item_id)}</div>
                <div className="text-xs text-muted-foreground">
                  {staff ? nameOfId(l.borrower_id) : "あなた"} ・ {l.loaned_on} 貸出
                  {l.due_on && (
                    <span className={l.due_on < today ? " text-destructive" : ""}>
                      {" "}
                      / 返却期限 {l.due_on}
                      {l.due_on < today ? "（超過）" : ""}
                    </span>
                  )}
                </div>
              </div>
              {staff && (
                <Button size="sm" variant="outline" onClick={() => giveBack(l.id)}>
                  <Undo2 className="h-4 w-4 mr-1" />
                  返却
                </Button>
              )}
            </div>
          ))}
      </Card>

      {staff && (
        <Card className="p-4 space-y-2">
          <div className="text-sm font-semibold">登録済みの貸出物</div>
          {items.map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between rounded-lg border p-2 text-sm"
            >
              <div>
                <div className="font-medium">{i.title}</div>
                <div className="text-xs text-muted-foreground">
                  {i.location || "保管場所未設定"} ・ 全{i.total_count}点 / 貸出中
                  {activeCount(i.id)}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeItem(i.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-sm text-muted-foreground">まだ登録がありません。</div>
          )}
        </Card>
      )}
    </div>
  );
}
