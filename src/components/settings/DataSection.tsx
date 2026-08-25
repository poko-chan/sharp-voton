import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SectionHeading } from "./shared";

export function DataSection() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const csv = async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase.from("study_logs").select("date,duration_minutes,memo,tag,subject_id").eq("user_id", user.id).order("date");
    const rows = ["date,duration_minutes,memo,tag,subject_id", ...(data ?? []).map((r: any) => `${r.date},${r.duration_minutes},"${(r.memo ?? "").replace(/"/g, '""')}",${r.tag ?? ""},${r.subject_id ?? ""}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `study_logs_${Date.now()}.csv`; a.click();
    setBusy(false); toast.success("CSVを出力しました");
  };
  const ics = async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase.from("events").select("title,start_at,end_at").eq("user_id", user.id);
    const out = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//StudyApp//EN",
      ...(data ?? []).flatMap((e: any) => ["BEGIN:VEVENT", `UID:${e.start_at}-${Math.random()}@studyapp`, `SUMMARY:${e.title}`, `DTSTART:${(e.start_at ?? "").replace(/[-:]/g, "").slice(0, 15)}Z`, e.end_at ? `DTEND:${(e.end_at ?? "").replace(/[-:]/g, "").slice(0, 15)}Z` : "", "END:VEVENT"].filter(Boolean)),
      "END:VCALENDAR"].join("\n");
    const blob = new Blob([out], { type: "text/calendar" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "events.ics"; a.click();
    setBusy(false); toast.success("カレンダーを出力しました");
  };
  return (
    <div className="space-y-6">
      <SectionHeading title="データ" desc="勉強記録や予定を外部にエクスポートします" />
      <Card className="p-6 space-y-3">
        <div className="font-semibold">データ出力</div>
        <p className="text-sm text-muted-foreground">勉強記録や予定を外部にエクスポート。</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={csv} disabled={busy} variant="outline">CSVダウンロード</Button>
          <Button onClick={ics} disabled={busy} variant="outline">.icsダウンロード</Button>
        </div>
      </Card>
    </div>
  );
}
