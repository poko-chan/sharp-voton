import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Sparkles, Gift, Dice5, Music, FileText, CalendarPlus, Volume2, Mic, Camera } from "lucide-react";
import { ocrLocal } from "@/lib/ocr-local";
import { ChromeAiStatusBadge } from "@/components/ChromeAiStatusBadge";

export const Route = createFileRoute("/_authenticated/tools")({ component: ToolsHub });

const SLOT_COST = 20;
const SLOT_TABLE = [0, 5, 10, 20, 50, 100, 250];

function ToolsHub() {
  const { user } = useAuth();
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2"><Sparkles className="h-7 w-7 text-primary" /><h1 className="text-2xl font-bold">ツールとゲーム</h1></div>
      <ChromeAiStatusBadge />
      <Tabs defaultValue="slot">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="slot"><Dice5 className="h-4 w-4 mr-1" />スロット</TabsTrigger>
          <TabsTrigger value="mystery"><Gift className="h-4 w-4 mr-1" />ミステリー</TabsTrigger>
          <TabsTrigger value="style">スタイル診断</TabsTrigger>
          <TabsTrigger value="voice"><Mic className="h-4 w-4 mr-1" />音声日記</TabsTrigger>
          <TabsTrigger value="tts"><Volume2 className="h-4 w-4 mr-1" />音声コーチ</TabsTrigger>
          <TabsTrigger value="bgm"><Music className="h-4 w-4 mr-1" />BGMミキサー</TabsTrigger>
          <TabsTrigger value="latex"><Camera className="h-4 w-4 mr-1" />数式→LaTeX</TabsTrigger>
          <TabsTrigger value="ics"><CalendarPlus className="h-4 w-4 mr-1" />カレンダー</TabsTrigger>
        </TabsList>
        <TabsContent value="slot"><Slot userId={user?.id} /></TabsContent>
        <TabsContent value="mystery"><Mystery userId={user?.id} /></TabsContent>
        <TabsContent value="style"><StyleDiag userId={user?.id} /></TabsContent>
        <TabsContent value="voice"><VoiceDiary userId={user?.id} /></TabsContent>
        <TabsContent value="tts"><TtsCoach /></TabsContent>
        <TabsContent value="bgm"><BgmMixer /></TabsContent>
        <TabsContent value="latex"><LatexOcr /></TabsContent>
        <TabsContent value="ics"><IcsExport userId={user?.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Slot({ userId }: { userId?: string }) {
  const [result, setResult] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [playedToday, setPlayed] = useState(false);
  useEffect(() => { if (!userId) return; const t = new Date().toISOString().slice(0,10);
    supabase.from("daily_slot_plays").select("date").eq("user_id", userId).eq("date", t).maybeSingle().then(({data})=>setPlayed(!!data)); }, [userId]);
  const spin = async () => {
    if (!userId || playedToday) return;
    setBusy(true);
    const { data: c } = await supabase.from("user_coins").select("balance").eq("user_id", userId).maybeSingle();
    if ((c?.balance ?? 0) < SLOT_COST) { setBusy(false); return toast.error(`${SLOT_COST}コイン必要`); }
    const reward = SLOT_TABLE[Math.floor(Math.random() * SLOT_TABLE.length)];
    const net = reward - SLOT_COST;
    await supabase.from("user_coins").update({ balance: (c?.balance ?? 0) + net }).eq("user_id", userId);
    await supabase.from("daily_slot_plays").insert({ user_id: userId, reward_coins: reward });
    setResult(reward); setPlayed(true); setBusy(false);
    toast.success(reward > 0 ? `${reward}コイン獲得！` : "はずれ…");
  };
  return (<Card className="p-6 text-center space-y-3 mt-4">
    <div className="text-6xl">{busy ? "🎰" : result === null ? "🎲" : result > 50 ? "🎉" : result > 0 ? "🪙" : "😢"}</div>
    <div className="text-sm text-muted-foreground">1日1回・{SLOT_COST}コイン消費</div>
    {result !== null && <div className="text-2xl font-bold">{result} コイン</div>}
    <Button onClick={spin} disabled={busy || playedToday}>{playedToday ? "本日終了" : "スピン"}</Button>
  </Card>);
}

function Mystery({ userId }: { userId?: string }) {
  const [reward, setReward] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);
  useEffect(() => { if (!userId) return; const t = new Date().toISOString().slice(0,10);
    supabase.from("daily_mystery_box").select("reward_coins").eq("user_id", userId).eq("date", t).maybeSingle().then(({data})=>{ if(data){setReward(data.reward_coins); setOpened(true);}}); }, [userId]);
  const open = async () => {
    if (!userId || opened) return;
    const r = [10, 20, 30, 50, 100, 200][Math.floor(Math.random() * 6)];
    const { data: c } = await supabase.from("user_coins").select("balance").eq("user_id", userId).maybeSingle();
    await supabase.from("user_coins").upsert({ user_id: userId, balance: (c?.balance ?? 0) + r });
    await supabase.from("daily_mystery_box").insert({ user_id: userId, reward_coins: r });
    setReward(r); setOpened(true); toast.success(`${r}コイン獲得！`);
  };
  return (<Card className="p-6 text-center space-y-3 mt-4">
    <div className="text-6xl">{opened ? "✨" : "🎁"}</div>
    <div className="text-sm text-muted-foreground">毎日ログイン報酬</div>
    {reward !== null && <div className="text-2xl font-bold">{reward} コイン</div>}
    <Button onClick={open} disabled={opened}>{opened ? "取得済み" : "開ける"}</Button>
  </Card>);
}

const STATS = ["focus", "memory", "logic", "creativity", "stamina"] as const;
function StyleDiag({ userId }: { userId?: string }) {
  const [s, setS] = useState<Record<string, number>>({ focus: 5, memory: 5, logic: 5, creativity: 5, stamina: 5 });
  useEffect(() => { if(!userId)return; supabase.from("style_diagnosis").select("*").eq("user_id", userId).maybeSingle().then(({data})=>{if(data)setS(data as any);}); }, [userId]);
  const save = async () => { if(!userId)return; await supabase.from("style_diagnosis").upsert({ user_id: userId, ...s, updated_at: new Date().toISOString() }); toast.success("保存"); };
  return (<Card className="p-6 space-y-4 mt-4">
    <div className="text-sm text-muted-foreground">RPGのステ振り。強みを可視化して学習傾向を最適化。</div>
    {STATS.map(k => (<div key={k}><div className="flex justify-between text-sm mb-1"><span>{k}</span><span className="font-mono">{s[k]}</span></div>
      <Slider value={[s[k]]} max={10} step={1} onValueChange={(v)=>setS(p=>({...p,[k]:v[0]}))} /></div>))}
    <Button onClick={save} className="w-full">保存</Button>
  </Card>);
}

function VoiceDiary({ userId }: { userId?: string }) {
  const [rec, setRec] = useState<any>(null);
  const [text, setText] = useState("");
  const [list, setList] = useState<any[]>([]);
  const load = () => { if(!userId)return; supabase.from("voice_diaries").select("*").eq("user_id", userId).order("created_at",{ascending:false}).limit(10).then(({data})=>setList(data??[])); };
  useEffect(load, [userId]);
  const start = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return toast.error("音声認識非対応ブラウザ");
    const r = new SR(); r.lang = "ja-JP"; r.continuous = true; r.interimResults = true;
    r.onresult = (e: any) => { let t=""; for (const res of e.results) t += res[0].transcript; setText(t); };
    r.onerror = () => toast.error("音声認識エラー");
    r.start(); setRec(r);
  };
  const stop = async () => { if(!rec)return; rec.stop(); setRec(null); if(!userId||!text)return;
    await supabase.from("voice_diaries").insert({ user_id: userId, transcript: text, summary: text.slice(0,120) });
    setText(""); toast.success("保存"); load(); };
  return (<Card className="p-6 space-y-3 mt-4">
    <div className="flex gap-2"><Button onClick={rec?stop:start} variant={rec?"destructive":"default"}>{rec?"停止して保存":"録音開始"}</Button></div>
    {text && <Textarea value={text} onChange={(e)=>setText(e.target.value)} rows={4} />}
    <div className="space-y-2">{list.map(v=>(<div key={v.id} className="p-2 bg-muted rounded text-sm"><div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString("ja-JP")}</div>{v.summary}</div>))}</div>
  </Card>);
}

function TtsCoach() {
  const speak = (t: string) => { const u = new SpeechSynthesisUtterance(t); u.lang="ja-JP"; speechSynthesis.speak(u); };
  return (<Card className="p-6 space-y-3 mt-4">
    <div className="text-sm text-muted-foreground">タイマー音声コーチのプレビュー</div>
    <div className="flex gap-2 flex-wrap">
      <Button onClick={()=>speak("集中セッションを開始します。準備はいいですか？")}>開始</Button>
      <Button onClick={()=>speak("お疲れさま。5分休憩しましょう。")}>休憩</Button>
      <Button onClick={()=>speak("終了です。よくがんばりました！")}>終了</Button>
    </div>
    <div className="text-xs text-muted-foreground">タイマー画面の設定でON/OFF切替（設定ページ）</div>
  </Card>);
}

function BgmMixer() {
  const [vols, setVols] = useState({ rain: 0.4, cafe: 0.3, noise: 0.2 });
  const urls: Record<string, string> = {
    rain: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_2c1d3d1c9a.mp3",
    cafe: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_1cae8e7e94.mp3",
    noise: "https://cdn.pixabay.com/download/audio/2022/05/16/audio_1808fbf07a.mp3",
  };
  return (<Card className="p-6 space-y-4 mt-4">
    <div className="text-sm text-muted-foreground">複数音を重ねてお好みの集中BGMに</div>
    {Object.entries(urls).map(([k, url])=>(<div key={k}>
      <div className="flex justify-between text-sm mb-1"><span className="capitalize">{k}</span><span className="font-mono">{Math.round(vols[k as keyof typeof vols]*100)}%</span></div>
      <Slider value={[vols[k as keyof typeof vols]*100]} max={100} onValueChange={(v)=>setVols(p=>({...p,[k]:v[0]/100}))} />
      <audio src={url} loop autoPlay muted={vols[k as keyof typeof vols]===0} ref={(el)=>{ if(el) el.volume = vols[k as keyof typeof vols]; }} />
    </div>))}
  </Card>);
}

function LatexOcr() {
  const [busy, setBusy] = useState(false); const [out, setOut] = useState("");
  const run = async (f: File) => {
    setBusy(true); setOut("");
    try {
      const r = await ocrLocal(f, { lang: "eng" });
      // 数式向けに軽く整形（\ を付与できないので生テキスト＋$$で囲むだけ）
      const t = r.text.trim();
      setOut(t ? `$$${t}$$` : "");
    } catch (e:any) { toast.error("認識失敗: " + (e?.message ?? "")); }
    setBusy(false);
  };
  return (<Card className="p-6 space-y-3 mt-4">
    <Input type="file" accept="image/*" disabled={busy} onChange={(e)=>e.target.files?.[0] && run(e.target.files[0])} />
    {busy && <div className="text-sm">認識中…</div>}
    {out && <Textarea readOnly value={out} rows={6} className="font-mono" />}
    <div className="text-xs text-muted-foreground">オフライン（tesseract.js）で処理。数式記号は完璧ではありません</div>
  </Card>);
}

function IcsExport({ userId }: { userId?: string }) {
  const download = async () => {
    if (!userId) return;
    const { data: exams } = await supabase.from("exams").select("id,name,start_date").eq("user_id", userId);
    const { data: logs } = await supabase.from("study_logs").select("date,duration_minutes").eq("user_id", userId).order("date",{ascending:false}).limit(30);
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//StudyPlus//JP\n";
    for (const e of (exams??[])) { const d=String(e.start_date).replace(/-/g,""); ics += `BEGIN:VEVENT\nUID:${e.id}\nDTSTART;VALUE=DATE:${d}\nDTEND;VALUE=DATE:${d}\nSUMMARY:試験 ${e.name}\nEND:VEVENT\n`; }
    for (const l of (logs??[])) { const d=String(l.date).replace(/-/g,""); ics += `BEGIN:VEVENT\nUID:log-${l.date}\nDTSTART;VALUE=DATE:${d}\nDTEND;VALUE=DATE:${d}\nSUMMARY:学習 ${l.duration_minutes}分\nEND:VEVENT\n`; }
    ics += "END:VCALENDAR";
    const blob = new Blob([ics], { type: "text/calendar" }); const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "study.ics"; a.click();
  };
  return (<Card className="p-6 space-y-3 mt-4">
    <div className="text-sm text-muted-foreground">試験・学習ログを .ics で書き出し。Google/Apple Calendar にインポート可</div>
    <Button onClick={download}><FileText className="h-4 w-4 mr-1" />ダウンロード</Button>
  </Card>);
}