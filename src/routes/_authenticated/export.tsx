import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Calendar } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/export")({ component: ExportPage });

function ExportPage() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const exportCsv = async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase.from("study_logs").select("date,duration_minutes,memo,tag,subject_id").eq("user_id", user.id).order("date");
    const rows = ["date,duration_minutes,memo,tag,subject_id", ...(data ?? []).map((r: any) => `${r.date},${r.duration_minutes},"${(r.memo ?? "").replace(/"/g, '""')}",${r.tag ?? ""},${r.subject_id ?? ""}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `study_logs_${Date.now()}.csv`;
    a.click();
    setBusy(false);
    toast.success("CSVを出力しました");
  };

  const exportIcs = async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase.from("events").select("title,start_at,end_at").eq("user_id", user.id);
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//StudyApp//EN",
      ...(data ?? []).flatMap((e: any) => [
        "BEGIN:VEVENT",
        `UID:${e.start_at}-${Math.random()}@studyapp`,
        `SUMMARY:${e.title}`,
        `DTSTART:${(e.start_at ?? "").replace(/[-:]/g, "").slice(0, 15)}Z`,
        e.end_at ? `DTEND:${(e.end_at ?? "").replace(/[-:]/g, "").slice(0, 15)}Z` : "",
        "END:VEVENT",
      ].filter(Boolean)),
      "END:VCALENDAR",
    ].join("\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `events.ics`;
    a.click();
    setBusy(false);
    toast.success("カレンダーを出力しました");
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2"><Download /> データ出力</h1>
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-semibold mb-2">勉強記録CSV</h2>
          <p className="text-sm text-muted-foreground mb-3">すべての勉強記録をCSVで出力します。</p>
          <Button onClick={exportCsv} disabled={busy}><Download className="w-4 h-4 mr-2" />CSVをダウンロード</Button>
        </div>
        <div className="border-t pt-4">
          <h2 className="font-semibold mb-2">カレンダー連携 (.ics)</h2>
          <p className="text-sm text-muted-foreground mb-3">予定をGoogle/Appleカレンダーにインポートできます。</p>
          <Button onClick={exportIcs} disabled={busy} variant="outline"><Calendar className="w-4 h-4 mr-2" />.ics をダウンロード</Button>
        </div>
      </Card>
    </div>
  );
}