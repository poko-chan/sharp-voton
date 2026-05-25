// Sidebar customization stored in localStorage.
// Each NAV item has a stable `to` key; users can toggle visibility.
// Hidden items appear under the "Other" overflow menu.

const KEY = "study-plus.sidebar.hidden.v1";

export function getHiddenNav(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const v = localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as string[]) : [];
  } catch {
    return [];
  }
}

export function setHiddenNav(list: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("sidebar-hidden-changed"));
}

export function onHiddenNavChange(cb: () => void) {
  const fn = () => cb();
  window.addEventListener("sidebar-hidden-changed", fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener("sidebar-hidden-changed", fn);
    window.removeEventListener("storage", fn);
  };
}
