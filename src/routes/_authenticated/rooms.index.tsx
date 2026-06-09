import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Users, Plus, LogIn, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rooms/")({ component: RoomsPage });

function RoomsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = async () => {
    if (!user) return;
    const { data: m } = await supabase.from("group_room_members").select("room_id").eq("user_id", user.id);
    const ids = (m ?? []).map((r: any) => r.room_id);
    if (!ids.length) return setRooms([]);
    const { data } = await supabase.from("group_rooms").select("*").in("id", ids).eq("active", true);
    setRooms(data ?? []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const create = async () => {
    if (!user || !name.trim()) return;
    const c = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data, error } = await supabase.from("group_rooms").insert({ owner_id: user.id, name, code: c }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("group_room_members").insert({ room_id: data.id, user_id: user.id });
    setName(""); load();
    toast.success(`作成しました 招待コード: ${c}`);
  };
  const join = async () => {
    if (!user || !code.trim()) return;
    const { data } = await supabase.from("group_rooms").select("id").eq("code", code.toUpperCase().trim()).maybeSingle();
    if (!data) return toast.error("ルームが見つかりません");
    const { error } = await supabase.from("group_room_members").upsert({ room_id: data.id, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("参加しました");
    setCode(""); load();
  };

  const saveName = async (r: any) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from("group_rooms").update({ name: editName }).eq("id", r.id);
    if (error) return toast.error(error.message);
    setEditingId(null); load();
  };
  const removeRoom = async (r: any) => {
    if (!confirm(`「${r.name}」を削除しますか？`)) return;
    const { error } = await supabase.from("group_rooms").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("削除しました"); load();
  };
  const leaveRoom = async (r: any) => {
    if (!user) return;
    await supabase.from("group_room_members").delete().eq("room_id", r.id).eq("user_id", user.id);
    load();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2"><Users className="h-7 w-7" /><h1 className="text-3xl font-bold">グループ勉強ルーム</h1></div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 space-y-2">
          <div className="font-semibold flex items-center gap-1"><Plus className="h-4 w-4" />新しいルーム</div>
          <Input placeholder="ルーム名" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={create} className="w-full">作成</Button>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="font-semibold flex items-center gap-1"><LogIn className="h-4 w-4" />参加</div>
          <Input placeholder="招待コード" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <Button onClick={join} className="w-full" variant="outline">参加</Button>
        </Card>
      </div>
      <div className="space-y-2">
        {rooms.map((r) => {
          const isOwner = r.owner_id === user?.id;
          return (
            <Card key={r.id} className="p-4 flex items-center gap-3">
              <Link to="/rooms/$roomId" params={{ roomId: r.id }} className="flex-1 min-w-0">
                {editingId === r.id ? (
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} onClick={(e) => e.preventDefault()} className="h-8" />
                ) : (
                  <div className="font-medium truncate">{r.name}</div>
                )}
                <div className="text-xs text-muted-foreground">コード: {r.code}</div>
              </Link>
              {isOwner ? (
                editingId === r.id ? (
                  <>
                    <Button size="sm" onClick={() => saveName(r)}>保存</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>取消</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(r.id); setEditName(r.name); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeRoom(r)}><Trash2 className="h-4 w-4" /></Button>
                  </>
                )
              ) : (
                <Button size="sm" variant="ghost" onClick={() => leaveRoom(r)}>退出</Button>
              )}
            </Card>
          );
        })}
        {rooms.length === 0 && <div className="text-sm text-muted-foreground">参加中のルームはありません</div>}
      </div>
    </div>
  );
}