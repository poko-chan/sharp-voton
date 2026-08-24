import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  listConversations,
  fetchFriends,
  fetchGroupInfo,
  hideDmConversation,
  leaveChatGroup,
  type Conversation,
} from "@/lib/chat.functions";
import { ConversationList, type Selected } from "@/components/chat/ConversationList";
import { CreateGroupDialog } from "@/components/chat/CreateGroupDialog";
import { GroupMembersDialog } from "@/components/chat/GroupMembersDialog";
import { DeleteConversationDialog } from "@/components/chat/DeleteConversationDialog";
import { DmChatPanel } from "@/components/chat/DmChatPanel";
import { GroupChatPanel } from "@/components/chat/GroupChatPanel";

function ChatPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Selected>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [mobileShowList, setMobileShowList] = useState(true);

  const conversations = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: listConversations,
    enabled: !!user,
    refetchInterval: 15000,
  });

  const friends = useQuery({
    queryKey: ["chat-friends"],
    queryFn: () => fetchFriends(user!.id),
    enabled: !!user,
  });

  const selectedConv = conversations.data?.find(
    (c) => selected && c.conv_type === selected.type && c.conv_id === selected.id
  );

  const groupInfo = useQuery({
    queryKey: ["chat-group-info", selected?.type === "group" ? selected.id : null],
    queryFn: () => fetchGroupInfo(selected!.id),
    enabled: selected?.type === "group",
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("chat-conversations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["chat-conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_group_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["chat-conversations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const selectConv = (c: Conversation) => {
    setSelected({ type: c.conv_type, id: c.conv_id });
    setMobileShowList(false);
  };

  const requestDelete = (c: Conversation) => setDeleteTarget(c);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.conv_type === "dm") {
        await hideDmConversation(deleteTarget.conv_id);
      } else {
        await leaveChatGroup(deleteTarget.conv_id);
      }
      toast.success("削除しました");
      if (selected && selected.type === deleteTarget.conv_type && selected.id === deleteTarget.conv_id) {
        setSelected(null);
        setMobileShowList(true);
      }
      qc.invalidateQueries({ queryKey: ["chat-conversations"] });
    } catch (e: any) {
      toast.error(e.message ?? "削除に失敗しました");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleGroupCreated = (groupId: string) => {
    qc.invalidateQueries({ queryKey: ["chat-conversations"] });
    setSelected({ type: "group", id: groupId });
    setMobileShowList(false);
  };

  if (!user) return null;

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      <aside className={`w-full sm:w-72 border-r bg-card overflow-hidden flex-col ${mobileShowList ? "flex" : "hidden"} sm:flex shrink-0`}>
        <ConversationList
          conversations={conversations.data ?? []}
          selected={selected}
          onSelect={selectConv}
          onDelete={requestDelete}
          onCreateGroup={() => setCreateGroupOpen(true)}
          isLoading={conversations.isLoading}
        />
      </aside>

      <main className={`flex-1 flex-col min-w-0 ${mobileShowList ? "hidden" : "flex"} sm:flex`}>
        {!selected || !selectedConv ? (
          <div className="flex-1 grid place-items-center text-muted-foreground text-sm gap-2 flex-col">
            <MessagesSquare className="h-8 w-8 opacity-40" />
            左側から会話を選んでください
          </div>
        ) : (
          <>
            <div className="sm:hidden border-b p-2">
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setMobileShowList(true)}>
                <ArrowLeft className="h-4 w-4" />
                一覧に戻る
              </Button>
            </div>
            {selected.type === "dm" ? (
              <DmChatPanel
                userId={user.id}
                partnerId={selected.id}
                partnerName={selectedConv.display_name}
              />
            ) : (
              <GroupChatPanel
                userId={user.id}
                groupId={selected.id}
                groupName={selectedConv.display_name}
                memberCount={selectedConv.member_count}
                onOpenMembers={() => setMembersOpen(true)}
              />
            )}
          </>
        )}
      </main>

      <CreateGroupDialog
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        friends={friends.data ?? []}
        onCreated={handleGroupCreated}
      />

      {selected?.type === "group" && (
        <GroupMembersDialog
          open={membersOpen}
          onOpenChange={setMembersOpen}
          groupId={selected.id}
          ownerId={groupInfo.data?.created_by ?? null}
          currentUserId={user.id}
          friends={friends.data ?? []}
          onLeft={() => {
            setSelected(null);
            setMobileShowList(true);
            qc.invalidateQueries({ queryKey: ["chat-conversations"] });
          }}
        />
      )}

      <DeleteConversationDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title={deleteTarget?.conv_type === "dm" ? "会話を削除しますか？" : "グループを退出しますか？"}
        description={
          deleteTarget?.conv_type === "dm"
            ? "この会話を一覧から非表示にします。相手からのメッセージ履歴は保持されます。"
            : "このグループから退出します。再度参加するには招待が必要です。"
        }
        confirmLabel={deleteTarget?.conv_type === "dm" ? "削除" : "退出"}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/chat")({ component: ChatPage });
