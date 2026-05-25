import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = { id: string; title: string; body: string; publish_at: string; tag: string };

const TAGS: Record<string, { label: string; className: string }> = {
  update: { label: "アップデート", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  bug: { label: "バグ", className: "bg-red-500/15 text-red-600 border-red-500/30" },
  maintenance: { label: "メンテナンス", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  other: { label: "その他", className: "bg-muted text-muted-foreground border-border" },
};
const tagMeta = (v: string) => TAGS[v] ?? TAGS.other;

function AnnouncementsPage() {
  const q = useQuery({
    queryKey: ["announcements", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, body, publish_at, tag")
        .lte("publish_at", new Date().toISOString())
        .order("publish_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-5">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Bell className="h-7 w-7 text-primary" />お知らせ
      </h1>
      {q.isLoading && <p className="text-muted-foreground">読み込み中…</p>}
      {!q.isLoading && (q.data?.length ?? 0) === 0 && (
        <Card className="p-10 text-center text-muted-foreground">お知らせはまだありません</Card>
      )}
      {q.data?.map((a) => {
        const t = tagMeta(a.tag);
        return (
          <Card key={a.id} className="p-6 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${t.className}`}>{t.label}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(a.publish_at).toLocaleString("ja-JP")}
              </span>
            </div>
            <h2 className="text-xl font-semibold">{a.title}</h2>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{a.body}</p>
          </Card>
        );
      })}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/announcements")({ component: AnnouncementsPage });
