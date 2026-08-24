import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, Flag } from "lucide-react";
import { toast } from "sonner";
import { BarChart3, Clock, Users, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/materials/$id")({ component: MaterialDetail });

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border p-2">
      <div className="text-[10px] text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="font-bold tabular-nums text-sm">{value}</div>
    </div>
  );
}

const FIELDS: [string,string][] = [
  ["title","タイトル"],["subtitle","サブタイトル"],["isbn","ISBN"],["barcode","バーコード"],
  ["subject","教科"],["sub_subject","分野"],["publisher","出版社"],["author","著者"],
  ["edition","版"],["year","発行年"],["pages","ページ数"],["price","価格"],
  ["level","難易度ラベル"],["difficulty","難易度(1-10)"],["target_grade","対象学年"],
  ["target_exam","対象試験"],["category","カテゴリ"],["format","形式"],
  ["language","言語"],["series","シリーズ"],["volume","巻/号"],
  ["cover_url","表紙URL"],["url","公式URL"],["recommend_for","おすすめ対象"],
  ["description","説明"],["table_of_contents","目次"],
];

function MaterialDetail() {
  const { id } = useParams({ from: "/_authenticated/materials/$id" });
  const { user } = useAuth();
  const [m, setM] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [report, setReport] = useState("");
  const [myUse, setMyUse] = useState<any>(null);
  const [globalUse, setGlobalUse] = useState<any>(null);

  const load = async () => {
    const { data } = await (supabase as any).from("materials").select("*").eq("id", id).maybeSingle();
    setM(data);
    if (user) {
      const { data: r } = await (supabase as any).rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(!!r);
      const { data: mu } = await (supabase as any).rpc("my_material_usage");
      setMyUse((mu ?? []).find((r: any) => r.material_id === id) ?? null);
      const { data: gu } = await (supabase as any).rpc("material_global_usage", { _material_id: id });
      setGlobalUse(Array.isArray(gu) ? gu[0] : gu);
    }
  };
  useEffect(() => { load(); }, [id]);

  if (!m) return <div className="p-6">読み込み中…</div>;

  const submitEdit = async () => {
    const patch: any = {};
    for (const [k] of FIELDS) if (edit[k] !== undefined && edit[k] !== (m[k] ?? "")) patch[k] = edit[k];
    if (Object.keys(patch).length === 0) return toast.error("変更がありません");
    if (isAdmin) {
      const { error } = await (supabase as any).from("materials").update({ ...patch }).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("反映しました");
    } else {
      const { error } = await (supabase as any).from("material_edits").insert({ material_id: id, proposer: user!.id, patch });
      if (error) return toast.error(error.message);
      toast.success("編集申請を送信しました（管理者の承認後に反映）");
    }
    setEditing(false); setEdit({}); load();
  };

  const reportThis = async () => {
    if (!report.trim()) return;
    const { error } = await (supabase as any).from("material_reports").insert({ material_id: id, reporter: user!.id, reason: report });
    if (error) return toast.error(error.message);
    toast.success("報告しました"); setReport("");
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Link to="/materials" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-3"><ArrowLeft className="h-3 w-3" />一覧へ</Link>
      <Card className="p-4 flex gap-4 mb-4">
        {m.cover_url ? <img src={m.cover_url} alt="" className="w-28 h-36 object-cover rounded" /> : <div className="w-28 h-36 bg-muted rounded" />}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{m.title}</h1>
          {m.subtitle && <div className="text-sm text-muted-foreground">{m.subtitle}</div>}
          <div className="flex gap-1 flex-wrap mt-2">
            {m.subject && <Badge>{m.subject}</Badge>}
            {m.level && <Badge variant="outline">{m.level}</Badge>}
            {m.status === "pending" && <Badge className="bg-amber-500">非公式</Badge>}
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={() => { setEditing((v) => !v); setEdit({}); }}>
              <Pencil className="h-3 w-3 mr-1" />{isAdmin ? "編集" : "編集を提案"}
            </Button>
          </div>
        </div>
      </Card>

      {editing && (
        <Card className="p-4 mb-4 space-y-2">
          <div className="text-sm font-bold">{isAdmin ? "編集（即反映）" : "編集申請（承認待ち）"}</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {FIELDS.map(([k, label]) => (
              <div key={k}>
                <Label className="text-xs">{label}</Label>
                {k === "description" || k === "table_of_contents" ? (
                  <Textarea value={edit[k] ?? (m[k] ?? "")} onChange={(e) => setEdit((p) => ({ ...p, [k]: e.target.value }))} rows={3} />
                ) : (
                  <Input value={edit[k] ?? (m[k] ?? "")} onChange={(e) => setEdit((p) => ({ ...p, [k]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={submitEdit}>{isAdmin ? "保存" : "申請"}</Button>
            <Button variant="outline" onClick={() => setEditing(false)}>キャンセル</Button>
          </div>
        </Card>
      )}

      <Card className="p-4 mb-4">
        <div className="text-sm font-bold mb-2">詳細</div>
        <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {FIELDS.map(([k, label]) => (m[k] ? (
            <div key={k} className="flex gap-2">
              <dt className="text-muted-foreground min-w-[6em]">{label}</dt>
              <dd className="flex-1 break-words">{Array.isArray(m[k]) ? m[k].join(", ") : String(m[k])}</dd>
            </div>
          ) : null))}
        </dl>
      </Card>

      <Card className="p-4 mb-4">
        <div className="text-sm font-bold mb-2 flex items-center gap-2"><BarChart3 className="h-4 w-4" />利用状況</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <Stat icon={<Clock className="h-3.5 w-3.5" />} label="あなたの総学習時間" value={myUse ? `${myUse.total_minutes}分` : "0分"} />
          <Stat icon={<CalendarDays className="h-3.5 w-3.5" />} label="使用日数 / 1日平均" value={myUse ? `${myUse.days_used}日 / ${myUse.daily_avg}分` : "-"} />
          <Stat icon={<Users className="h-3.5 w-3.5" />} label="全体利用者数" value={globalUse ? `${globalUse.users_count}人` : "0人"} />
          <Stat icon={<Clock className="h-3.5 w-3.5" />} label="全体総学習時間" value={globalUse ? `${globalUse.total_minutes}分` : "0分"} />
        </div>
        {(myUse?.first_used || myUse?.last_used) && (
          <div className="text-[11px] text-muted-foreground mt-2">
            初回: {myUse.first_used ?? "-"} ・ 最終: {myUse.last_used ?? "-"}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="text-sm font-bold mb-2 flex items-center gap-2"><Flag className="h-4 w-4" />不正報告</div>
        <div className="flex gap-2">
          <Input placeholder="内容が事実と異なる、不適切など…" value={report} onChange={(e) => setReport(e.target.value)} />
          <Button variant="outline" onClick={reportThis} disabled={!report.trim()}>送信</Button>
        </div>
      </Card>
    </div>
  );
}