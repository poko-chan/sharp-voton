import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { loadOrgProfiles, nameOf } from "@/lib/org-apps";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarRange, Copy, Save } from "lucide-react";
import { toast } from "sonner";

type Rec = { grade: string; class_name: string; student_number: string };

/** 日本の年度（4月始まり） */
export function currentSchoolYear(d = new Date()) {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

function bumpGrade(g: string) {
  const m = g.match(/^(\D*)(\d+)(\D*)$/);
  return m ? `${m[1]}${Number(m[2]) + 1}${m[3]}` : g;
}

/** 年度ごとの生徒プロフィール（学年・クラス・番号）。年度が変わっても過去の記録は残る。 */
export function OrgYearRoster({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const [year, setYear] = useState(currentSchoolYear());
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [rows, setRows] = useState<Record<string, Rec>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", orgId)
        .eq("suspended", false)
        .eq("role", "member");
      const list = data ?? [];
      setMembers(list);
      setProfiles(await loadOrgProfiles(orgId, list.map((m: any) => m.user_id)));
    })();
  }, [orgId]);

  const loadYear = async (y: number) => {
    const { data, error } = await (supabase as any)
      .from("org_student_records")
      .select("user_id, grade, class_name, student_number")
      .eq("organization_id", orgId)
      .eq("school_year", y);
    if (error) {
      toast.error(error.message);
      return {} as Record<string, Rec>;
    }
    const map: Record<string, Rec> = {};
    for (const r of data ?? [])
      map[r.user_id] = {
        grade: r.grade ?? "",
        class_name: r.class_name ?? "",
        student_number: r.student_number ?? "",
      };
    return map;
  };

  useEffect(() => {
    loadYear(year).then((m) => {
      setRows(m);
      setDirty(new Set());
    });
  }, [orgId, year]);

  const edit = (uid: string, k: keyof Rec, v: string) => {
    setRows((r) => ({
      ...r,
      [uid]: { ...(r[uid] ?? { grade: "", class_name: "", student_number: "" }), [k]: v },
    }));
    setDirty((d) => new Set(d).add(uid));
  };

  const save = async () => {
    if (!dirty.size) return;
    setBusy(true);
    const payload = [...dirty].map((uid) => ({
      organization_id: orgId,
      user_id: uid,
      school_year: year,
      grade: rows[uid]?.grade.trim() || null,
      class_name: rows[uid]?.class_name.trim() || null,
      student_number: rows[uid]?.student_number.trim() || null,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await (supabase as any)
      .from("org_student_records")
      .upsert(payload, { onConflict: "organization_id,user_id,school_year" });
    setBusy(false);
    if (error) return toast.error(error.message);
    setDirty(new Set());
    toast.success(`${year}年度の名簿を保存しました（${payload.length}人）`);
  };

  const promote = async () => {
    const prev = await loadYear(year - 1);
    const ids = Object.keys(prev);
    if (!ids.length) return toast.error(`${year - 1}年度の記録がありません`);
    if (!confirm(`${year - 1}年度の名簿をもとに、学年を1つ上げて${year}年度に下書きします。クラスと番号は空になります。`))
      return;
    const next = { ...rows };
    const d = new Set(dirty);
    for (const uid of ids) {
      if (next[uid]?.grade) continue;
      next[uid] = { grade: bumpGrade(prev[uid].grade), class_name: "", student_number: "" };
      d.add(uid);
    }
    setRows(next);
    setDirty(d);
    toast.success("下書きしました。確認して「保存」を押してください");
  };

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return members
      .filter((m) => !s || nameOf(profiles[m.user_id]).toLowerCase().includes(s))
      .sort((a, b) => {
        const ra = rows[a.user_id], rb = rows[b.user_id];
        return (
          (ra?.grade ?? "").localeCompare(rb?.grade ?? "", "ja", { numeric: true }) ||
          (ra?.class_name ?? "").localeCompare(rb?.class_name ?? "", "ja", { numeric: true }) ||
          (ra?.student_number ?? "").localeCompare(rb?.student_number ?? "", "ja", { numeric: true })
        );
      });
  }, [members, profiles, rows, q]);

  const years = [currentSchoolYear() + 1, ...Array.from({ length: 6 }, (_, i) => currentSchoolYear() - i)];

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
      <Link to="/organizations/$orgId" params={{ orgId }} className="text-sm underline text-muted-foreground">
        ← 組織ホームへ
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold mr-auto">年度別 生徒プロフィール</h1>
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={year}
          onChange={(e) => {
            if (dirty.size && !confirm("保存していない変更があります。年度を切り替えますか？")) return;
            setYear(Number(e.target.value));
          }}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}年度
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={promote}>
          <Copy className="h-4 w-4 mr-1" />
          前年度から進級
        </Button>
        <Button size="sm" onClick={save} disabled={busy || !dirty.size}>
          <Save className="h-4 w-4 mr-1" />
          保存{dirty.size ? `（${dirty.size}）` : ""}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        年度ごとに記録が分かれるので、進級・クラス替えをしても前の年度の学年・クラスは残ります。生徒本人は自分の記録だけ見られます。
      </p>
      <Input placeholder="名前で絞り込み" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      <Card className="divide-y">
        <div className="grid grid-cols-[1fr_6rem_6rem_6rem] gap-2 p-2 text-xs font-bold text-muted-foreground">
          <div>生徒</div>
          <div>学年</div>
          <div>クラス</div>
          <div>番号</div>
        </div>
        {list.length === 0 && <div className="p-4 text-sm text-muted-foreground">生徒（一般メンバー）がいません</div>}
        {list.map((m) => {
          const r = rows[m.user_id] ?? { grade: "", class_name: "", student_number: "" };
          return (
            <div
              key={m.user_id}
              className={`grid grid-cols-[1fr_6rem_6rem_6rem] items-center gap-2 p-2 ${dirty.has(m.user_id) ? "bg-primary/5" : ""}`}
            >
              <div className="truncate text-sm">{nameOf(profiles[m.user_id])}</div>
              <Input value={r.grade} maxLength={20} placeholder="1年" onChange={(e) => edit(m.user_id, "grade", e.target.value)} />
              <Input value={r.class_name} maxLength={20} placeholder="A組" onChange={(e) => edit(m.user_id, "class_name", e.target.value)} />
              <Input value={r.student_number} maxLength={20} placeholder="1" onChange={(e) => edit(m.user_id, "student_number", e.target.value)} />
            </div>
          );
        })}
      </Card>
    </div>
  );
}
