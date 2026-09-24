import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadOrgProfiles } from "@/lib/org-apps";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

type Att = { user_id: string; correct: boolean; created_at: string };

export function EduTeacherPortal({ orgId }: { orgId: string }) {
  const [members, setMembers] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [atts, setAtts] = useState<Att[]>([]);
  const [live, setLive] = useState<Record<string, string>>({});

  const loadAtts = async () => {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data } = await (supabase as any)
      .from("org_edu_attempts")
      .select("user_id, correct, created_at")
      .eq("organization_id", orgId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    setAtts(data ?? []);
  };

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", orgId)
        .eq("suspended", false);
      const ids = (data ?? []).filter((m: any) => m.role === "member").map((m: any) => m.user_id);
      setMembers(ids);
      if (ids.length) {
        const p = await loadOrgProfiles(orgId, ids);
        const m: Record<string, string> = {};
        for (const id of ids) m[id] = p[id]?.display_name ?? p[id]?.username ?? "生徒";
        setNames(m);
      }
    })();
    loadAtts();
    const t = setInterval(loadAtts, 15000);
    const ch = supabase.channel(`edu-live-${orgId}`);
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState() as Record<string, any[]>;
      const m: Record<string, string> = {};
      for (const [k, v] of Object.entries(st)) m[k] = v[0]?.unit ?? "";
      setLive(m);
    }).subscribe();
    return () => {
      clearInterval(t);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const rows = useMemo(() => {
    const ids = [...new Set([...members, ...atts.map((a) => a.user_id)])];
    return ids.map((id) => {
      const mine = atts.filter((a) => a.user_id === id); // 新しい順
      const ok = mine.filter((a) => a.correct).length;
      const rate = mine.length ? Math.round((ok / mine.length) * 100) : null;
      const stuck = mine.length >= 2 && !mine[0].correct && !mine[1].correct;
      const state: "red" | "yellow" | "green" | "idle" = stuck
        ? "red"
        : id in live
          ? "yellow"
          : mine.length
            ? "green"
            : "idle";
      return { id, name: names[id] ?? "生徒", total: mine.length, rate, state, unit: live[id] };
    });
  }, [members, atts, names, live]);

  const daily = useMemo(() => {
    const out: { d: string; rate: number | null }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const list = atts.filter((a) => a.created_at.slice(0, 10) === day);
      out.push({
        d: day.slice(5),
        rate: list.length ? Math.round((list.filter((a) => a.correct).length / list.length) * 100) : null,
      });
    }
    return out;
  }, [atts]);

  const avg = atts.length ? Math.round((atts.filter((a) => a.correct).length / atts.length) * 100) : 0;
  const alerts = rows.filter((r) => r.state === "red");
  const dot = { red: "bg-destructive", yellow: "bg-amber-400", green: "bg-emerald-500", idle: "bg-muted" };
  const label = { red: "つまずき中", yellow: "解答中", green: "スムーズ", idle: "未着手" };

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <Card className="p-4 border-destructive/50 bg-destructive/5">
          <div className="font-bold text-sm flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            要個別フォローの生徒（連続誤答）
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {alerts.map((a) => (
              <span key={a.id} className="text-xs font-bold rounded-full bg-destructive/15 px-3 py-1">
                {a.name}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-baseline justify-between">
          <div className="font-bold text-sm">クラス平均正答率（7日間）</div>
          <div className="text-2xl font-extrabold text-primary">{avg}%</div>
        </div>
        <div className="flex items-end gap-2 h-32 mt-3">
          {daily.map((d) => (
            <div key={d.d} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div className="text-[10px] text-muted-foreground">{d.rate ?? "-"}</div>
              <div className="w-full rounded-t bg-primary/70" style={{ height: `${d.rate ?? 0}%` }} />
              <div className="text-[10px] text-muted-foreground">{d.d}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left p-2">生徒</th>
              <th className="text-left p-2">状態</th>
              <th className="p-2">解答数</th>
              <th className="p-2">正答率</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  生徒がいません
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-medium">{r.name}</td>
                <td className="p-2">
                  <span className="inline-flex items-center gap-2 text-xs">
                    <span className={`h-3 w-3 rounded-full ${dot[r.state]}`} />
                    {label[r.state]}
                    {r.unit ? <span className="text-muted-foreground">（{r.unit}）</span> : null}
                  </span>
                </td>
                <td className="p-2 text-center">{r.total}</td>
                <td className="p-2 text-center font-bold">{r.rate === null ? "-" : `${r.rate}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-2 text-[10px] text-muted-foreground">15秒ごとに自動更新</div>
      </Card>
    </div>
  );
}
