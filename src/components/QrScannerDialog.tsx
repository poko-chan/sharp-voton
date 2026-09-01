import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Upload, SwitchCamera } from "lucide-react";
import { toast } from "sonner";

/** QRコードをカメラまたは画像から読み取るダイアログ */
export function QrScannerDialog({
  open,
  onOpenChange,
  onResult,
  title = "QRコードを読み取る",
  description = "カメラをQRコードに向けてください。画像から読み取ることもできます。",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onResult: (text: string) => void;
  title?: string;
  description?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const finish = (text: string) => {
    stop();
    onOpenChange(false);
    onResult(text);
  };

  useEffect(() => {
    if (!open) { stop(); return; }
    let cancelled = false;

    (async () => {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();

        const jsQR = (await import("jsqr")).default;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

        const tick = () => {
          if (cancelled || !streamRef.current) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
            if (code?.data) { finish(code.data); return; }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e: any) {
        setError(e?.message ?? "カメラを利用できません");
      }
    })();

    return () => { cancelled = true; stop(); };
  }, [open, facing]);

  const scanFile = async (file: File) => {
    try {
      const jsQR = (await import("jsqr")).default;
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
      if (code?.data) finish(code.data);
      else toast.error("QRコードを認識できませんでした");
    } catch {
      toast.error("画像の読み取りに失敗しました");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) stop(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><QrCode className="h-4 w-4" />{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-xl bg-muted aspect-square">
          <video ref={videoRef} playsInline muted className="size-full object-cover" aria-label="QRコード読み取り用カメラ映像" />
          <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-primary/80" />
          {error && (
            <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-muted-foreground">
              カメラを利用できません（{error}）。下の「画像から読み取る」をお使いください。
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}>
            <SwitchCamera className="h-4 w-4" />カメラ切替
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />画像から読み取る
          </Button>
          <input
            ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) scanFile(f); e.target.value = ""; }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
