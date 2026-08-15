import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { UserCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/organizations/$orgId/profile")({ component: OrgProfilePage });

function OrgProfilePage() {
  const { orgId } = Route.useParams();
  const { user } = useAuth();
  const [p, setP] = useState<any>({});

  useEffect(() => {
    if (!user) return;
    (supabase as any).from("org_profiles").select("*").eq("organization_id", orgId).eq("user_id", user.id).maybeSingle()
      .then(({ data }: any) => setP(data ?? {}));
  }, [orgId, user?.id]);

  const save = async () => {
    const { error } = await (supabase as any).from("org_profiles").upsert({
      organization_id: orgId, user_id: user!.id,
      display_name: p.display_name || null, grade: p.grade || null, class_name: p.class_name || null,
      student_number: p.student_number || null, bio: p.bio || null, avatar_url: p.avatar_url || null,
    }, { onConflict: "organization_id,user_id" });
    if (error) return toast.error(error.message);
    toast.success("保存しました");
  };

  const set = (k: string) => (e: any) => setP((s: any) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="max-w-xl mx-auto p-6 space-y-3">
      <Link to="/organizations/$orgId" params={{ orgId }} className="text-sm underline text-muted-foreground">← 組織ホームへ</Link>
      <h1 className="text-xl font-bold flex items-center gap-2"><UserCircle className="h-5 w-5 text-primary" />組織内プロフィール</h1>
      <p className="text-xs text-muted-foreground">この情報は組織の中でのみ表示されます（通常のStudy+プロフィールとは別です）。</p>
      <Card className="p-4 space-y-2">
        <Input placeholder="組織内での表示名" value={p.display_name ?? ""} onChange={set("display_name")} />
        <div className="flex gap-2">
          <Input placeholder="学年（例: 1年）" value={p.grade ?? ""} onChange={set("grade")} />
          <Input placeholder="クラス（例: C組）" value={p.class_name ?? ""} onChange={set("class_name")} />
        </div>
        <Input placeholder="学籍番号（任意）" value={p.student_number ?? ""} onChange={set("student_number")} />
        <Textarea rows={3} placeholder="自己紹介（任意）" value={p.bio ?? ""} onChange={set("bio")} />
        <Button onClick={save}>保存</Button>
      </Card>
    </div>
  );
}
