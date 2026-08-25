import { Wrench } from "lucide-react";
import logoUrl from "@/assets/logo.png";

export function MaintenanceScreen({
  message,
  until,
}: {
  message: string | null;
  until: string | null;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background p-8">
      <div className="max-w-2xl text-center space-y-6">
        <img src={logoUrl} alt="Study#" className="mx-auto h-24 w-24 rounded-2xl shadow-md" />
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-warning/20 text-warning">
          <Wrench className="h-6 w-6" />
        </div>
        <h1 className="text-5xl font-bold tracking-tight">メンテナンス中</h1>
        <p className="text-xl text-muted-foreground whitespace-pre-wrap">
          {message || "現在システムメンテナンスを実施しています。"}
        </p>
        {until && (
          <div className="rounded-xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">終了予定時刻</p>
            <p className="mt-1 text-2xl font-semibold">
              {new Date(until).toLocaleString("ja-JP")}
            </p>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          ご不便をおかけして申し訳ございません。
        </p>
      </div>
    </div>
  );
}
