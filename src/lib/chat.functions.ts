import { supabase } from "@/integrations/supabase/client";

export type ConvType = "dm" | "group";

export type Conversation = {
  conv_type: ConvType;
  conv_id: string;
  display_name: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  member_count: number;
};

export type Profile = { id: string; display_name: string | null; username: string | null };

export type DmMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  read_at: string | null;
  deleted_at: string | null;
};

export type GroupMessage = {
  id: string;
  sender_id: string;
  group_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
};

export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await (supabase as any).rpc("list_chat_conversations");
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

export async function fetchFriends(userId: string): Promise<Profile[]> {
  const { data: f1, error: e1 } = await supabase
    .from("follows").select("following_id").eq("follower_id", userId).eq("status", "accepted");
  if (e1) throw e1;
  const { data: f2, error: e2 } = await supabase
    .from("follows").select("follower_id").eq("following_id", userId).eq("status", "accepted");
  if (e2) throw e2;
  const out = (f1 ?? []).map((r: any) => r.following_id);
  const incSet = new Set((f2 ?? []).map((r: any) => r.follower_id));
  const friendIds = out.filter((id) => incSet.has(id));
  if (friendIds.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles").select("id, display_name, username")
    .in("id", friendIds).order("display_name");
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function fetchProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles").select("id, display_name, username")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function hideDmConversation(otherId: string) {
  const { error } = await (supabase as any).rpc("hide_dm_conversation", { _other: otherId });
  if (error) throw error;
}

export async function createChatGroup(name: string, memberIds: string[]): Promise<string> {
  const { data, error } = await (supabase as any).rpc("create_chat_group", { _name: name, _member_ids: memberIds });
  if (error) throw error;
  return data as string;
}

export async function inviteToChatGroup(groupId: string, userId: string) {
  const { error } = await (supabase as any).rpc("invite_to_chat_group", { _group: groupId, _user_id: userId });
  if (error) throw error;
}

export async function removeFromChatGroup(groupId: string, userId: string) {
  const { error } = await (supabase as any).rpc("remove_from_chat_group", { _group: groupId, _user_id: userId });
  if (error) throw error;
}

export async function leaveChatGroup(groupId: string) {
  const { error } = await (supabase as any).rpc("leave_chat_group", { _group: groupId });
  if (error) throw error;
}

export async function sendGroupMessage(groupId: string, content: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc("send_group_message", { _group: groupId, _content: content });
  if (error) throw error;
  return data as string;
}

export async function markGroupRead(groupId: string) {
  const { error } = await (supabase as any).rpc("mark_group_read", { _group: groupId });
  if (error) throw error;
}

export async function sendDm(toId: string, content: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc("send_dm", { _to: toId, _content: content });
  if (error) throw error;
  return data as string;
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from("chat_group_members").select("*").eq("group_id", groupId);
  if (error) throw error;
  return (data ?? []) as GroupMember[];
}

export async function fetchGroupInfo(groupId: string) {
  const { data, error } = await supabase
    .from("chat_groups").select("*").eq("id", groupId).maybeSingle();
  if (error) throw error;
  return data;
}
