// AI 生成状況のグローバルストア（全 AI 機能で共通表示）
export type AiPhase = "idle" | "loading-model" | "generating" | "done" | "error";

export type AiRunStatus = {
  phase: AiPhase;
  engine: string;
  /** 0-100 (モデル取得の進捗)。不明なら null */
  progress: number | null;
  /** 生成済み文字数 */
  chars: number;
  message: string;
  startedAt: number | null;
};

let state: AiRunStatus = {
  phase: "idle", engine: "", progress: null, chars: 0, message: "", startedAt: null,
};

const listeners = new Set<(s: AiRunStatus) => void>();

export function getAiRunStatus() { return state; }

export function subscribeAiRunStatus(fn: (s: AiRunStatus) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function setAiRunStatus(patch: Partial<AiRunStatus>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => { try { l(state); } catch { /* noop */ } });
}

export function aiRunStart(engine: string, message = "生成を開始しています…") {
  setAiRunStatus({ phase: "generating", engine, progress: null, chars: 0, message, startedAt: Date.now() });
}
export function aiRunModelLoading(engine: string, progress: number | null, message: string) {
  setAiRunStatus({ phase: "loading-model", engine, progress, message });
}
export function aiRunChars(chars: number) {
  setAiRunStatus({ phase: "generating", chars, message: "生成中…" });
}
export function aiRunDone(chars: number) {
  setAiRunStatus({ phase: "done", chars, message: "生成が完了しました", progress: null });
}
export function aiRunError(message: string) {
  setAiRunStatus({ phase: "error", message, progress: null });
}