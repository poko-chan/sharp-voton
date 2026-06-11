import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Swords, Trophy, Clock, Zap, RefreshCw, Smile, Flag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/battle")({ component: BattlePage });

const GENRES = ["総合","数学","英語","国語","理科","社会"] as const;
const STAMPS = ["👍","🔥","😎","😂","💪","🎉","🤔","🙏"] as const;

// Mini quiz set (offline) — simple but real questions
const POOL: Record<string, { q: string; a: string; opts: string[] }[]> = {
  数学: [
    { q: "12 × 8 = ?", a: "96", opts: ["86","96","106","98"] },
    { q: "144 の平方根は?", a: "12", opts: ["10","11","12","14"] },
    { q: "3x = 21 のとき x は?", a: "7", opts: ["3","6","7","9"] },
    { q: "30°の sin は?", a: "1/2", opts: ["1/2","√2/2","√3/2","1"] },
    { q: "5! は?", a: "120", opts: ["60","100","120","240"] },
  ],
  英語: [
    { q: "「冒険」の英語は?", a: "adventure", opts: ["adventure","advantage","adversity","advance"] },
    { q: "過去形: go →", a: "went", opts: ["goed","went","gone","going"] },
    { q: "「美しい」は?", a: "beautiful", opts: ["beautiful","ugly","busy","brief"] },
    { q: "I ___ a student. に入るのは?", a: "am", opts: ["am","is","are","be"] },
    { q: "「図書館」は?", a: "library", opts: ["liberty","library","laboratory","luxury"] },
  ],
  国語: [
    { q: "「漱石」の読みは?", a: "そうせき", opts: ["そうせき","そうしょく","しょうせき","しゅうせき"] },
    { q: "枕草子の作者は?", a: "清少納言", opts: ["紫式部","清少納言","鴨長明","兼好法師"] },
    { q: "対義語: 抽象 ↔ ?", a: "具体", opts: ["具体","具現","抽出","具象"] },
    { q: "「矛盾」の由来の国は?", a: "中国", opts: ["日本","中国","インド","韓国"] },
    { q: "五七五は何?", a: "俳句", opts: ["短歌","俳句","川柳","和歌"] },
  ],
  理科: [
    { q: "水の化学式は?", a: "H2O", opts: ["O2","H2O","CO2","H2"] },
    { q: "地球から一番近い恒星は?", a: "太陽", opts: ["月","火星","太陽","シリウス"] },
    { q: "光合成で出るのは?", a: "酸素", opts: ["窒素","酸素","水素","二酸化炭素"] },
    { q: "電気の単位は?", a: "ボルト", opts: ["ニュートン","ボルト","ジュール","ワット"] },
    { q: "ヒトの染色体は何本?", a: "46", opts: ["23","46","48","92"] },
  ],
  社会: [
    { q: "日本の首都は?", a: "東京", opts: ["京都","大阪","東京","名古屋"] },
    { q: "鎌倉幕府を開いたのは?", a: "源頼朝", opts: ["足利尊氏","源頼朝","徳川家康","織田信長"] },
    { q: "アメリカ大統領の任期は?", a: "4年", opts: ["2年","4年","5年","6年"] },
    { q: "EUの本部があるのは?", a: "ブリュッセル", opts: ["パリ","ベルリン","ブリュッセル","ローマ"] },
    { q: "ASEANの加盟国はおよそ?", a: "10", opts: ["5","10","15","20"] },
  ],
};
function buildPool(genre: string) {
  return genre === "総合" ? Object.values(POOL).flat() : (POOL[genre] ?? []);
}
function pickQ(pool: { q: string; a: string; opts: string[] }[]) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function BattlePage() {
  const { user } = useAuth();
  const [battles, setBattles] = useState<any[]>([]);
  const [opponent, setOpponent] = useState("");
  const [genre, setGenre] = useState<string>("総合");
  const [active, setActive] = useState<any | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await (supabase as any).from("quiz_battles").select("*")
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order("created_at", { ascending: false }).limit(20);
    setBattles(data ?? []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const challenge = async () => {
    if (!user || !opponent) return;
    const { data: p } = await supabase.from("profiles").select("id").eq("username", opponent).maybeSingle();
    if (!p) return toast.error("ユーザーが見つかりません");
    await (supabase as any).from("quiz_battles").insert({ challenger_id: user.id, opponent_id: p.id, genre, num_questions: 0 });
    toast.success("対戦を申し込みました");
    setOpponent(""); load();
  };

  const recordScore = async (b: any, score: number, timeSec: number) => {
    const isChallenger = b.challenger_id === user!.id;
    const patch: any = isChallenger ? { challenger_score: score } : { opponent_score: score };
    patch.time_taken = timeSec;
    const other = isChallenger ? b.opponent_score : b.challenger_score;
    if (other > 0) {
      patch.status = "finished";
      patch.winner_id = score > other ? user!.id : (score < other ? (isChallenger ? b.opponent_id : b.challenger_id) : null);
    }
    await (supabase as any).from("quiz_battles").update(patch).eq("id", b.id);
    load();
  };

  if (active) return <BattlePlay battle={active} onDone={async (s, t) => { await recordScore(active, s, t); setActive(null); }} onQuit={() => setActive(null)} />;

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2"><Swords /> 学習バトル</h1>
      <Card className="p-4 mb-4 bg-muted/40 text-sm space-y-1">
        <div className="font-semibold">遊び方</div>
        <ol className="list-decimal pl-5 space-y-0.5 text-muted-foreground">
          <li>ジャンルを選び、相手のユーザー名を入力して「挑戦」</li>
          <li>「プレイ」で4択エンドレスバトル開始。10秒/問。間違えるか中断するまで続く</li>
          <li>連続正解でコンボ倍率UP（最大×5）。タイムも記録</li>
          <li>両者がプレイ済みで勝敗が確定 — スコアが高い方の勝利</li>
        </ol>
      </Card>
      <Card className="p-4 mb-6 grid sm:grid-cols-3 gap-2">
        <Select value={genre} onValueChange={setGenre}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="相手のユーザー名" value={opponent} onChange={(e) => setOpponent(e.target.value)} className="sm:col-span-1" />
        <Button onClick={challenge}>挑戦</Button>
      </Card>
      <div className="space-y-2">
        {battles.map((b) => {
          const isChallenger = b.challenger_id === user?.id;
          const myScore = isChallenger ? b.challenger_score : b.opponent_score;
          const oppScore = isChallenger ? b.opponent_score : b.challenger_score;
          const played = myScore > 0 || (b.status === "finished");
          return (
            <Card key={b.id} className="p-3 flex items-center justify-between">
              <div>
                <div className="text-sm flex items-center gap-2">
                  {isChallenger ? "→ 挑戦中" : "← 受け入れ"}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{b.genre ?? "総合"}</span>
                  <span className="text-[10px] text-muted-foreground">エンドレス</span>
                </div>
                <div className="text-xs text-muted-foreground">あなた {myScore} vs 相手 {oppScore}{b.time_taken ? ` · ${b.time_taken}s` : ""}</div>
              </div>
              {b.status === "finished" ? (
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold">{b.winner_id === user?.id ? <span className="text-green-600 flex items-center gap-1"><Trophy className="w-4 h-4" />勝ち</span> : b.winner_id ? "負け" : "引き分け"}</div>
                  <Button size="sm" variant="outline" onClick={async () => {
                    const { data } = await (supabase as any).from("quiz_battles").insert({ challenger_id: user!.id, opponent_id: isChallenger ? b.opponent_id : b.challenger_id, genre: b.genre, num_questions: 0 }).select().single();
                    if (data) { toast.success("リマッチを申し込みました"); load(); }
                  }}><RefreshCw className="h-3 w-3 mr-1" />リマッチ</Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => setActive(b)} disabled={played}>プレイ</Button>
              )}
            </Card>
          );
        })}
        {battles.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">対戦履歴がありません</Card>}
      </div>
    </div>
  );
}

function BattlePlay({ battle, onDone, onQuit }: { battle: any; onDone: (score: number, timeSec: number) => void; onQuit: () => void }) {
  const pool = useMemo(() => buildPool(battle.genre ?? "総合"), [battle.id]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [q, setQ] = useState<{ q: string; a: string; opts: string[] }>(() => pickQ(pool));
  const [over, setOver] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [time, setTime] = useState(10);
  const start = useRef(Date.now());
  const tick = useRef<any>(null);
  const [stamp, setStamp] = useState<string | null>(null);

  useEffect(() => {
    setTime(10); setPicked(null);
    if (tick.current) clearInterval(tick.current);
    tick.current = setInterval(() => setTime((t) => {
      if (t <= 1) { clearInterval(tick.current); advance(null); return 0; }
      return t - 1;
    }), 1000);
    return () => clearInterval(tick.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const advance = (sel: string | null) => {
    if (tick.current) clearInterval(tick.current);
    setPicked(sel);
    const correct = sel === q.a;
    if (correct) {
      const mult = Math.min(combo + 1, 5);
      setScore((s) => s + mult);
      setCombo((c) => c + 1);
    } else {
      setCombo(0);
    }
    setTimeout(() => {
      if (!correct) {
        const t = Math.round((Date.now() - start.current) / 1000);
        setOver(true);
        onDone(score, t);
        return;
      }
      setQ(pickQ(pool));
      setIdx((i) => i + 1);
    }, 800);
  };

  if (over) return null;
  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Swords /> エンドレスバトル</h1>
        <Button variant="ghost" size="sm" onClick={() => { const t = Math.round((Date.now() - start.current) / 1000); onDone(score, t); }}><Flag className="h-3 w-3 mr-1" />終了</Button>
      </div>
      <Card className="p-2 flex items-center gap-3">
        <div className="text-xs">問 {idx+1}</div>
        <Progress value={(time / 10) * 100} className="flex-1 h-2" />
        <div className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" />{time}s</div>
        <div className="text-xs flex items-center gap-1"><Zap className="h-3 w-3 text-amber-500" />{score}</div>
        {combo > 1 && <div className="text-xs font-bold text-orange-500">×{Math.min(combo, 5)} COMBO</div>}
      </Card>
      <Card className="p-6 space-y-3">
        <div className="text-xl font-medium">{q.q}</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {q.opts.map((o: string) => {
            const isCorrect = o === q.a;
            const isPicked = picked === o;
            return (
              <Button key={o} variant="outline" disabled={picked != null}
                className={`justify-start ${picked && isCorrect ? "border-success bg-success/10" : ""} ${isPicked && !isCorrect ? "border-destructive bg-destructive/10" : ""}`}
                onClick={() => advance(o)}>{o}</Button>
            );
          })}
        </div>
      </Card>
      <Card className="p-2">
        <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Smile className="h-3 w-3" />スタンプ</div>
        <div className="flex gap-1 mt-1">
          {STAMPS.map((s) => (
            <button key={s} onClick={() => { setStamp(s); setTimeout(() => setStamp(null), 1200); }} className="text-2xl hover:scale-125 transition">{s}</button>
          ))}
          {stamp && <div className="text-3xl animate-bounce ml-3">{stamp}</div>}
        </div>
      </Card>
    </div>
  );
}