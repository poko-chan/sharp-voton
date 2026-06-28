import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/exams/series/$seriesId")({ component: SeriesPage });

function SeriesPage() {
  const { seriesId } = Route.useParams();
  const { user } = useAuth();
  const [series, setSeries] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: s } = await (supabase as any).from("exam_series").select("*").eq("id", seriesId).maybeSingle();
      setSeries(s);
      const { data: es } = await (supabase as any).from("exams").select("*").eq("series_id", seriesId).order("start_date");
      setExams(es ?? []);
      const examIds = (es ?? []).map((e: any) => e.id);
      if (examIds.length) {
        const { data: ss } = await (supabase as any).from("exam_subjects").select("*").in("exam_id", examIds);
        setSubjects(ss ?? []);
      }
      const { data: ll } = await supabase.from("study_logs").select("date,subject_id,minutes").eq("user_id", user.id);
      setLogs(ll ?? []);
    })();
  }, [seriesId, user?.id]);

  const subjectNames = useMemo(() => Array.from(new Set(subjects.map((s) => s.name))), [subjects]);

  const data = useMemo(() => {
    return exams.map((ex) => {
      const subs = subjects.filter((s) => s.exam_id === ex.id);
      const row: any = { name: ex.name, date: ex.start_date };
      subs.forEach((sub) => {
        if (sub.actual_score != null && sub.max_score) {
          row[`${sub.name}_点数%`] = Math.round((sub.actual_score / sub.max_score) * 1000) / 10;
        }
        const ids: string[] = sub.study_subject_ids ?? [];
        if (ids.length && ex.start_date) {
          const cutoff = ex.start_date;
          const totalMin = logs
            .filter((l) => ids.includes(l.subject_id) && l.date <= cutoff)
            .reduce((a, b) => a + (b.minutes ?? 0), 0);
          row[`${sub.name}_時間h`] = Math.round((totalMin / 60) * 10) / 10;
        }
      });
      return row;
    });
  }, [exams, subjects, logs]);

  const colors = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899"];

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-4">
      <Link to="/exams"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />試験一覧</Button></Link>
      <h1 className="text-3xl font-bold">{series?.name ?? "シリーズ"}</h1>
      <p className="text-xs text-muted-foreground">教科ごとの得点率(%)と、その試験までの累積勉強時間(h) を比較します。</p>

      <Card className="p-4">
        <div className="text-sm font-bold mb-2">得点率(%) 推移</div>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip /><Legend />
              {subjectNames.map((n, i) => (
                <Line key={n} type="monotone" dataKey={`${n}_点数%`} stroke={colors[i % colors.length]} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-sm font-bold mb-2">累積勉強時間(h) 推移</div>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" /><YAxis />
              <Tooltip /><Legend />
              {subjectNames.map((n, i) => (
                <Line key={n} type="monotone" dataKey={`${n}_時間h`} stroke={colors[i % colors.length]} strokeDasharray="5 5" />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}