// 会議（Meetings）: シグナリングはリアルタイム配信のみ、映像・音声は P2P メッシュで直接接続。
// DB は「作成・参加確認・主催者操作」だけで使う。
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MeetingInfo = {
  id: string;
  code: string;
  title: string;
  host_id: string;
  has_password: boolean;
  is_locked: boolean;
  mute_on_entry: boolean;
  allow_screen_share: boolean;
  status: string;
  created_at: string;
};

export type Peer = {
  uid: string;
  name: string;
  joinedAt: number;
  muted: boolean;
  camOff: boolean;
  hand: boolean;
  sharing: boolean;
};

export type ChatLine = { id: string; from: string; name: string; text: string; at: number };

export const formatCode = (c: string) => {
  const d = c.replace(/\D/g, "");
  return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4, 8)}` : d;
};

const ICE: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:global.stun.twilio.com:3478",
      ],
    },
  ],
  bundlePolicy: "max-bundle",
};

type Sig =
  | { k: "offer" | "answer"; sdp: RTCSessionDescriptionInit }
  | { k: "ice"; c: RTCIceCandidateInit };

type PeerConn = {
  pc: RTCPeerConnection;
  stream: MediaStream;
  pendingIce: RTCIceCandidateInit[];
  audioSender?: RTCRtpSender;
  videoSender?: RTCRtpSender;
};

export async function rpcCreateMeeting(title: string, password: string, muteOnEntry: boolean) {
  const { data, error } = await (supabase as any).rpc("create_meeting", {
    _title: title,
    _password: password || null,
    _mute_on_entry: muteOnEntry,
  });
  if (error) throw new Error(error.message);
  return data as MeetingInfo;
}

export async function rpcJoinMeeting(code: string, password: string) {
  const { data, error } = await (supabase as any).rpc("join_meeting", {
    _code: code,
    _password: password || null,
  });
  if (error) throw new Error(error.message);
  return data as MeetingInfo;
}

async function rpcHost(meetingId: string, action: string, target?: string | null, value?: boolean | null) {
  const { data, error } = await (supabase as any).rpc("meeting_host_action", {
    _meeting: meetingId,
    _action: action,
    _target: target ?? null,
    _value: value ?? null,
  });
  if (error) throw new Error(error.message);
  return data as MeetingInfo;
}

export function useMeetingRoom(opts: {
  meeting: MeetingInfo;
  userId: string;
  name: string;
  withVideo: boolean;
  onLeave: (reason: "left" | "kicked" | "ended") => void;
}) {
  const { userId, name, withVideo } = opts;
  const [meeting, setMeeting] = useState<MeetingInfo>(opts.meeting);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screen, setScreen] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(opts.meeting.mute_on_entry && opts.meeting.host_id !== userId);
  const [camOff, setCamOff] = useState(!withVideo);
  const [hand, setHand] = useState(false);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const [connState, setConnState] = useState<Record<string, RTCPeerConnectionState>>({});

  const chRef = useRef<any>(null);
  const conns = useRef(new Map<string, PeerConn>());
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const joinedAt = useRef(Date.now());
  const meRef = useRef({ muted, camOff, hand, sharing: false });
  const meetingRef = useRef(meeting);
  meetingRef.current = meeting;
  const onLeaveRef = useRef(opts.onLeave);
  onLeaveRef.current = opts.onLeave;
  const leftRef = useRef(false);

  const isHost = meeting.host_id === userId;

  const track = useCallback(() => {
    chRef.current?.track({ uid: userId, name, joinedAt: joinedAt.current, ...meRef.current });
  }, [userId, name]);

  const send = useCallback((event: string, payload: any) => {
    chRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const currentVideoTrack = () =>
    screenRef.current?.getVideoTracks()[0] ?? localRef.current?.getVideoTracks()[0] ?? null;

  const closePeer = useCallback((uid: string) => {
    const c = conns.current.get(uid);
    if (!c) return;
    try {
      c.pc.close();
    } catch {
      /* noop */
    }
    conns.current.delete(uid);
    setRemoteStreams((s) => {
      const n = { ...s };
      delete n[uid];
      return n;
    });
  }, []);

  const makePeer = useCallback(
    (uid: string, initiator: boolean) => {
      const existing = conns.current.get(uid);
      if (existing) return existing;
      const pc = new RTCPeerConnection(ICE);
      const stream = new MediaStream();
      const c: PeerConn = { pc, stream, pendingIce: [] };
      conns.current.set(uid, c);
      if (initiator) {
        const local = localRef.current;
        const a = local?.getAudioTracks()[0];
        const ta = pc.addTransceiver(a ?? "audio", { direction: "sendrecv" });
        const tv = pc.addTransceiver(currentVideoTrack() ?? "video", { direction: "sendrecv" });
        c.audioSender = ta.sender;
        c.videoSender = tv.sender;
      }
      pc.ontrack = (e) => {
        if (!stream.getTracks().includes(e.track)) stream.addTrack(e.track);
        setRemoteStreams((s) => ({ ...s, [uid]: stream }));
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) send("sig", { to: uid, from: userId, d: { k: "ice", c: e.candidate.toJSON() } });
      };
      pc.onconnectionstatechange = () => {
        setConnState((s) => ({ ...s, [uid]: pc.connectionState }));
        if (pc.connectionState === "failed" && initiator) {
          // 再接続を試みる
          pc.restartIce?.();
          void pc.createOffer({ iceRestart: true }).then(async (o) => {
            await pc.setLocalDescription(o);
            send("sig", { to: uid, from: userId, d: { k: "offer", sdp: o } });
          });
        }
      };
      if (initiator) {
        void (async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send("sig", { to: uid, from: userId, d: { k: "offer", sdp: offer } });
        })();
      }
      return c;
    },
    [send, userId],
  );

  const handleSig = useCallback(
    async (from: string, d: Sig) => {
      if (d.k === "offer") {
        const c = makePeer(from, false);
        const pc = c.pc;
        await pc.setRemoteDescription(d.sdp);
        if (!c.audioSender) {
          const ts = pc.getTransceivers();
          const ta = ts.find((t) => t.receiver.track.kind === "audio");
          const tv = ts.find((t) => t.receiver.track.kind === "video");
          if (ta) {
            ta.direction = "sendrecv";
            await ta.sender.replaceTrack(localRef.current?.getAudioTracks()[0] ?? null);
            c.audioSender = ta.sender;
          }
          if (tv) {
            tv.direction = "sendrecv";
            await tv.sender.replaceTrack(currentVideoTrack());
            c.videoSender = tv.sender;
          }
        }
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        send("sig", { to: from, from: userId, d: { k: "answer", sdp: ans } });
        for (const ice of c.pendingIce.splice(0)) await pc.addIceCandidate(ice).catch(() => {});
      } else if (d.k === "answer") {
        const c = conns.current.get(from);
        if (!c) return;
        await c.pc.setRemoteDescription(d.sdp);
        for (const ice of c.pendingIce.splice(0)) await c.pc.addIceCandidate(ice).catch(() => {});
      } else if (d.k === "ice") {
        const c = conns.current.get(from);
        if (!c) return;
        if (c.pc.remoteDescription) await c.pc.addIceCandidate(d.c).catch(() => {});
        else c.pendingIce.push(d.c);
      }
    },
    [makePeer, send, userId],
  );

  const leave = useCallback(
    (reason: "left" | "kicked" | "ended" = "left") => {
      if (leftRef.current) return;
      leftRef.current = true;
      conns.current.forEach((_, uid) => closePeer(uid));
      localRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current?.getTracks().forEach((t) => t.stop());
      if (chRef.current) {
        void chRef.current.untrack?.();
        supabase.removeChannel(chRef.current);
        chRef.current = null;
      }
      onLeaveRef.current(reason);
    },
    [closePeer],
  );

  // 接続開始
  useEffect(() => {
    let cancelled = false;
    let claimTimer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: withVideo ? { width: { ideal: 640 }, height: { ideal: 360 } } : false,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          setCamOff(true);
          meRef.current.camOff = true;
        } catch {
          stream = new MediaStream();
        }
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.getAudioTracks().forEach((t) => (t.enabled = !meRef.current.muted));
      localRef.current = stream;
      setLocalStream(stream);

      const ch = supabase.channel(`meeting-${meetingRef.current.id}`, {
        config: { presence: { key: userId }, broadcast: { self: false } },
      });
      chRef.current = ch;

      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState() as Record<string, any[]>;
        const list: Peer[] = [];
        for (const [uid, metas] of Object.entries(state)) {
          const m = metas[metas.length - 1];
          if (!m) continue;
          list.push({
            uid,
            name: m.name ?? "参加者",
            joinedAt: m.joinedAt ?? 0,
            muted: !!m.muted,
            camOff: !!m.camOff,
            hand: !!m.hand,
            sharing: !!m.sharing,
          });
        }
        list.sort((a, b) => a.joinedAt - b.joinedAt);
        setPeers(list);
        const ids = new Set(list.map((p) => p.uid));
        // 新しい相手へ接続（ID の小さい方が発信）
        for (const p of list) {
          if (p.uid === userId) continue;
          if (!conns.current.has(p.uid) && userId < p.uid) makePeer(p.uid, true);
        }
        // いなくなった相手を閉じる
        conns.current.forEach((_, uid) => {
          if (!ids.has(uid)) closePeer(uid);
        });
        // 主催者が不在なら、最古参が自動で引き継ぐ
        if (claimTimer) clearTimeout(claimTimer);
        const hostId = meetingRef.current.host_id;
        if (!ids.has(hostId) && list[0]?.uid === userId) {
          claimTimer = setTimeout(async () => {
            const st = ch.presenceState() as Record<string, any[]>;
            if (st[meetingRef.current.host_id]) return;
            try {
              const m = await rpcHost(meetingRef.current.id, "claim");
              setMeeting(m);
              send("meeting", { meeting: m });
            } catch {
              /* noop */
            }
          }, 6000);
        }
      });

      ch.on("broadcast", { event: "sig" }, ({ payload }: any) => {
        if (payload?.to !== userId) return;
        void handleSig(payload.from, payload.d);
      });
      ch.on("broadcast", { event: "meeting" }, ({ payload }: any) => {
        const m = payload?.meeting as MeetingInfo | undefined;
        if (!m) return;
        setMeeting(m);
        if (m.status === "ended") leave("ended");
      });
      ch.on("broadcast", { event: "cmd" }, ({ payload }: any) => {
        if (!payload || payload.from !== meetingRef.current.host_id) return;
        if (payload.to && payload.to !== userId) return;
        if (payload.c === "mute") {
          localRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
          meRef.current.muted = true;
          setMuted(true);
          track();
        } else if (payload.c === "lower-hand") {
          meRef.current.hand = false;
          setHand(false);
          track();
        } else if (payload.c === "kick") {
          leave("kicked");
        }
      });
      ch.on("broadcast", { event: "chat" }, ({ payload }: any) => {
        if (!payload?.text) return;
        setChat((c) => [...c.slice(-199), payload as ChatLine]);
      });

      ch.subscribe((s: string) => {
        if (s === "SUBSCRIBED") track();
      });
    })();
    const onUnload = () => leave("left");
    window.addEventListener("beforeunload", onUnload);
    return () => {
      cancelled = true;
      if (claimTimer) clearTimeout(claimTimer);
      window.removeEventListener("beforeunload", onUnload);
      leave("left");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 話している人の検出
  useEffect(() => {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ac: AudioContext = new Ctx();
    const analysers = new Map<string, AnalyserNode>();
    const add = (id: string, s: MediaStream | null) => {
      if (!s || !s.getAudioTracks().length) return;
      try {
        const src = ac.createMediaStreamSource(s);
        const an = ac.createAnalyser();
        an.fftSize = 256;
        src.connect(an);
        analysers.set(id, an);
      } catch {
        /* noop */
      }
    };
    add(userId, localStream);
    Object.entries(remoteStreams).forEach(([id, s]) => add(id, s));
    const buf = new Uint8Array(128);
    const iv = setInterval(() => {
      const next = new Set<string>();
      analysers.forEach((an, id) => {
        an.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        if (sum / buf.length > 18) next.add(id);
      });
      if (meRef.current.muted) next.delete(userId);
      setSpeaking((prev) =>
        prev.size === next.size && [...next].every((x) => prev.has(x)) ? prev : next,
      );
    }, 250);
    return () => {
      clearInterval(iv);
      void ac.close();
    };
  }, [localStream, remoteStreams, userId]);

  const replaceVideoAll = (t: MediaStreamTrack | null) => {
    conns.current.forEach((c) => void c.videoSender?.replaceTrack(t).catch(() => {}));
  };

  const toggleMute = useCallback(() => {
    const next = !meRef.current.muted;
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    meRef.current.muted = next;
    setMuted(next);
    track();
  }, [track]);

  const toggleCam = useCallback(async () => {
    const local = localRef.current;
    if (!local) return;
    let vt = local.getVideoTracks()[0];
    if (!vt) {
      try {
        const vs = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 360 } },
        });
        vt = vs.getVideoTracks()[0];
        local.addTrack(vt);
        setLocalStream(new MediaStream(local.getTracks()));
        if (!screenRef.current) replaceVideoAll(vt);
        meRef.current.camOff = false;
        setCamOff(false);
        track();
      } catch {
        throw new Error("カメラを利用できません");
      }
      return;
    }
    const next = !meRef.current.camOff;
    vt.enabled = !next;
    meRef.current.camOff = next;
    setCamOff(next);
    track();
  }, [track]);

  const stopShare = useCallback(() => {
    screenRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current = null;
    setScreen(null);
    replaceVideoAll(localRef.current?.getVideoTracks()[0] ?? null);
    meRef.current.sharing = false;
    track();
  }, [track]);

  const toggleShare = useCallback(async () => {
    if (screenRef.current) return stopShare();
    const m = meetingRef.current;
    if (!m.allow_screen_share && m.host_id !== userId) throw new Error("主催者が画面共有を制限しています");
    const disp = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const t = disp.getVideoTracks()[0];
    if (!t) return;
    screenRef.current = disp;
    setScreen(disp);
    replaceVideoAll(t);
    t.onended = () => stopShare();
    meRef.current.sharing = true;
    track();
  }, [stopShare, track, userId]);

  const toggleHand = useCallback(() => {
    meRef.current.hand = !meRef.current.hand;
    setHand(meRef.current.hand);
    track();
  }, [track]);

  const sendChat = useCallback(
    (text: string) => {
      const t = text.trim().slice(0, 1000);
      if (!t) return;
      const line: ChatLine = { id: crypto.randomUUID(), from: userId, name, text: t, at: Date.now() };
      setChat((c) => [...c.slice(-199), line]);
      send("chat", line);
    },
    [name, send, userId],
  );

  const hostAction = useCallback(
    async (action: "transfer" | "lock" | "mute_on_entry" | "screen_share" | "kick" | "end", target?: string, value?: boolean) => {
      const m = await rpcHost(meetingRef.current.id, action, target, value);
      setMeeting(m);
      send("meeting", { meeting: m });
      if (action === "kick" && target) send("cmd", { from: userId, to: target, c: "kick" });
      if (action === "end") leave("ended");
    },
    [leave, send, userId],
  );

  const muteAll = useCallback(() => send("cmd", { from: userId, c: "mute" }), [send, userId]);
  const muteOne = useCallback((to: string) => send("cmd", { from: userId, to, c: "mute" }), [send, userId]);
  const lowerHand = useCallback(
    (to: string) => send("cmd", { from: userId, to, c: "lower-hand" }),
    [send, userId],
  );

  return {
    meeting,
    isHost,
    peers,
    remoteStreams,
    localStream,
    screen,
    muted,
    camOff,
    hand,
    chat,
    speaking,
    connState,
    toggleMute,
    toggleCam,
    toggleShare,
    toggleHand,
    sendChat,
    hostAction,
    muteAll,
    muteOne,
    lowerHand,
    leave,
  };
}
