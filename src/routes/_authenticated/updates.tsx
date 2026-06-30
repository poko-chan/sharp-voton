import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/updates")({ component: UpdatesPage });

function UpdatesPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("login_boards")
        .select("id,title,body,created_at,audience")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(50);
      setItems(data ?? []);
    })();
  }, []);
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-7 w-7" />
        <h1 className="text-3xl font-bold">アップデート / お知らせ</h1>
      </div>
      {items.length === 0 && <p className="text-muted-foreground">まだ投稿がありません</p>}
      {items.map((b) => (
        <Card key={b.id} className="p-5 space-y-1">
          <div className="text-xs text-muted-foreground">
            {new Date(b.created_at).toLocaleString("ja-JP")} ・ {b.audience === "all" ? "全体" : "個別"}
          </div>
          <div className="text-lg font-semibold">{b.title}</div>
          <div className="whitespace-pre-wrap leading-relaxed text-sm">{b.body}</div>
        </Card>
      ))}
    </div>
  );
}