import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { getAiRunStatus, subscribeAiRunStatus, type AiRunStatus } from "@/lib/ai-status";
import { AI_ENGINE_LABELS, type AiEngine } from "@/lib/ai-provider";

/** すべての AI 機能で共通の「生成状況」表示 */
export function useAiRunStatus(): AiRunStatus {
  const [s, setS] = useState<AiRunStatus>(getAiRunStatus);
  useEffect(() => subscribeAiRunStatus(setS), []);
  return s;
}

export function AiRunIndicator({ className = "" }: { className?: string }) {
  const s = useAiRunStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (s.phase === "idle") { setVisible(false); return; }
    setVisible(true);
    if (s.phase === "done") {
      const t = setTimeout(() => setVisible(false), 2500);
      return () => clearTimeout(t);
    }
  }, [s.phase, s.chars]);

  if (!visible) return null;

  const engineLabel = AI_ENGINE_LABELS[(s.engine as AiEngine) ?? "none"] ?? s.engine;
  const busy = s.phase === "generating" || s.phase === "loading-model";

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${
        s.phase === "error"
          ? "border-destructive/40 text-destructive"
          : s.phase === "done"
            ? "border-emerald-500/40 text-emerald-600"
            : "border-primary/40 text-primary"
      } ${className}`}
      aria-live="polite"
    >
      {busy && <Loader2 className="h-3 w-3 animate-spin" />}
      {s.phase === "done" && <CheckCircle2 className="h-3 w-3" />}
      {s.phase === "error" && <AlertTriangle className="h-3 w-3" />}
      <span className="truncate max-w-[220px]">
        {s.phase === "loading-model"
          ? `${engineLabel} 準備中${s.progress !== null ? ` ${s.progress}%` : ""}`
          : s.phase === "generating"
            ? `${engineLabel} 生成中 ${s.chars}文字`
            : s.phase === "done"
              ? `完了 ${s.chars}文字`
              : s.message}
      </span>
    </div>
  );
}