import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserMinus, UserPlus, LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  fetchGroupMembers,
  fetchProfilesByIds,
  inviteToChatGroup,
  removeFromChatGroup,
  leaveChatGroup,
  type Profile,
} from "@/lib/chat.functions";

export function GroupMembersDialog({
  open,
  onOpenChange,
  groupId,
  ownerId,
  currentUserId,
  friends,
  onLeft,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  ownerId: string | null;
  currentUserId: string;
  friends: Profile[];
  onLeft: () => void;
}) {
  const qc = useQueryClient();
  const isOwner = ownerId === currentUserId;
  const [busy, setBusy] = useState<string | null>(null);

  const members = useQuery({
    queryKey: ["chat-group-members", groupId],
    queryFn: async () => {
      const rows = await fetchGroupMembers(groupId);
      const profiles = await fetchProfilesByIds(rows.map((r) => r.user_id));
      const map = new Map(profiles.map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, profile: map.get(r.user_id) }));
    },
    enabled: open && !!groupId,
  });

  const memberIds = useMemo(() => new Set((members.data ?? []).map((m) => m.user_id)), [members.data]);
  const invitable = friends.filter((f) => !memberIds.has(f.id));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["chat-group-members", groupId] });
    qc.invalidateQueries({ queryKey: ["chat-conversations"] });
  };

  const invite = async (userId: string) => {
    setBusy(userId);
    try {
      await inviteToChatGroup(groupId, userId);
      toast.success("招待しました");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "招待に失敗しました");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (userId: string) => {
    if (!confirm("このメンバーを削除しますか？")) return;
    setBusy(userId);
    try {
      await removeFromChatGroup(groupId, userId);
      toast.success("削除しました");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "削除に失敗しました");
    } finally {
      setBusy(null);
    }
  };

  const leave = async () => {
    if (!confirm("グループから退出しますか？")) return;
    try {
      await leaveChatGroup(groupId);
      toast.success("退出しました");
      onOpenChange(false);
      onLeft();
    } catch (e: any) {
      toast.error(e.message ?? "退出に失敗しました");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>メンバー管理</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-1">メンバー</p>
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border p-2">
              {members.data?.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between px-1 py-1 text-sm">
                  <span className="truncate">
                    {m.profile?.display_name ?? m.profile?.username ?? "(unknown)"}
                    {m.user_id === ownerId && <span className="ml-1 text-xs text-muted-foreground">(作成者)</span>}
                  </span>
                  {isOwner && m.user_id !== currentUserId && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busy === m.user_id} onClick={() => remove(m.user_id)}>
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {isOwner && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">フレンドを招待</p>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border p-2">
                {invitable.length === 0 && <p className="text-sm text-muted-foreground px-1 py-2">招待できるフレンドがいません</p>}
                {invitable.map((f) => (
                  <div key={f.id} className="flex items-center justify-between px-1 py-1 text-sm">
                    <span className="truncate">{f.display_name ?? f.username}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busy === f.id} onClick={() => invite(f.id)}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          {!isOwner && (
            <Button variant="destructive" size="sm" onClick={leave} className="gap-1">
              <LogOut className="h-4 w-4" />
              グループを退出
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
