import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, Camera } from "lucide-react";

export const Route = createFileRoute("/_authenticated/photolog")({ component: PhotoLog });

function PhotoLog() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [caption, setCaption] = useState("");
  const load = () => supabase.from("photo_study_logs").select("*").order("created_at",{ascending:false}).limit(50).then(({data})=>setItems(data??[]));
  useEffect(()=>{load();}, []);
  const upload = async (f: File) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}-${f.name}`;
    const { error } = await supabase.storage.from("photo-logs").upload(path, f);
    if (error) { await supabase.storage.createBucket("photo-logs", { public: true }).catch(()=>{}); await supabase.storage.from("photo-logs").upload(path, f); }
    const { data: url } = supabase.storage.from("photo-logs").getPublicUrl(path);
    await supabase.from("photo_study_logs").insert({ user_id: user.id, image_url: url.publicUrl, caption });
    setCaption(""); load();
  };
  const like = async (id: string, cur: number) => { await supabase.from("photo_study_logs").update({ likes: cur + 1 }).eq("id", id); load(); };
  return (<div className="p-4 md:p-8 max-w-4xl mx-auto space-y-4">
    <div className="flex items-center gap-2"><Camera className="h-7 w-7 text-primary" /><h1 className="text-2xl font-bold">写真スタディログ</h1></div>
    <Card className="p-4 space-y-2">
      <Input placeholder="ひとこと" value={caption} onChange={(e)=>setCaption(e.target.value)} />
      <Input type="file" accept="image/*" onChange={(e)=>e.target.files?.[0] && upload(e.target.files[0])} />
    </Card>
    <div className="grid sm:grid-cols-2 gap-3">
      {items.map(i=>(<Card key={i.id} className="overflow-hidden">
        <img src={i.image_url} className="w-full aspect-square object-cover" />
        <div className="p-3 flex justify-between items-center">
          <div className="text-sm">{i.caption}</div>
          <Button size="sm" variant="ghost" onClick={()=>like(i.id, i.likes ?? 0)}><Heart className="h-4 w-4 mr-1" />{i.likes ?? 0}</Button>
        </div>
      </Card>))}
    </div>
  </div>);
}