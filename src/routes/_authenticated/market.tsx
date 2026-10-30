import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Store, Search, Check, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MARKET_APPS, useInstalledApps, type MarketApp } from "@/lib/marketplace";
import { DeveloperLine } from "@/components/market/VerifiedBadge";
import { MarketAccessList } from "@/components/market/MarketAccessList";

export const Route = createFileRoute("/_authenticated/market")({
  head: () => ({
    meta: [
      { title: "アプリマーケット | Study#" },
      { name: "description", content: "Study# の追加アプリを自由にインストールして、自分だけの学習環境を。" },
      { property: "og:title", content: "アプリマーケット | Study#" },
      { property: "og:description", content: "必要な学習ツールだけをインストールできる Study# のアプリマーケット。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketPage,
});

const TABS = ["すべて", "学習・演習", "記録・管理", "交流", "インストール済み"] as const;

function MarketPage() {
  const { installed, install, uninstall } = useInstalledApps();
  const [tab, setTab] = useState<(typeof TABS)[number]>("すべて");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<MarketApp | null>(null);

  const list = useMemo(
    () =>
      MARKET_APPS.filter((a) =>
        tab === "すべて" ? true : tab === "インストール済み" ? installed.has(a.id) : a.category === tab,
      ).filter((a) => !q || (a.name + a.subtitle).toLowerCase().includes(q.toLowerCase())),
    [tab, q, installed],
  );

  const toggle = async (a: MarketApp) => {
    if (installed.has(a.id)) {
      await uninstall(a.id);
      toast.success(`${a.name} をアンインストールしました（データは保持されます）`);
    } else {
      await install(a.id);
      toast.success(`${a.name} をインストールしました。メニューに追加されました`);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5"><Store className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">アプリマーケット</h1>
          <p className="text-sm text-muted-foreground">必要なツールだけをインストールして、自分だけの学習環境に。</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>
            {t}{t === "インストール済み" ? ` (${installed.size})` : ""}
          </Button>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="アプリを検索…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => {
          const on = installed.has(a.id);
          return (
            <Card key={a.id} className="p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors">
              <button className="flex gap-3 text-left" onClick={() => setDetail(a)}>
                <div className="rounded-2xl bg-primary/15 p-3 h-fit"><a.icon className="h-7 w-7 text-primary" /></div>
                <div className="min-w-0">
                  <div className="font-semibold">{a.name}</div>
                  <DeveloperLine developer={a.developer} verified={a.verified} />
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.subtitle}</p>
                </div>
              </button>
              <div className="flex gap-2 mt-auto">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setDetail(a)}>詳細</Button>
                {on ? (
                  <Button size="sm" className="flex-1" asChild><Link to={a.route as "/todo"}>開く</Link></Button>
                ) : (
                  <Button size="sm" className="flex-1" onClick={() => toggle(a)}><Plus className="mr-1 h-4 w-4" />入手</Button>
                )}
              </div>
            </Card>
          );
        })}
        {list.length === 0 && <p className="text-sm text-muted-foreground">該当するアプリはありません。</p>}
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <div className="flex gap-3 items-center">
                  <div className="rounded-2xl bg-primary/15 p-3"><detail.icon className="h-8 w-8 text-primary" /></div>
                  <div>
                    <DialogTitle>{detail.name}</DialogTitle>
                    <DeveloperLine developer={detail.developer} verified={detail.verified} />
                  </div>
                </div>
              </DialogHeader>
              <p className="text-sm font-medium">{detail.subtitle}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{detail.description}</p>
              <div>
                <h3 className="text-sm font-semibold mb-1.5">主な機能</h3>
                <ul className="space-y-1">
                  {detail.highlights.map((h) => (
                    <li key={h} className="flex gap-2 text-sm"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />{h}</li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detail.integrations.map((i) => (
                  <span key={i} className="text-xs rounded-full bg-muted px-2 py-0.5">{i}と連携</span>
                ))}
              </div>
              <div className="grid grid-cols-3 text-xs text-muted-foreground border-t pt-3">
                <div>カテゴリ<div className="text-foreground">{detail.category}</div></div>
                <div>バージョン<div className="text-foreground">{detail.version}</div></div>
                <div>最終更新<div className="text-foreground">{detail.updatedAt}</div></div>
              </div>
              {detail.preparing && (
                <p className="text-xs rounded-lg bg-primary/10 text-primary px-3 py-2">準備中のアプリです。インストールはできますが、公開まで使えません。</p>
              )}
              <MarketAccessList access={detail.access} />
              <Button variant={installed.has(detail.id) ? "outline" : "default"} onClick={() => toggle(detail)}>
                {installed.has(detail.id) ? "アンインストール" : "インストール"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
