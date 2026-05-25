// Lightweight pub/sub so the sidebar can refresh when the user's profile
// (display name / avatar) or study totals change without prop drilling.
type Listener = () => void;
const listeners = new Set<Listener>();

export function emitProfileChange() {
  listeners.forEach((l) => {
    try { l(); } catch { /* noop */ }
  });
}

export function onProfileChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
