import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff, Wifi } from "lucide-react";

/**
 * 通信状態バナー: オフライン検知と、復帰時のデータ自動再取得。
 * 低速回線（2g/3g・データセーバー）も検知して通知する。
 */
export function NetworkStatusBanner() {
  const qc = useQueryClient();
  const [offline, setOffline] = useState(false);
  const [slow, setSlow] = useState(false);
  const [recovered, setRecovered] = useState(false);

  useEffect(() => {
    const conn = (navigator as any).connection;
    const readSlow = () => {
      if (!conn) return;
      const t = conn.effectiveType as string | undefined;
      setSlow(Boolean(conn.saveData) || t === "slow-2g" || t === "2g");
    };
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      setRecovered(true);
      void qc.invalidateQueries();
      setTimeout(() => setRecovered(false), 2500);
    };
    setOffline(!navigator.onLine);
    readSlow();
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    conn?.addEventListener?.("change", readSlow);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      conn?.removeEventListener?.("change", readSlow);
    };
  }, [qc]);

  if (!offline && !recovered && !slow) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[130] flex justify-center px-3">
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium shadow-lg backdrop-blur ${
          offline
            ? "border-destructive/40 bg-destructive text-destructive-foreground"
            : "border-border bg-card text-foreground"
        }`}
      >
        {offline ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
        {offline
          ? "オフラインです。接続が戻ると自動で再読み込みします"
          : recovered
            ? "オンラインに復帰しました。最新の状態に更新しました"
            : "通信が遅くなっています。読み込みに時間がかかる場合があります"}
      </div>
    </div>
  );
}
