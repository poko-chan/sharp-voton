import React from "react";
import { MessagesSquare, Users, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Conversation } from "@/lib/chat.functions";

type Selected = { type: "dm"; id: string } | { type: "group"; id: string } | null;

export function ConversationList({
  conversations,
  selected,
  onSelect,
  onDelete,
  onCreateGroup,
  isLoading,
}: {
  conversations: Conversation[];
  selected: Selected;
  onSelect: (c: Conversation) => void;
  onDelete: (c: Conversation) => void;
  onCreateGroup: () => void;
  isLoading?: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between gap-2">
        <h2 className="font-semibold flex items-center gap-2 min-w-0">
          <MessagesSquare className="h-5 w-5 shrink-0" />
          <span className="truncate">チャット</span>
        </h2>
        <Button size="sm" variant="outline" onClick={onCreateGroup} className="shrink-0 gap-1">
          <Plus className="h-4 w-4" />
          グループ
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && <p className="px-3 py-2 text-sm text-muted-foreground">読み込み中...</p>}
        {!isLoading && conversations.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted-foreground">会話がありません</p>
        )}
        {conversations.map((c) => {
          const isActive = selected && selected.type === c.conv_type && selected.id === c.conv_id;
          return (
            <div
              key={`${c.conv_type}-${c.conv_id}`}
              className={`group relative w-full rounded-lg text-sm ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <button onClick={() => onSelect(c)} className="w-full text-left px-3 py-2 pr-9">
                <div className="font-medium flex items-center gap-1.5 min-w-0">
                  {c.conv_type === "group" && <Users className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{c.display_name ?? "(no name)"}</span>
                  {c.unread_count > 0 && (
                    <Badge className="ml-auto shrink-0 h-5 min-w-5 px-1 justify-center" variant={isActive ? "secondary" : "default"}>
                      {c.unread_count}
                    </Badge>
                  )}
                </div>
                <div className={`text-xs truncate ${isActive ? "opacity-80" : "text-muted-foreground"}`}>
                  {c.last_message ?? (c.conv_type === "group" ? `メンバー ${c.member_count}人` : "")}
                </div>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(c); }}
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? "hover:bg-primary-foreground/20" : "hover:bg-background"}`}
                title="削除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { Selected };
