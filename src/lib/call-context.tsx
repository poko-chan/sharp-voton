import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { sendDm } from "@/lib/chat.functions";
import { toast } from "sonner";

export type CallKind = "audio" | "video";
export type CallStatus = "idle" | "incoming" | "outgoing" | "active";

type Signal =
  | { t: "invite"; callId: string; from: string; fromName: string; kind: CallKind }
  | { t: "accept"; callId: string }
  | { t: "decline"; callId: string }
  | { t: "offer"; callId: string; sdp: any }
  | { t: "answer"; callId: string; sdp: any }
  | { t: "ice"; callId: string; candidate: any }
  | { t: "bye"; callId: string };

const ICE: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:global.stun.twilio.com:3478",
      ],
    },
  ],
  iceCandidatePoolSize: 4,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};


const pairName = (a: string, b: string) => `call-pair-${[a, b].sort().join("_")}`;

type Ctx = {
  status: CallStatus;
  kind: CallKind;
  peerId: string | null;
  peerName: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  camOff: boolean;
  sharing: boolean;
  speakerOff: boolean;
  quality: "good" | "fair" | "poor" | null;
  startedAt: number | null;
  startCall: (peerId: string, peerName: string, kind: CallKind) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleCam: () => void;
  toggleShare: () => Promise<void>;
  toggleSpeaker: () => void;
  upgradeToVideo: () => Promise<void>;
};

const CallCtx = createContext<Ctx | null>(null);
export const useCall = () => {
  const c = useContext(CallCtx);
  if (!c) throw new Error("useCall must be used within CallProvider");
  return c;
};

export async function isMutualFollow(me: string, other: string) {
  const [a, b] = await Promise.all([
    supabase
      .from("follows")
      .select("id")
      .eq("follower_id", me)
      .eq("following_id", other)
      .eq("status", "accepted")
      .maybeSingle(),
    supabase
      .from("follows")
      .select("id")
      .eq("follower_id", other)
      .eq("following_id", me)
      .eq("status", "accepted")
      .maybeSingle(),
  ]);
  return !!a.data && !!b.data;
}

function durationLabel(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}分${s % 60}秒` : `${s}秒`;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<CallStatus>("idle");
  const [kind, setKind] = useState<CallKind>("audio");
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [quality, setQuality] = useState<"good" | "fair" | "poor" | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pairChRef = useRef<any>(null);
  const callIdRef = useRef<string | null>(null);
  const callerRef = useRef(false);
  const camTrackRef = useRef<MediaStreamTrack | null>(null);
  const pendingIce = useRef<any[]>([]);
  const connectedRef = useRef(false);

  const sendTo = useCallback(async (targetUserId: string, payload: Signal) => {
    const ch = supabase.channel(`call-user-${targetUserId}`);
    await new Promise<void>((resolve) => {
      ch.subscribe((s: string) => {
        if (s === "SUBSCRIBED") resolve();
      });
      setTimeout(resolve, 2500);
    });
    await ch.send({ type: "broadcast", event: "signal", payload });
    setTimeout(() => supabase.removeChannel(ch), 500);
  }, []);

  const sendPair = useCallback((payload: Signal) => {
    pairChRef.current?.send({ type: "broadcast", event: "signal", payload });
  }, []);

  const cleanup = useCallback(
    (opts?: { record?: "done" | "missed" | "declined" }) => {
      const dur = startedAt ? Date.now() - startedAt : 0;
      const partner = peerId;
      const wasCaller = callerRef.current;
      const k = kind;
      pcRef.current?.close();
      pcRef.current = null;
      localStream?.getTracks().forEach((t) => t.stop());
      camTrackRef.current?.stop();
      camTrackRef.current = null;
      if (pairChRef.current) {
        supabase.removeChannel(pairChRef.current);
        pairChRef.current = null;
      }
      pendingIce.current = [];
      connectedRef.current = false;
      callIdRef.current = null;
      callerRef.current = false;
      setLocalStream(null);
      setRemoteStream(null);
      setStatus("idle");
      setPeerId(null);
      setPeerName("");
      setMuted(false);
      setCamOff(false);
      setSharing(false);
      setSpeakerOff(false);
      setQuality(null);
      setStartedAt(null);
      // チャットに記録（発信者側のみ）
      if (wasCaller && partner && opts?.record) {
        const label = k === "video" ? "ビデオ通話" : "音声通話";
        const text =
          opts.record === "done"
            ? `📞 ${label}（${durationLabel(dur)}）`
            : opts.record === "declined"
              ? `📵 ${label}は応答がありませんでした`
              : `📵 不在着信（${label}）`;
        sendDm(partner, text).catch(() => {});
      }
    },
    [startedAt, peerId, kind, localStream],
  );

  const getMedia = useCallback(async (k: CallKind) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
      },
      video:
        k === "video"
          ? {
              width: { ideal: 1280, max: 1280 },
              height: { ideal: 720, max: 720 },
              frameRate: { ideal: 30, max: 30 },
              facingMode: "user",
            }
          : false,
    });
    setLocalStream(stream);
    return stream;
  }, []);


  const buildPc = useCallback(
    (stream: MediaStream, otherId: string) => {
      const pc = new RTCPeerConnection(ICE);
      stream.getTracks().forEach((t) => {
        const sender = pc.addTrack(t, stream);
        try {
          const p = sender.getParameters();
          p.encodings = [
            t.kind === "video"
              ? { maxBitrate: 1_500_000, maxFramerate: 30, networkPriority: "high", priority: "high" }
              : { maxBitrate: 64_000, networkPriority: "high", priority: "high" },
          ];
          if (t.kind === "video") p.degradationPreference = "balanced";
          void sender.setParameters(p).catch(() => {});
        } catch {
          /* 一部ブラウザは未対応 */
        }
      });

      const remote = new MediaStream();
      setRemoteStream(remote);
      pc.ontrack = (ev) => {
        ev.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
        setRemoteStream(new MediaStream(remote.getTracks()));
      };
      pc.onicecandidate = (ev) => {
        if (ev.candidate && callIdRef.current)
          sendPair({ t: "ice", callId: callIdRef.current, candidate: ev.candidate.toJSON() });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          connectedRef.current = true;
          setStatus("active");
          setStartedAt((s) => s ?? Date.now());
        }
        if (pc.connectionState === "disconnected" && callerRef.current) {
          try {
            pc.restartIce();
          } catch {
            /* noop */
          }
        }
        if (pc.connectionState === "failed") {
          toast.error("通話に接続できませんでした");
          cleanup({ record: "done" });
        }

      };
      pcRef.current = pc;
      void otherId;
      return pc;
    },
    [sendPair, cleanup],
  );

  const joinPair = useCallback(
    (otherId: string, onSignal: (s: Signal) => void) => {
      if (!user) return null;
      const ch = supabase
        .channel(pairName(user.id, otherId))
        .on("broadcast", { event: "signal" }, ({ payload }) => onSignal(payload as Signal))
        .subscribe();
      pairChRef.current = ch;
      return ch;
    },
    [user],
  );

  const handlePairSignal = useCallback(
    async (s: Signal) => {
      const pc = pcRef.current;
      if (s.callId !== callIdRef.current) return;
      if (s.t === "accept" && callerRef.current && pc) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendPair({ t: "offer", callId: s.callId, sdp: offer });
      } else if (s.t === "offer" && pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(s.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendPair({ t: "answer", callId: s.callId, sdp: answer });
        for (const c of pendingIce.current) await pc.addIceCandidate(c).catch(() => {});
        pendingIce.current = [];
      } else if (s.t === "answer" && pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(s.sdp));
        for (const c of pendingIce.current) await pc.addIceCandidate(c).catch(() => {});
        pendingIce.current = [];
      } else if (s.t === "ice" && pc) {
        if (pc.remoteDescription) await pc.addIceCandidate(s.candidate).catch(() => {});
        else pendingIce.current.push(s.candidate);
      } else if (s.t === "decline") {
        toast.info("相手が応答しませんでした");
        cleanup({ record: "declined" });
      } else if (s.t === "bye") {
        cleanup({ record: connectedRef.current ? "done" : "missed" });
      }
    },
    [sendPair, cleanup],
  );

  const handlePairRef = useRef(handlePairSignal);
  handlePairRef.current = handlePairSignal;

  // 自分宛の着信を常時受信
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`call-user-${user.id}`)
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        const s = payload as Signal;
        if (s.t !== "invite") return;
        if (pcRef.current || callIdRef.current) {
          void sendTo(s.from, { t: "decline", callId: s.callId });
          return;
        }
        callIdRef.current = s.callId;
        callerRef.current = false;
        setKind(s.kind);
        setPeerId(s.from);
        setPeerName(s.fromName);
        setStatus("incoming");
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, sendTo]);

  const startCall = useCallback(
    async (target: string, name: string, k: CallKind) => {
      if (!user) return;
      if (status !== "idle") return;
      const ok = await isMutualFollow(user.id, target);
      if (!ok) {
        toast.error("相互フォローのフレンドとだけ通話できます");
        return;
      }
      let stream: MediaStream;
      try {
        stream = await getMedia(k);
      } catch {
        toast.error("マイク／カメラを利用できません");
        return;
      }
      const callId = crypto.randomUUID();
      callIdRef.current = callId;
      callerRef.current = true;
      setKind(k);
      setPeerId(target);
      setPeerName(name);
      setStatus("outgoing");
      joinPair(target, (s) => handlePairRef.current(s));
      buildPc(stream, target);
      const me = (user.user_metadata as any)?.display_name || "フレンド";
      await sendTo(target, { t: "invite", callId, from: user.id, fromName: me, kind: k });
    },
    [user, status, getMedia, joinPair, buildPc, sendTo],
  );

  const accept = useCallback(async () => {
    if (!peerId || !callIdRef.current) return;
    let stream: MediaStream;
    try {
      stream = await getMedia(kind);
    } catch {
      toast.error("マイク／カメラを利用できません");
      decline();
      return;
    }
    joinPair(peerId, (s) => handlePairRef.current(s));
    buildPc(stream, peerId);
    setStatus("active");
    setStartedAt(Date.now());
    setTimeout(() => sendPair({ t: "accept", callId: callIdRef.current! }), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerId, kind, getMedia, joinPair, buildPc, sendPair]);

  const decline = useCallback(() => {
    if (peerId && callIdRef.current) void sendTo(peerId, { t: "decline", callId: callIdRef.current });
    cleanup();
  }, [peerId, sendTo, cleanup]);

  const hangup = useCallback(() => {
    if (callIdRef.current) {
      if (pairChRef.current) sendPair({ t: "bye", callId: callIdRef.current });
      else if (peerId) void sendTo(peerId, { t: "bye", callId: callIdRef.current });
    }
    cleanup({ record: connectedRef.current ? "done" : "missed" });
  }, [sendPair, sendTo, peerId, cleanup]);

  const toggleMute = useCallback(() => {
    const t = localStream?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setMuted(!t.enabled);
  }, [localStream]);

  const toggleCam = useCallback(() => {
    const t = localStream?.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setCamOff(!t.enabled);
  }, [localStream]);

  const toggleShare = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !localStream) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (sharing) {
      const cam = camTrackRef.current;
      if (sender && cam) await sender.replaceTrack(cam);
      localStream.getVideoTracks().forEach((t) => t.stop());
      setSharing(false);
      return;
    }
    try {
      const disp = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = disp.getVideoTracks()[0];
      if (!track) return;
      const current = localStream.getVideoTracks()[0] ?? null;
      if (current) camTrackRef.current = current;
      if (sender) await sender.replaceTrack(track);
      else pc.addTrack(track, localStream);
      track.onended = () => {
        void toggleShare();
      };
      setSharing(true);
    } catch {
      /* ユーザーがキャンセル */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing, localStream]);

  return (
    <CallCtx.Provider
      value={{
        status,
        kind,
        peerId,
        peerName,
        localStream,
        remoteStream,
        muted,
        camOff,
        sharing,
        startedAt,
        startCall,
        accept,
        decline,
        hangup,
        toggleMute,
        toggleCam,
        toggleShare,
      }}
    >
      {children}
    </CallCtx.Provider>
  );
}
