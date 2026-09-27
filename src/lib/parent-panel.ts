/** どこからでも「おうちの人」パネルを開くための小さなイベント */
export type ParentPanelTab = "message" | "extend";

const EVENT = "study-hash.parent-panel";

export function openParentPanel(tab: ParentPanelTab = "message") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: tab }));
}

export function onParentPanelOpen(cb: (tab: ParentPanelTab) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb(((e as CustomEvent).detail as ParentPanelTab) ?? "message");
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
