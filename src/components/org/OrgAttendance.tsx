import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Download, Check, Send } from "lucide-react";
import {
  ABSENCE_KINDS,
  ATTENDANCE_STATUS,
  ATT_COLOR,
  ATT_LABEL,
  downloadCsv,
  loadMembers,
  todayStr,
  type Member,
} from "@/lib/org-school";

export function OrgAttendance({ orgId, ctx }: { orgId: string; ctx: any }) {
  const { user } = useAuth();
  const staff = ctx.isStaff;
  const [date, setDate] = useState(todayStr());
  const [members, setMembers] = useState<Member[]>([]);
  const [rows, setRows] = useState<Record<string, { status: string; reason?: string }>>({});
  const [mine, setMine] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ date: todayStr(), kind: "absent", reason: "" });
  const [busy, setBusy] = useState(false);
  const [monthly, setMonthly] = useState<Record<string, Record<string, number>>>({});
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [showMonthly, setShowMonthly] = useState(false);

  const loadMonthly = async () => {
    const { data } = await (supabase as any)
      .from("org_attendance")
      .select("user_id, status")
      .eq("organization_id", orgId)
      .eq("period", 0)
      .gte("date", `${month}-01`)
      .lte("date", `${month}-31`);
    const map: Record<string, Record<string, number>> = {};
    for (const r of data ?? []) {
      map[r.user_id] = map[r.user_id] ?? {};
      map[r.user_id][r.status] = (map[r.user_id][r.status] ?? 0) + 1;
    }
    setMonthly(map);
  };

  useEffect(() => {
    if (staff && showMonthly) loadMonthly();
  }, [orgId, month, staff, showMonthly]);

  useEffect(() => {
    if (staff) loadMembers(orgId).then(setMembers);
  }, [orgId, staff]);

  const loadDay = async () => {
    const { data } = await (supabase as any)
      .from("org_attendance")
      .select("user_id, status, reason")
      .eq("organization_id", orgId)
      .eq("date", date)
      .eq("period", 0);
    const map: Record<string, any> = {};
    for (const r of data ?? []) map[r.user_id] = { status: r.status, reason: r.reason };
    setRows(map);
  };

  const loadRequests = async () => {
    const { data } = await (supabase as any)
      .from("org_absence_requests")
      .select("*")
      .eq("organization_id", orgId)
      .order("date", { ascending: false })
      .limit(50);
    setRequests(data ?? []);
  };

  const loadMine = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("org_attendance")
      .select("date, status, reason")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(60);
    setMine(data ?? []);
  };

  useEffect(() => {
    if (staff) loadDay();
  }, [orgId, date, staff]);
  useEffect(() => {
    loadRequests();
    if (!staff) loadMine();
  }, [orgId, staff, user?.id]);

  const setStatus = async (uid: string, status: string) => {
    setRows((r) => ({ ...r, [uid]: { ...(r[uid] ?? {}), status } }));
    const { error } = await (supabase as any).from("org_attendance").upsert(
      {
        organization_id: orgId,
        user_id: uid,
        date,
        period: 0,
        status,
        reason: rows[uid]?.reason ?? null,
        recorded_by: user?.id ?? null,
      },
      { onConflict: "organization_id,user_id,date,period" },
    );
    if (error) toast.error(error.message);
  };

  const markAllPresent = async () => {
    setBusy(true);
    const payload = members.map((m) => ({
      organization_id: orgId,
      user_id: m.user_id,
      date,
      period: 0,
      status: rows[m.user_id]?.status ?? "present",
      recorded_by: user?.id ?? null,
    }));
    const { error } = await (supabase as any)
      .from("org_attendance")
      .upsert(payload, { onConflict: "organization_id,user_id,date,period" });
    setBusy(false);
    if (error) return toast.error(error.message);
    await loadDay();
    toast.success("全員を出席として記録しました");
  };

  const review = async (id: string, status: string) => {
    const req = requests.find((r) => r.id === id);
    const { error } = await (supabase as any)
      .from("org_absence_requests")
      .update({ status, reviewed_by: user?.id ?? null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    if (status === "approved" && req) {
      await (supabase as any).from("org_attendance").upsert(
        {
          organization_id: orgId,
          user_id: req.user_id,
          date: req.date,
          period: 0,
          status: req.kind,
          reason: req.reason,
          recorded_by: user?.id ?? null,
        },
        { onConflict: "organization_id,user_id,date,period" },
      );
    }
    loadRequests();
    if (req?.date === date) loadDay();
  };

  const submitRequest = async () => {
    if (!user) return;
    if (!form.reason.trim()) return toast.error("理由を入力してください");
    setBusy(true);
    const { error } = await (supabase as any).from("org_absence_requests").insert({
      organization_id: orgId,
      user_id: user.id,
      date: form.date,
      kind: form.kind,
      reason: form.reason.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setForm({ ...form, reason: "" });
    loadRequests();
    toast.success("欠席連絡を送信しました");
  };

  const list = useMemo(
    () => members.filter((m) => !q.trim() || m.name.includes(q.trim())),
    [members, q],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of members) {
      const s = rows[m.user_id]?.status ?? "-";
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [members, rows]);

  if (!staff) {
    const summary = mine.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});
    const myReqs = requests.filter((r) => r.user_id === user?.id);
    return (
      <div className="space-y-4">
        <Card className="p-4 space-y-2">
          <div className="font-bold text-sm">欠席・遅刻の連絡</div>
          <div className="flex flex-wrap gap-2">
            <Input
              type="date"
              className="h-9 w-40"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            {ABSENCE_KINDS.map((k) => (
              <Button
                key={k.key}
                size="sm"
                variant={form.kind === k.key ? "default" : "outline"}
                onClick={() => setForm({ ...form, kind: k.key })}
              >
                {k.label}
              </Button>
            ))}
          </div>
          <Textarea
            rows={2}
            placeholder="理由（体調不良・通院など）"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
          <Button size="sm" disabled={busy} onClick={submitRequest}>
            <Send className="h-3.5 w-3.5 mr-1" />
            送信
          </Button>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="font-bold text-sm">送った連絡</div>
          {myReqs.length === 0 && (
            <div className="text-xs text-muted-foreground">まだありません。</div>
          )}
          {myReqs.map((r) => (
            <div key={r.id} className="text-xs flex gap-2 items-center border-b py-1">
              <span>{r.date}</span>
              <span>{ABSENCE_KINDS.find((k) => k.key === r.kind)?.label}</span>
              <span className="text-muted-foreground truncate flex-1">{r.reason}</span>
              <span className="px-1.5 rounded bg-muted">
                {r.status === "pending" ? "確認待ち" : r.status === "approved" ? "受理" : "却下"}
              </span>
            </div>
          ))}
        </Card>

        <Card className="p-4 space-y-2">
          <div className="font-bold text-sm">わたしの出欠（直近）</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {ATTENDANCE_STATUS.map((s) => (
              <span
                key={s.key}
                className="px-2 py-0.5 rounded"
                style={{ background: s.color + "22" }}
              >
                {s.label} {summary[s.key] ?? 0}
              </span>
            ))}
          </div>
          {mine.map((r, i) => (
            <div key={i} className="text-xs flex gap-2 border-b py-1">
              <span className="w-24">{r.date}</span>
              <span style={{ color: ATT_COLOR[r.status] }}>{ATT_LABEL[r.status] ?? r.status}</span>
              <span className="text-muted-foreground">{r.reason}</span>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === "pending");

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <Card className="p-4 space-y-2 border-amber-500/60">
          <div className="font-bold text-sm">未確認の欠席連絡（{pending.length}件）</div>
          {pending.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs border-b py-1">
              <span className="w-24">{r.date}</span>
              <span>{ABSENCE_KINDS.find((k) => k.key === r.kind)?.label}</span>
              <span className="flex-1 text-muted-foreground truncate">{r.reason}</span>
              <Button size="sm" variant="outline" onClick={() => review(r.id, "approved")}>
                受理して記録
              </Button>
              <Button size="sm" variant="ghost" onClick={() => review(r.id, "rejected")}>
                却下
              </Button>
            </div>
          ))}
        </Card>
      )}

      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Input
          type="date"
          className="h-9 w-40"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button size="sm" variant="outline" disabled={busy} onClick={markAllPresent}>
          <Check className="h-3.5 w-3.5 mr-1" />
          全員を出席に
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadCsv(`attendance-${date}.csv`, [
              ["名前", "状態", "理由"],
              ...members.map((m) => [
                m.name,
                ATT_LABEL[rows[m.user_id]?.status ?? ""] ?? "",
                rows[m.user_id]?.reason ?? "",
              ]),
            ])
          }
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          CSV
        </Button>
        <Button
          size="sm"
          variant={showMonthly ? "default" : "outline"}
          onClick={() => setShowMonthly((v) => !v)}
        >
          月次集計
        </Button>
        <Input
          className="h-9 w-40 ml-auto"
          placeholder="名前で検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </Card>

      <div className="flex flex-wrap gap-2 text-xs">
        {ATTENDANCE_STATUS.map((s) => (
          <span key={s.key} className="px-2 py-0.5 rounded" style={{ background: s.color + "22" }}>
            {s.label} {counts[s.key] ?? 0}
          </span>
        ))}
        <span className="px-2 py-0.5 rounded bg-muted">未入力 {counts["-"] ?? 0}</span>
      </div>

      {showMonthly && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="font-bold text-sm">月次の出席集計</div>
            <Input
              type="month"
              className="h-8 w-36"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadCsv(`attendance-monthly-${month}.csv`, [
                  ["名前", "出席", "遅刻", "早退", "欠席", "公欠", "出席率(%)"],
                  ...members.map((m) => {
                    const r = monthly[m.user_id] ?? {};
                    const total = Object.values(r).reduce((a, b) => a + b, 0);
                    const att = (r.present ?? 0) + (r.late ?? 0) + (r.early ?? 0);
                    return [
                      m.name,
                      r.present ?? 0,
                      r.late ?? 0,
                      r.early ?? 0,
                      r.absent ?? 0,
                      r.excused ?? 0,
                      total > 0 ? Math.round((att / total) * 100) : "-",
                    ];
                  }),
                ])
              }
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
          </div>
          {members.map((m) => {
            const r = monthly[m.user_id] ?? {};
            const total = Object.values(r).reduce((a, b) => a + b, 0);
            const att = (r.present ?? 0) + (r.late ?? 0) + (r.early ?? 0);
            const rate = total > 0 ? Math.round((att / total) * 100) : null;
            return (
              <div
                key={m.user_id}
                className="flex flex-wrap items-center gap-2 text-xs border-b py-1"
              >
                <span className="w-40 truncate">{m.name}</span>
                <span>出席 {r.present ?? 0}</span>
                <span>遅刻 {r.late ?? 0}</span>
                <span>早退 {r.early ?? 0}</span>
                <span>欠席 {r.absent ?? 0}</span>
                <span>公欠 {r.excused ?? 0}</span>
                <span className="ml-auto font-medium">
                  {rate === null ? "記録なし" : `出席率 ${rate}%`}
                </span>
              </div>
            );
          })}
        </Card>
      )}

      {list.map((m) => (
        <Card key={m.user_id} className="p-2 flex flex-wrap items-center gap-2">
          <div className="w-40 truncate text-sm">{m.name}</div>
          <div className="flex flex-wrap gap-1">
            {ATTENDANCE_STATUS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={rows[m.user_id]?.status === s.key ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                style={
                  rows[m.user_id]?.status === s.key
                    ? { background: s.color, borderColor: s.color, color: "#fff" }
                    : undefined
                }
                onClick={() => setStatus(m.user_id, s.key)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </Card>
      ))}
      {list.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">メンバーがいません。</Card>
      )}
    </div>
  );
}
