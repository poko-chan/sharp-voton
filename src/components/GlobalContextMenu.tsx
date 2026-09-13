import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clipboard,
  Copy,
  ExternalLink,
  RefreshCw,
  TextSelect,
} from "lucide-react";
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";

type MenuState = {
  x: number;
  y: number;
  href: string | null;
  selectedText: string;
  editable: boolean;
};

export function GlobalContextMenu({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      if (event.defaultPrevented) return;

      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("[data-native-context-menu]")) return;

      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      const selection = window.getSelection()?.toString().trim() ?? "";
      const editable = Boolean(target?.closest("input, textarea, [contenteditable='true']"));
      event.preventDefault();
      setCopied(null);
      setMenu({
        x: event.clientX,
        y: event.clientY,
        href: link?.href ?? null,
        selectedText: selection,
        editable,
      });
    };
    const close = () => setMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const run = (action: () => void) => {
    action();
    setMenu(null);
  };

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1200);
    }
  };

  const handleMenuContext = (event: ReactMouseEvent) => event.preventDefault();

  return (
    <>
      {children}
      {menu && (
        <div
          role="menu"
          aria-label="ページの操作"
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={handleMenuContext}
          className="fixed z-[200] w-64 overflow-hidden rounded-xl border border-border/70 bg-popover/95 p-1.5 text-sm shadow-2xl backdrop-blur-xl"
          style={{
            left: Math.min(menu.x, window.innerWidth - 272),
            top: Math.min(menu.y, window.innerHeight - 260),
          }}
        >
          <MenuButton icon={<ArrowLeft />} label="戻る" disabled={!history.length} onClick={() => run(() => history.back())} />
          <MenuButton
            icon={<ArrowRight />}
            label="進む"
            disabled={!history.forward}
            onClick={() => run(() => history.forward())}
          />
          <MenuButton icon={<RefreshCw />} label="ページを再読み込み" onClick={() => run(() => location.reload())} />
          <div className="my-1 border-t border-border/60" />
          {menu.href && (
            <MenuButton
              icon={<ExternalLink />}
              label="リンクを新しいタブで開く"
              onClick={() => run(() => window.open(menu.href!, "_blank", "noopener,noreferrer"))}
            />
          )}
          {menu.selectedText && (
            <MenuButton
              icon={copied === "selection" ? <Check /> : <Copy />}
              label={copied === "selection" ? "選択範囲をコピーしました" : "選択範囲をコピー"}
              onClick={() => void copy(menu.selectedText, "selection")}
            />
          )}
          <MenuButton
            icon={copied === "url" ? <Check /> : <Clipboard />}
            label={copied === "url" ? "ページURLをコピーしました" : "ページURLをコピー"}
            onClick={() => void copy(location.href, "url")}
          />
          {menu.editable && (
            <MenuButton
              icon={<TextSelect />}
              label="すべて選択"
              onClick={() => run(() => document.execCommand("selectAll"))}
            />
          )}
        </div>
      )}
    </>
  );
}

function MenuButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}