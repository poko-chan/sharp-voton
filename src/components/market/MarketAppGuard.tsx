import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Store, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { findMarketAppByPath, useInstalledApps } from "@/lib/marketplace";
import { MarketAccessList } from "@/components/market/MarketAccessList";

/** マーケット対象アプリが未インストールなら案内を表示。準備中アプリは準備中表示。 */
export function MarketAppGuard({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const app = findMarketAppByPath(path);
  const { installed, loaded, install } = useInstalledApps();
  if (!app) return <>{children}</>;
  if (!loaded) {
    return <div className="p-8 text-center text-sm text-muted-foreground">読み込み中...</div>;
  }
  if (!installed.has(app.id)) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <app.icon className="h-10 w-10 mx-auto text-primary" />
            <h1 className="text-lg font-bold">{app.name}はインストールされていません</h1>
            <p className="text-sm text-muted-foreground">{app.subtitle}</p>
          </div>
          <MarketAccessList access={app.access} />
          <div className="flex gap-2 justify-center">
            <Button onClick={() => install(app.id)}>今すぐインストール</Button>
            <Button variant="outline" asChild>
              <Link to="/market"><Store className="mr-1 h-4 w-4" />マーケット</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }
  if (app.preparing) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card className="p-6 text-center space-y-3">
          <Sparkles className="h-10 w-10 mx-auto text-primary" />
          <h1 className="text-lg font-bold">{app.name}は準備中です</h1>
          <p className="text-sm text-muted-foreground">公開までしばらくお待ちください。公開されると、このままお使いいただけます。</p>
          <Button variant="outline" asChild><Link to="/dashboard">ダッシュボードへ</Link></Button>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}
