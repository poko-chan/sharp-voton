import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorX,
} from "lucide-react";
import { useCall } from "@/lib/call-context";

function useElapsed(startedAt: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return "";
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function CallOverlay() {
  const call = useCall();
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const elapsed = useElapsed(call.startedAt);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = call.localStream;
  }, [call.localStream]);
  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = call.remoteStream;
  }, [call.remoteStream]);

  if (call.status === "idle") return null;

  const isVideo = call.kind === "video";

  if (call.status === "incoming") {
    return (
      <div className="fixed inset-0 z-[120] grid place-items-center bg-background/80 backdrop-blur-md p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-xl space-y-4">
          <p className="text-xs font-semibold text-muted-foreground">
            {isVideo ? "ビデオ通話の着信" : "音声通話の着信"}
          </p>
          <h2 className="text-2xl font-bold">{call.peerName}</h2>
          <div className="flex justify-center gap-3 pt-2">
            <Button size="lg" variant="destructive" onClick={call.decline}>
              <PhoneOff className="mr-2 h-5 w-5" />
              拒否
            </Button>
            <Button size="lg" onClick={() => void call.accept()}>
              <Phone className="mr-2 h-5 w-5" />
              応答
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950 text-white">
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm opacity-70">{isVideo ? "ビデオ通話" : "音声通話"}</p>
          <h2 className="text-lg font-bold">{call.peerName}</h2>
        </div>
        <span className="tabular-nums text-sm opacity-80">
          {call.status === "outgoing" ? "呼び出し中…" : elapsed}
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className={`h-full w-full object-contain ${isVideo || call.sharing ? "" : "hidden"}`}
        />
        {!isVideo && !call.sharing && (
          <div className="grid h-full place-items-center">
            <div className="grid h-28 w-28 place-items-center rounded-full bg-white/10 text-4xl font-bold">
              {call.peerName.slice(0, 1)}
            </div>
          </div>
        )}
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className={`absolute bottom-4 right-4 w-32 rounded-lg border border-white/20 sm:w-44 ${
            isVideo || call.sharing ? "" : "hidden"
          }`}
        />
      </div>

      <div className="flex items-center justify-center gap-3 p-5">
        <Button
          size="icon"
          variant={call.muted ? "secondary" : "outline"}
          className="h-12 w-12 rounded-full"
          onClick={call.toggleMute}
          title="マイク"
        >
          {call.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        {isVideo && (
          <Button
            size="icon"
            variant={call.camOff ? "secondary" : "outline"}
            className="h-12 w-12 rounded-full"
            onClick={call.toggleCam}
            title="カメラ"
          >
            {call.camOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>
        )}
        <Button
          size="icon"
          variant={call.sharing ? "secondary" : "outline"}
          className="h-12 w-12 rounded-full"
          onClick={() => void call.toggleShare()}
          title="画面共有"
        >
          {call.sharing ? <MonitorX className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
        </Button>
        <Button
          size="icon"
          variant="destructive"
          className="h-12 w-12 rounded-full"
          onClick={call.hangup}
          title="終了"
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

export function CallButtons({
  peerId,
  peerName,
  size = "sm",
}: {
  peerId: string;
  peerName: string;
  size?: "sm" | "icon";
}) {
  const call = useCall();
  const disabled = call.status !== "idle";
  return (
    <>
      <Button
        size={size}
        variant="outline"
        disabled={disabled}
        onClick={() => void call.startCall(peerId, peerName, "audio")}
        title="音声通話"
      >
        <Phone className={size === "icon" ? "h-4 w-4" : "h-4 w-4 sm:mr-1"} />
        {size === "sm" && <span className="hidden sm:inline">通話</span>}
      </Button>
      <Button
        size={size}
        variant="outline"
        disabled={disabled}
        onClick={() => void call.startCall(peerId, peerName, "video")}
        title="ビデオ通話"
      >
        <Video className={size === "icon" ? "h-4 w-4" : "h-4 w-4 sm:mr-1"} />
        {size === "sm" && <span className="hidden sm:inline">ビデオ</span>}
      </Button>
    </>
  );
}
