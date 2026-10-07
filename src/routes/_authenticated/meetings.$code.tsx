import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  Hand,
  MessageSquare,
  Users,
  PhoneOff,
  Crown,
  Copy,
  Lock,
  Unlock,
  X,
  Loader2,
  Send,
  UserMinus,
  Settings2,
  CheckCircle2,
  Clock,
  BookOpen,
  Download,
  Maximize,
  Minimize,
  Pin,
  PinOff,
  LayoutGrid,
  UserSquare,
  SmilePlus,
  ThumbsUp,
  Heart,
  PartyPopper,
  Lightbulb,
  Sparkles,
} from "lucide-react";

const REACTIONS = [
  { k: "clap", label: "拍手", Icon: Sparkles },
  { k: "like", label: "いいね", Icon: ThumbsUp },
  { k: "heart", label: "ハート", Icon: Heart },
  { k: "party", label: "おめでとう", Icon: PartyPopper },
  { k: "idea", label: "なるほど", Icon: Lightbulb },
] as const;

function MicLevel({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const t = stream?.getAudioTracks()[0];
    if (!t) return;
    const ctx = new AudioContext();
    const an = ctx.createAnalyser();
    an.fftSize = 256;
    ctx.createMediaStreamSource(new MediaStream([t])).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    let raf = 0;
    const loop = () => {
      an.getByteTimeDomainData(buf);
      let s = 0;
      for (const v of buf) s += (v - 128) ** 2;
      const lvl = Math.min(1, Math.sqrt(s / buf.length) / 30);
      if (ref.current) ref.current.style.transform = `scale(${1 + lvl * 0.9})`;
      if (ref.current) ref.current.style.opacity = String(0.15 + lvl * 0.6);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      void ctx.close();
    };
  }, [stream]);
  return <span ref={ref} className="pointer-events-none absolute -inset-2 rounded-full bg-primary opacity-0 transition-transform duration-75" />;
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { formatCode, rpcJoinMeeting, useMeetingRoom, type MeetingInfo, type Peer } from "@/lib/meeting-room";
import { useOrderedSubjects } from "@/lib/subjects";
import { localDateStr } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/meetings/$code")({
  head: () => ({
    meta: [
      { title: "会議中 | Study#" },
      { name: "description", content: "Study#の会議ルーム" },
      { property: "og:title", content: "会議中 | Study#" },
      { property: "og:description", content: "Study#の会議ルーム" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeetingPage,
});

function MeetingPage() {
  const { code } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<MeetingInfo | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const [m, prof] = await Promise.all([
          rpcJoinMeeting(code, ""),
          supabase.from("profiles").select("display_name, username").eq("id", user.id).maybeSingle(),
        ]);
        if (!alive) return;
        setName((prof.data as any)?.display_name || (prof.data as any)?.username || "参加者");
        setMeeting(m);
      } catch (e: any) {
        toast.error(e.message ?? "参加できませんでした");
        navigate({ to: "/meetings", search: { join: code } });
      }
    })();
    return () => {
      alive = false;
    };
  }, [code, user, navigate]);

  if (summary && user) return <Summary s={summary} userId={user.id} />;
  if (!user || !meeting || !name) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return <Room meeting={meeting} userId={user.id} name={name} onEnded={setSummary} />;
}

type MeetingSummary = {
  title: string;
  reason: string;
  minutes: number;
  members: string[];
  chat: { name: string; text: string; at: number | string }[];
};

function Summary({ s, userId }: { s: MeetingSummary; userId: string }) {
  const navigate = useNavigate();
  const { subjects } = useOrderedSubjects();
  const [subjectId, setSubjectId] = useState("");
  const [minutes, setMinutes] = useState(s.minutes);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const chatText = s.chat
    .map((c) => `[${new Date(c.at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}] ${c.name}: ${c.text}`)
    .join("\n");
  const fullText = `会議: ${s.title}\n参加時間: ${s.minutes}分\n\n${chatText}`;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("study_logs").insert({
      user_id: userId,
      subject_id: subjectId || null,
      date: localDateStr(),
      duration_minutes: minutes,
      content: `オンライン会議（${s.title}）`,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    setSaved(true);
    toast.success("学習記録に追加しました");
  };

  const download = () => {
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `meeting-${localDateStr()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-background p-4">
      <div className="mx-auto max-w-lg space-y-4 py-8">
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-2 text-xl font-bold">
            {s.reason === "ended" ? "会議は終了しました" : s.reason === "kicked" ? "会議から退出しました" : "お疲れさまでした"}
          </h1>
        </div>

        <section className="space-y-1 rounded-xl border border-border p-4 text-sm">
          <div className="font-semibold">{s.title}</div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" /> 参加時間 {s.minutes}分
          </div>
          {s.members.length > 0 && (
            <div className="flex items-start gap-1.5 text-muted-foreground">
              <Users className="mt-0.5 h-4 w-4 shrink-0" /> {s.members.join("、")}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <div className="flex items-center gap-1.5 font-semibold">
            <BookOpen className="h-4 w-4 text-primary" /> この時間を学習記録に追加
          </div>
          <div className="flex gap-2">
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="h-10 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              disabled={saved}
            >
              <option value="">教科なし</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={1}
              className="w-24"
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
              disabled={saved}
            />
            <span className="self-center text-sm">分</span>
          </div>
          <Button className="w-full" onClick={save} disabled={saved || saving}>
            {saved ? "記録しました" : saving ? "保存中…" : "学習記録に登録"}
          </Button>
        </section>

        {s.chat.length > 0 && (
          <section className="space-y-2 rounded-xl border border-border p-4">
            <div className="flex items-center gap-1.5 font-semibold">
              <MessageSquare className="h-4 w-4" /> チャット {s.chat.length}件（保存されていません）
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  await navigator.clipboard.writeText(fullText);
                  toast.success("コピーしました");
                }}
              >
                <Copy className="mr-1.5 h-4 w-4" /> コピー
              </Button>
              <Button variant="outline" className="flex-1" onClick={download}>
                <Download className="mr-1.5 h-4 w-4" /> .txt保存
              </Button>
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => navigate({ to: "/meetings" })}>ロビーに戻る</Button>
          <Button variant="outline" onClick={() => navigate({ to: "/notes" })}>ノートを書く</Button>
          <Button variant="outline" onClick={() => navigate({ to: "/study" })}>学習記録を見る</Button>
          <Button variant="outline" onClick={() => navigate({ to: "/makron" })}>演習へ</Button>
        </div>
      </div>
    </div>
  );
}

function VideoEl({ stream, muted, mirror }: { stream: MediaStream | null; muted?: boolean; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`h-full w-full object-cover ${mirror ? "-scale-x-100" : ""}`}
    />
  );
}

function Room({
  meeting: initial,
  userId,
  name,
  onEnded,
}: {
  meeting: MeetingInfo;
  userId: string;
  name: string;
  onEnded: (s: MeetingSummary) => void;
}) {
  const withVideo = typeof window !== "undefined" && sessionStorage.getItem("meeting.video") !== "0";
  const startedAt = useRef(Date.now());
  const snap = useRef<{ title: string; chat: MeetingSummary["chat"]; names: Set<string> }>({
    title: initial.title,
    chat: [],
    names: new Set(),
  });
  const room = useMeetingRoom({
    meeting: initial,
    userId,
    name,
    withVideo,
    onLeave: (reason) => {
      if (reason === "kicked") toast.error("主催者により退出しました");
      onEnded({
        title: snap.current.title,
        reason,
        minutes: Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)),
        members: [...snap.current.names],
        chat: snap.current.chat,
      });
    },
  });
  const { meeting, isHost } = room;
  snap.current.title = meeting.title;
  snap.current.chat = room.chat.map((c) => ({ name: c.from === userId ? "自分" : c.name, text: c.text, at: c.at }));
  room.peers.forEach((p) => p.uid !== userId && snap.current.names.add(p.name));
  const [panel, setPanel] = useState<"people" | "chat" | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [chatText, setChatText] = useState("");
  const [unread, setUnread] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [view, setView] = useState<"gallery" | "speaker">("gallery");
  const [pinned, setPinned] = useState<string | null>(null);
  const [reactOpen, setReactOpen] = useState(false);
  const lastSpeaker = useRef<string | null>(null);
  const seenChat = useRef(0);
  const prevHost = useRef(meeting.host_id);
  const prevHands = useRef(new Set<string>());

  useEffect(() => {
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  useEffect(() => {
    if (prevHost.current !== meeting.host_id) {
      prevHost.current = meeting.host_id;
      const p = room.peers.find((x) => x.uid === meeting.host_id);
      toast(meeting.host_id === userId ? "あなたが主催者になりました" : `${p?.name ?? "参加者"} が主催者になりました`);
    }
  }, [meeting.host_id, room.peers, userId]);

  useEffect(() => {
    if (!isHost) return;
    const now = new Set(room.peers.filter((p) => p.hand).map((p) => p.uid));
    now.forEach((id) => {
      if (!prevHands.current.has(id) && id !== userId) {
        toast(`${room.peers.find((p) => p.uid === id)?.name ?? "参加者"} が挙手しました`);
      }
    });
    prevHands.current = now;
  }, [room.peers, isHost, userId]);

  useEffect(() => {
    if (panel === "chat") {
      seenChat.current = room.chat.length;
      setUnread(0);
    } else setUnread(room.chat.length - seenChat.current);
  }, [room.chat.length, panel]);

  const others = room.peers.filter((p) => p.uid !== userId);
  const me: Peer = room.peers.find((p) => p.uid === userId) ?? {
    uid: userId,
    name,
    joinedAt: 0,
    muted: room.muted,
    camOff: room.camOff,
    hand: room.hand,
    sharing: !!room.screen,
  };
  const sharer = room.peers.find((p) => p.sharing);
  const tiles = [me, ...others];
  const cols = tiles.length <= 1 ? 1 : tiles.length <= 4 ? 2 : 3;
  // ステージ: ピン留め優先 → スピーカービューなら直近の話者
  const pinnedPeer = pinned ? tiles.find((p) => p.uid === pinned) : undefined;
  const talkingNow = others.find((p) => room.speaking.has(p.uid) && !p.muted);
  if (talkingNow) lastSpeaker.current = talkingNow.uid;
  const stage =
    tiles.length > 1
      ? pinnedPeer ??
        (view === "speaker" ? tiles.find((p) => p.uid === lastSpeaker.current) ?? others[0] : undefined)
      : undefined;

  const mmss = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  const copyInvite = async () => {
    const url = `${window.location.origin}/meetings?join=${meeting.code}`;
    const text = `Study# 会議「${meeting.title}」\n会議コード: ${formatCode(meeting.code)}${meeting.has_password ? "\nパスコードは主催者に確認してください" : ""}\n${url}`;
    await navigator.clipboard.writeText(text);
    toast.success("招待情報をコピーしました");
  };

  const run = async (fn: () => Promise<unknown> | unknown) => {
    try {
      await fn();
    } catch (e: any) {
      if (e?.name === "NotAllowedError") return;
      toast.error(e?.message ?? "操作できませんでした");
    }
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  };

  // Push-to-Talk: ミュート中にSpace長押しで一時発言
  const setMutedState = room.setMutedState;
  const mutedRef = useRef(room.muted);
  mutedRef.current = room.muted;
  useEffect(() => {
    let ptt = false;
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || typing(e) || !mutedRef.current) return;
      e.preventDefault();
      ptt = true;
      setMutedState(false);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !ptt) return;
      ptt = false;
      setMutedState(true);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [setMutedState]);
  const hostName = room.peers.find((p) => p.uid === meeting.host_id)?.name ?? "不在";

  const renderTile = (p: Peer) => {
    const isMe = p.uid === userId;
    const stream = isMe ? room.localStream : room.remoteStreams[p.uid] ?? null;
    const showVideo = isMe ? !room.camOff : !p.camOff;
    const talking = room.speaking.has(p.uid) && !p.muted;
    const state = room.connState[p.uid];
    return (
      <div
        key={p.uid}
        className={`group relative aspect-video overflow-hidden rounded-xl bg-muted ring-2 transition ${
          talking ? "ring-primary shadow-[0_0_24px_-4px_var(--primary)]" : "ring-transparent"
        }`}
      >
        {!isMe && <AudioOnly stream={stream} />}
        {showVideo && stream ? (
          <VideoEl stream={stream} muted mirror={isMe} />
        ) : (
          <div className="grid h-full place-items-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/20 text-2xl font-bold text-primary">
              {p.name.slice(0, 1)}
            </div>
          </div>
        )}
        <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5">
          <span className="flex min-w-0 items-center gap-1 rounded-md bg-background/80 px-2 py-0.5 text-xs backdrop-blur">
            {p.uid === meeting.host_id && <Crown className="h-3 w-3 shrink-0 text-primary" />}
            <span className="truncate">{isMe ? `${p.name}（自分）` : p.name}</span>
            {p.muted ? (
              <MicOff className="h-3 w-3 shrink-0 text-destructive" />
            ) : (
              <span className="flex h-3 items-end gap-px">
                {[0, 1, 2].map((b) => (
                  <span
                    key={b}
                    className={`w-0.5 rounded-sm bg-primary transition-all ${talking ? "animate-pulse" : ""}`}
                    style={{ height: talking ? `${[60, 100, 75][b]}%` : "25%", animationDelay: `${b * 120}ms` }}
                  />
                ))}
              </span>
            )}
          </span>
          {!isMe && state && state !== "connected" && (
            <span className="rounded-md bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground">
              {state === "failed" ? "接続できません" : "接続中…"}
            </span>
          )}
        </div>
        {p.hand && (
          <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground">
            <Hand className="h-4 w-4" />
          </span>
        )}
        <button
          onClick={() => setPinned(pinned === p.uid ? null : p.uid)}
          title={pinned === p.uid ? "ピン留め解除" : "ピン留め"}
          className={`absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full backdrop-blur transition ${
            pinned === p.uid ? "bg-primary text-primary-foreground" : "bg-background/70 opacity-0 group-hover:opacity-100"
          }`}
        >
          {pinned === p.uid ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {room.reactions
            .filter((r) => r.from === p.uid)
            .map((r, i) => {
              const def = REACTIONS.find((x) => x.k === r.kind);
              if (!def) return null;
              return (
                <span
                  key={r.id}
                  className="meeting-float absolute bottom-8 grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"
                  style={{ left: `${20 + ((i * 23) % 60)}%` }}
                >
                  <def.Icon className="h-5 w-5" />
                </span>
              );
            })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{meeting.title}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <button onClick={copyInvite} className="flex items-center gap-1 font-mono hover:text-primary">
              {formatCode(meeting.code)} <Copy className="h-3 w-3" />
            </button>
            <span className="flex items-center gap-1">
              <Crown className="h-3 w-3" /> {meeting.host_id === userId ? "あなた" : hostName}
            </span>
            {meeting.is_locked && (
              <span className="flex items-center gap-1 text-primary">
                <Lock className="h-3 w-3" /> 入室締切
              </span>
            )}
            <span className="font-mono">{mmss}</span>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={copyInvite}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> 招待
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-auto p-3">
          <div className="mb-2 flex justify-end">
            <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
              {(["gallery", "speaker"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {v === "gallery" ? <LayoutGrid className="h-3.5 w-3.5" /> : <UserSquare className="h-3.5 w-3.5" />}
                  {v === "gallery" ? "ギャラリー" : "スピーカー"}
                </button>
              ))}
            </div>
          </div>
          {sharer && (
            <div className="mb-3 overflow-hidden rounded-xl bg-muted">
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground">
                <ScreenShare className="h-3.5 w-3.5" />
                {sharer.uid === userId ? "あなたの画面を共有中" : `${sharer.name} の画面`}
              </div>
              <div className="aspect-video max-h-[60vh] w-full bg-background">
                <ShareView stream={sharer.uid === userId ? room.screen : room.remoteScreens[sharer.uid] ?? null} />
              </div>
            </div>
          )}
          {stage ? (
            <>
              <div className="mx-auto mb-3 max-w-4xl">{renderTile(stage)}</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {tiles
                  .filter((p) => p.uid !== stage.uid)
                  .map((p) => (
                    <div key={p.uid} className="w-40 shrink-0">
                      {renderTile(p)}
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${sharer ? Math.min(tiles.length, 4) : cols}, minmax(0, 1fr))` }}
            >
              {tiles.map(renderTile)}
            </div>
          )}
          {others.length === 0 && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              ほかの参加者を待っています。上の「招待」から会議コードを共有できます。
            </p>
          )}
        </main>

        {panel && (
          <aside className="flex w-full max-w-sm flex-col border-l border-border bg-card max-sm:absolute max-sm:inset-0 max-sm:top-14 max-sm:z-10 max-sm:max-w-none">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="font-semibold">{panel === "people" ? `参加者（${room.peers.length}）` : "チャット"}</span>
              <Button size="icon" variant="ghost" onClick={() => setPanel(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {panel === "people" ? (
              <div className="flex-1 space-y-3 overflow-auto p-3">
                {isHost && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { room.muteAll(); toast.success("全員をミュートしました"); }}>
                      <MicOff className="mr-1.5 h-3.5 w-3.5" /> 全員ミュート
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
                      <Settings2 className="mr-1.5 h-3.5 w-3.5" /> 主催者設定
                    </Button>
                  </div>
                )}
                <ul className="space-y-1">
                  {room.peers.map((p) => (
                    <li key={p.uid} className="rounded-lg px-2 py-2 hover:bg-muted">
                      <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                          {p.name.slice(0, 1)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 truncate text-sm">
                            {p.name}
                            {p.uid === userId && <span className="text-muted-foreground">（自分）</span>}
                            {p.uid === meeting.host_id && <Crown className="h-3.5 w-3.5 text-primary" />}
                          </div>
                        </div>
                        {p.hand && <Hand className="h-4 w-4 text-primary" />}
                        {p.muted ? <MicOff className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      {isHost && p.uid !== userId && (
                        <div className="mt-1.5 flex flex-wrap gap-1 pl-10">
                          {!p.muted && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => room.muteOne(p.uid)}>
                              ミュート
                            </Button>
                          )}
                          {p.hand && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => room.lowerHand(p.uid)}>
                              手を下ろす
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              if (confirm(`${p.name} さんに主催者を移譲しますか？`))
                                void run(() => room.hostAction("transfer", p.uid));
                            }}
                          >
                            <Crown className="mr-1 h-3 w-3" /> 主催者にする
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive"
                            onClick={() => {
                              if (confirm(`${p.name} さんを退出させますか？（この会議には再入室できません）`))
                                void run(() => room.hostAction("kick", p.uid));
                            }}
                          >
                            <UserMinus className="mr-1 h-3 w-3" /> 退出させる
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-2 overflow-auto p-3">
                  {room.chat.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground">
                      チャットは保存されず、会議を出ると消えます。
                    </p>
                  )}
                  {room.chat.map((c) => (
                    <div key={c.id} className={c.from === userId ? "text-right" : ""}>
                      <div className="text-[11px] text-muted-foreground">
                        {c.from === userId ? "自分" : c.name} ・ {new Date(c.at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div
                        className={`inline-block max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-1.5 text-left text-sm ${
                          c.from === userId ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        {c.text}
                      </div>
                    </div>
                  ))}
                </div>
                <form
                  className="flex gap-2 border-t border-border p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    room.sendChat(chatText);
                    setChatText("");
                  }}
                >
                  <Input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="メッセージ" />
                  <Button size="icon" type="submit">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </>
            )}
          </aside>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-border px-3 py-3">
        <CtrlBtn active={!room.muted} danger={room.muted} label={room.muted ? "ミュート中" : "マイク"} onClick={room.toggleMute}>
          <span className="relative grid place-items-center">
            {room.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            {!room.muted && <MicLevel stream={room.localStream} />}
          </span>
        </CtrlBtn>
        <CtrlBtn active={!room.camOff} danger={room.camOff} label="カメラ" onClick={() => void run(room.toggleCam)}>
          {room.camOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </CtrlBtn>
        <CtrlBtn
          active={!!room.screen}
          label="画面共有"
          disabled={!isHost && !meeting.allow_screen_share}
          onClick={() => void run(room.toggleShare)}
        >
          {room.screen ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
        </CtrlBtn>
        <CtrlBtn
          active={isFullscreen}
          label={isFullscreen ? "全画面を終了" : "全画面表示"}
          onClick={() => void run(toggleFullscreen)}
        >
          {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </CtrlBtn>
        <CtrlBtn active={room.hand} label="挙手" onClick={room.toggleHand}>
          <Hand className="h-5 w-5" />
        </CtrlBtn>
        <div className="relative">
          <CtrlBtn active={reactOpen} label="リアクション" onClick={() => setReactOpen((v) => !v)}>
            <SmilePlus className="h-5 w-5" />
          </CtrlBtn>
          {reactOpen && (
            <div className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 gap-1 rounded-full border border-border bg-card p-1.5 shadow-lg">
              {REACTIONS.map((r) => (
                <button
                  key={r.k}
                  title={r.label}
                  onClick={() => {
                    room.sendReaction(r.k);
                    setReactOpen(false);
                  }}
                  className="grid h-10 w-10 place-items-center rounded-full text-primary hover:bg-primary/10"
                >
                  <r.Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          )}
        </div>
        <CtrlBtn active={panel === "chat"} label="チャット" badge={unread} onClick={() => setPanel(panel === "chat" ? null : "chat")}>
          <MessageSquare className="h-5 w-5" />
        </CtrlBtn>
        <CtrlBtn active={panel === "people"} label="参加者" badge={room.peers.length} neutralBadge onClick={() => setPanel(panel === "people" ? null : "people")}>
          <Users className="h-5 w-5" />
        </CtrlBtn>
        <Button variant="destructive" className="h-12 rounded-full px-5" onClick={() => (isHost && others.length > 0 ? setLeaveOpen(true) : isHost ? void run(() => room.hostAction("end")) : room.leave("left"))}>
          <PhoneOff className="mr-2 h-5 w-5" /> {isHost ? "終了" : "退出"}
        </Button>
      </footer>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>会議を出ますか？</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Button variant="destructive" className="w-full" onClick={() => void run(() => room.hostAction("end"))}>
              全員に対して会議を終了
            </Button>
            <p className="pt-2 text-sm text-muted-foreground">主催者を引き継いで自分だけ退出：</p>
            {others.map((p) => (
              <Button
                key={p.uid}
                variant="outline"
                className="w-full justify-start"
                onClick={() =>
                  void run(async () => {
                    await room.hostAction("transfer", p.uid);
                    room.leave("left");
                  })
                }
              >
                <Crown className="mr-2 h-4 w-4 text-primary" /> {p.name} に移譲して退出
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen && isHost} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>主催者設定</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <SettingRow
              icon={meeting.is_locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              label="入室を締め切る"
              desc="新しい参加者が入れなくなります（参加済みの人は再入室可）"
              checked={meeting.is_locked}
              onChange={(v) => void run(() => room.hostAction("lock", undefined, v))}
            />
            <SettingRow
              icon={<MicOff className="h-4 w-4" />}
              label="入室時にミュート"
              desc="これから入る参加者のマイクをオフで開始します"
              checked={meeting.mute_on_entry}
              onChange={(v) => void run(() => room.hostAction("mute_on_entry", undefined, v))}
            />
            <SettingRow
              icon={<ScreenShare className="h-4 w-4" />}
              label="参加者の画面共有を許可"
              desc="オフにすると主催者のみ共有できます"
              checked={meeting.allow_screen_share}
              onChange={(v) => void run(() => room.hostAction("screen_share", undefined, v))}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AudioOnly({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

function ShareView({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className="h-full w-full object-contain" />;
}

function SettingRow(props: { icon: ReactNode; label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-primary">{props.icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium">{props.label}</div>
        <div className="text-xs text-muted-foreground">{props.desc}</div>
      </div>
      <Switch checked={props.checked} onCheckedChange={props.onChange} />
    </div>
  );
}

function CtrlBtn(props: {
  children: ReactNode;
  label: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  badge?: number;
  neutralBadge?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.label}
      className="flex w-16 flex-col items-center gap-1 text-[11px] text-muted-foreground disabled:opacity-40"
    >
      <span
        className={`relative grid h-11 w-11 place-items-center rounded-full border transition ${
          props.danger
            ? "border-destructive/40 bg-destructive/15 text-destructive"
            : props.active
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border bg-card text-foreground hover:bg-muted"
        }`}
      >
        {props.children}
        {!!props.badge && props.badge > 0 && (
          <span
            className={`absolute -right-1 -top-1 min-w-5 rounded-full px-1 text-[10px] font-bold leading-5 ${
              props.neutralBadge ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
            }`}
          >
            {props.badge}
          </span>
        )}
      </span>
      {props.label}
    </button>
  );
}
