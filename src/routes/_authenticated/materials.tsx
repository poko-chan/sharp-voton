import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Book, Plus, Search, Barcode, ScanLine, Flag, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/materials")({ component: MaterialsPage });

const SUBJECTS = ["国語","数学","英語","理科","物理","化学","生物","地学","社会","日本史","世界史","地理","公民","情報","プログラミング","その他"];
const CATEGORIES = ["参考書","問題集","過去問","単語帳","辞書","教科書","ノート","Web教材","その他"];
const FORMATS = ["紙","電子書籍","アプリ","動画","Web"];
const LEVELS = ["入門","基礎","標準","応用","発展","ハイレベル"];

function MaterialsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showMine, setShowMine] = useState(false);

  const load = async () => {
    let qry: any = (supabase as any).from("materials").select("*").order("created_at", { ascending: false }).limit(200);
    if (!showMine) qry = qry.eq("status", "approved");
    else qry = qry.eq("created_by", user!.id);
    if (subject) qry = qry.eq("subject", subject);
    if (q) qry = qry.or(`title.ilike.%${q}%,author.ilike.%${q}%,publisher.ilike.%${q}%,isbn.eq.${q},barcode.eq.${q}`);
    const { data, error } = await qry;
    if (error) return toast.error(error.message);
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, [subject, showMine]);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Book /> 教材データベース</h1>
        <div className="ml-auto flex gap-2 flex-wrap">
          <Button variant={showMine ? "default" : "outline"} size="sm" onClick={() => setShowMine((v) => !v)}>
            {showMine ? "全体" : "自分の投稿"}
          </Button>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />追加</Button></DialogTrigger>
            <AddDialog onSaved={() => { setShowAdd(false); load(); }} />
          </Dialog>
        </div>
      </div>

      <Card className="p-3 mb-4 flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex gap-2">
          <Search className="h-4 w-4 text-muted-foreground self-center" />
          <Input placeholder="タイトル / 著者 / 出版社 / ISBN / バーコード" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <Button size="sm" onClick={load}>検索</Button>
        </div>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className="p-2 border rounded bg-background text-sm">
          <option value="">全教科</option>
          {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <BarcodeScanButton onScan={(code) => { setQ(code); setTimeout(load, 0); }} />
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.length === 0 && <Card className="p-6 col-span-full text-center text-sm text-muted-foreground">教材がありません。「追加」から登録できます。</Card>}
        {items.map((m) => (
          <Link key={m.id} to="/materials/$id" params={{ id: m.id }} className="block">
            <Card className="p-3 hover:bg-accent/40 transition flex gap-3">
              {m.cover_url ? <img src={m.cover_url} alt={m.title} className="w-16 h-20 object-cover rounded" /> : <div className="w-16 h-20 bg-muted rounded flex items-center justify-center text-xs">No img</div>}
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{m.title}</div>
                {m.subtitle && <div className="text-xs text-muted-foreground truncate">{m.subtitle}</div>}
                <div className="flex gap-1 flex-wrap mt-1">
                  {m.subject && <Badge variant="secondary" className="text-[10px]">{m.subject}</Badge>}
                  {m.level && <Badge variant="outline" className="text-[10px]">{m.level}</Badge>}
                  {m.status !== "approved" && <Badge className="text-[10px] bg-amber-500">{m.status}</Badge>}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 truncate">{m.publisher}{m.author ? ` / ${m.author}` : ""}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function BarcodeScanButton({ onScan }: { onScan: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Barcode className="h-4 w-4 mr-1" />スキャン</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>バーコード入力</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">ISBN/JANを直接入力するか、外部スキャナの結果を貼り付けてください。</div>
          <Input placeholder="9784XXXXXXXXX" value={manual} onChange={(e) => setManual(e.target.value)} />
          <Button onClick={() => { onScan(manual.trim()); setOpen(false); }} disabled={!manual.trim()} className="w-full">
            <ScanLine className="h-4 w-4 mr-1" />このコードで検索
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddDialog({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [f, setF] = useState<any>({ title: "", subject: "", category: "参考書", format: "紙", language: "ja" });
  const upd = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.title) return toast.error("タイトル必須");
    const payload: any = { ...f, created_by: user!.id };
    ["year","pages","difficulty","price"].forEach((k) => { if (payload[k] === "") delete payload[k]; else if (payload[k] != null) payload[k] = parseInt(payload[k]); });
    if (payload.tags && typeof payload.tags === "string") payload.tags = payload.tags.split(",").map((s: string) => s.trim()).filter(Boolean);
    const { error } = await (supabase as any).from("materials").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("登録しました（管理者作成は即公開、一般は承認待ち）");
    onSaved();
  };
  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
      <DialogHeader><DialogTitle>教材を追加（20+項目）</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {[
          ["title","タイトル*"],["subtitle","サブタイトル"],
          ["isbn","ISBN"],["barcode","バーコード/JAN"],
          ["publisher","出版社"],["author","著者"],
          ["edition","版"],["year","発行年(数値)"],
          ["pages","ページ数(数値)"],["price","価格(円)"],
          ["series","シリーズ"],["volume","巻/号"],
          ["target_grade","対象学年"],["target_exam","対象試験"],
          ["sub_subject","分野"],["recommend_for","おすすめ対象"],
          ["url","公式URL"],["cover_url","表紙画像URL"],
        ].map(([k,label]) => (
          <div key={k} className="col-span-1">
            <Label className="text-xs">{label}</Label>
            <Input value={f[k] ?? ""} onChange={(e) => upd(k, e.target.value)} />
          </div>
        ))}
        {[["subject",SUBJECTS,"教科"],["category",CATEGORIES,"カテゴリ"],["format",FORMATS,"形式"],["level",LEVELS,"難易度ラベル"]].map(([k,opts,label]) => (
          <div key={k as string} className="col-span-1">
            <Label className="text-xs">{label as string}</Label>
            <select value={f[k as string] ?? ""} onChange={(e) => upd(k as string, e.target.value)} className="w-full p-2 border rounded bg-background">
              <option value="">—</option>
              {(opts as string[]).map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div className="col-span-1">
          <Label className="text-xs">難易度(1-10)</Label>
          <Input type="number" min={1} max={10} value={f.difficulty ?? ""} onChange={(e) => upd("difficulty", e.target.value)} />
        </div>
        <div className="col-span-1">
          <Label className="text-xs">タグ(カンマ区切り)</Label>
          <Input value={f.tags ?? ""} onChange={(e) => upd("tags", e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">説明</Label>
          <Textarea value={f.description ?? ""} onChange={(e) => upd("description", e.target.value)} rows={3} />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">目次</Label>
          <Textarea value={f.table_of_contents ?? ""} onChange={(e) => upd("table_of_contents", e.target.value)} rows={4} />
        </div>
      </div>
      <Button onClick={save} className="w-full mt-3">登録</Button>
    </DialogContent>
  );
}