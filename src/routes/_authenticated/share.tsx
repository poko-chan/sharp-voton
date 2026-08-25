import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Copy, Share2, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/share")({ component: SharePage });

type Token = { token: string; label: string | null; expires_at: string | null; created_at: string };

function SharePage() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [label, setLabel] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("share_tokens").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setTokens((data as any) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const create = async () => {
    if (!user) return;
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    const { error } = await supabase.from("share_tokens").insert({ token, user_id: user.id, label: label || "保護者ビュー" });
    if (error) return toast.error(error.message);
    setLabel(""); load(); toast.success("共有リンクを作成しました");
  };

  const remove = async (t: string) => {
    await supabase.from("share_tokens").delete().eq("token", t);
    load();
  };

  const exportCSV = async () => {
    if (!user) return;
    const { data } = await supabase.from("study_logs").select("date,start_time,duration_minutes,content,subjects(name)").eq("user_id", user.id).order("date");
    const rows = [["date","start_time","minutes","subject","content"]];
    for (const r of (data ?? []) as any[]) rows.push([r.date, r.start_time ?? "", String(r.duration_minutes ?? 0), r.subjects?.name ?? "", (r.content ?? "").replace(/"/g, '""')]);
    const csv = rows.map((r) => r.map((x) => `"${x}"`).join(",")).join("\n");
    download(csv, "study_logs.csv", "text/csv");
  };

  const exportICS = async () => {
    if (!user) return;
    const { data } = await supabase.from("today_entries").select("*").eq("user_id", user.id).order("date");
    const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Study#//JP"];
    for (const e of (data ?? []) as any[]) {
      const dt = (d: string, t: string) => `${d.replace(/-/g,"")}T${t.replace(/:/g,"").slice(0,4)}00`;
      ics.push("BEGIN:VEVENT", `UID:${e.id}@studyplus`, `SUMMARY:${(e.label || e.category).replace(/\n/g," ")}`, `DTSTART:${dt(e.date, e.start_time)}`, `DTEND:${dt(e.date, e.end_time)}`, "END:VEVENT");
    }
    ics.push("END:VCALENDAR");
    download(ics.join("\r\n"), "today.ics", "text/calendar");
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Share2 className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">共有・エクスポート</h1>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">保護者ビュー（読み取り専用）</h2>
        <div className="flex gap-2">
          <Input placeholder="ラベル（例: お母さん）" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button onClick={create}>作成</Button>
        </div>
        <div className="space-y-2">
          {tokens.map((t) => {
            const url = `${window.location.origin}/share/${t.token}`;
            return (
              <div key={t.token} className="flex items-center gap-2 p-2 border rounded">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{url}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(url); toast.success("コピーしました"); }}><Copy className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(t.token)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
          {tokens.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">まだ共有リンクがありません</p>}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">エクスポート</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />勉強記録 CSV</Button>
          <Button variant="outline" onClick={exportICS}><Download className="h-4 w-4 mr-1" />Today iCal (.ics)</Button>
        </div>
        <p className="text-xs text-muted-foreground">CSV は Excel / Google スプレッドシート、ICS は Google カレンダー等にインポートできます。</p>
      </Card>
    </div>
  );
}

function download(content: string, name: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}