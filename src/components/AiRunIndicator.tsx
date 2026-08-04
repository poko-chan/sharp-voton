import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { getAiRunStatus, subscribeAiRunStatus, type AiRunStatus, aiRunIdle } from "@/lib/ai-status";
import { AI_ENGINE_LABELS, type AiEngine } from "@/lib/ai-provider";
import { Button } from "@/components/ui/button";

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
    if (s.phase === "idle") {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (s.phase === "done") {
      const t = setTimeout(() => {
        setVisible(false);
        // phase は done のままにしておいて次回の生成でリセットされるのに任せるか、
        // あるいは idle に戻す。ここでは視覚的に消すだけにする。
      }, 2500);
      return () => clearTimeout(t);
    }
    if (s.phase === "error") {
      const t = setTimeout(() => {
        setVisible(false);
      }, 8000); // エラーは少し長めに表示
      return () => clearTimeout(t);
    }
  }, [s.phase, s.chars, s.message]);

  if (!visible) return null;

  const engineLabel = AI_ENGINE_LABELS[(s.engine as AiEngine) ?? "none"] ?? s.engine;
  const busy = s.phase === "generating" || s.phase === "loading-model";

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] shadow-sm animate-in fade-in slide-in-from-bottom-1 ${
        s.phase === "error"
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : s.phase === "done"
            ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-600"
            : "border-primary/40 bg-primary/5 text-primary"
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
      {s.phase === "error" && (
        <button
          onClick={() => { setVisible(false); aiRunIdle(); }}
          className="ml-1 p-0.5 hover:bg-destructive/10 rounded-full transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
