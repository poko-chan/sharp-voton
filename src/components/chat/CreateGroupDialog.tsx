import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { createChatGroup, type Profile } from "@/lib/chat.functions";

export function CreateGroupDialog({
  open,
  onOpenChange,
  friends,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  friends: Profile[];
  onCreated: (groupId: string) => void;
}) {
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id: string) => {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const reset = () => { setName(""); setMemberIds(new Set()); };

  const submit = async () => {
    const n = name.trim();
    if (!n) { toast.error("グループ名を入力してください"); return; }
    if (memberIds.size === 0) { toast.error("メンバーを選択してください"); return; }
    setSubmitting(true);
    try {
      const id = await createChatGroup(n, Array.from(memberIds));
      toast.success("グループを作成しました");
      reset();
      onOpenChange(false);
      onCreated(id);
    } catch (e: any) {
      toast.error(e.message ?? "作成に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>グループチャットを作成</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="グループ名" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <p className="text-sm text-muted-foreground mb-1">メンバーを選択</p>
            <div className="h-56 overflow-y-auto rounded-md border p-2">
              {friends.length === 0 && (
                <p className="text-sm text-muted-foreground px-1 py-2">フレンドがいません</p>
              )}
              <div className="space-y-1">
                {friends.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-muted cursor-pointer">
                    <Checkbox checked={memberIds.has(f.id)} onCheckedChange={() => toggle(f.id)} />
                    <span className="text-sm truncate">{f.display_name ?? f.username ?? "(no name)"}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
          <Button onClick={submit} disabled={submitting}>作成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
