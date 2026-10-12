import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

type Banner = {
  id: string;
  title: string;
  image_url: string;
  action_type: string;
  link_url: string | null;
  open_new_tab: boolean;
  modal_title: string | null;
  modal_body: string | null;
};

const isInternal = (u: string) => u.startsWith("/") && !u.startsWith("//");

export function DashboardBanners() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Banner[]>([]);
  const [i, setI] = useState(0);
  const [modal, setModal] = useState<Banner | null>(null);

  useEffect(() => {
    const now = new Date().toISOString();
    supabase
      .from("dashboard_banners")
      .select("id,title,image_url,action_type,link_url,open_new_tab,modal_title,modal_body")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .order("sort_order")
      .then(({ data }) => setItems((data ?? []) as Banner[]));
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 3000);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;
  const b = items[i % items.length];

  const openUrl = (u: string, newTab: boolean) => {
    if (isInternal(u) && !newTab) navigate({ to: u as any });
    else if (/^https?:\/\//.test(u) || isInternal(u))
      window.open(u, newTab ? "_blank" : "_self", "noopener");
  };
  const click = () => {
    if (b.action_type === "url" && b.link_url) openUrl(b.link_url, b.open_new_tab);
    else if (b.action_type === "modal") setModal(b);
  };

  return (
    <div className="relative group">
      <button
        onClick={click}
        className={`block w-full overflow-hidden rounded-2xl border ${b.action_type === "none" ? "cursor-default" : ""}`}
        aria-label={b.title || "お知らせバナー"}
      >
        <img
          key={b.id}
          src={b.image_url}
          alt={b.title}
          className="w-full aspect-[4/1] max-h-56 object-contain animate-in fade-in-0 slide-in-from-right-3 duration-700 ease-out"
        />
      </button>
      {items.length > 1 && (
        <>
          <button
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 shadow-md transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setI((i - 1 + items.length) % items.length)}
            aria-label="前のバナー"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 shadow-md transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setI((i + 1) % items.length)}
            aria-label="次のバナー"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-background/75 px-1.5 py-1">
            {items.map((x, k) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setI(k)}
                className="flex h-6 w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${k + 1}番目のバナーを表示`}
                aria-current={k === i ? "true" : undefined}
              >
                <span
                  className={`h-1.5 rounded-full bg-foreground transition-all duration-300 ${k === i ? "w-4" : "w-1.5 opacity-60"}`}
                />
              </button>
            ))}
          </div>
        </>
      )}
      <Dialog open={!!modal} onOpenChange={(v) => !v && setModal(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal?.modal_title || modal?.title}</DialogTitle>
          </DialogHeader>
          <img
            src={modal?.image_url}
            alt=""
            className="w-full aspect-[4/1] object-contain rounded-md"
          />
          <p className="text-sm whitespace-pre-wrap">{modal?.modal_body}</p>
          <DialogFooter>
            {modal?.link_url && (
              <Button onClick={() => openUrl(modal.link_url!, true)}>
                開く <ExternalLink className="h-4 w-4 ml-1" />
              </Button>
            )}
            <Button variant="ghost" onClick={() => setModal(null)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
