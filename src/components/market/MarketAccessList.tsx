import { LayoutGrid, Bell, Database, ShieldCheck } from "lucide-react";
import type { MarketAccess } from "@/lib/marketplace";

const ROWS = [
  { key: "display", label: "表示される場所", icon: LayoutGrid },
  { key: "notifications", label: "通知・端末の許可", icon: Bell },
  { key: "data", label: "アクセスするデータ", icon: Database },
] as const;

/** アプリがどこに表示され、何にアクセスするかの開示 */
export function MarketAccessList({ access }: { access: MarketAccess }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3 space-y-2.5">
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4 text-primary" />
        アクセスと表示
      </div>
      {ROWS.map((r) => (
        <div key={r.key} className="flex gap-2">
          <r.icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{r.label}</div>
            <ul className="text-sm">
              {access[r.key].map((x) => (
                <li key={x}>・{x}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">アンインストールしてもデータは残り、再インストールで元に戻ります。</p>
    </div>
  );
}
