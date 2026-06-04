import { Ban, AlertOctagon } from "lucide-react";

export function RestrictionScreen({
  variant,
  message,
  until,
  title,
}: {
  variant: "stop" | "restrict";
  message: string | null;
  until?: string | null;
  title?: string;
}) {
  const isStop = variant === "stop";
  const bg = isStop ? "bg-red-600/85" : "bg-blue-600/85";
  const Icon = isStop ? Ban : AlertOctagon;
  const heading = title ?? (isStop ? "サービス利用停止中" : "アクセス制限中");
  return (
    <div className={`fixed inset-0 z-[180] ${bg} backdrop-blur-sm flex items-center justify-center p-8 text-white`}>
      <div className="max-w-xl text-center space-y-5">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/40">
          <Icon className="h-7 w-7" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight drop-shadow">{heading}</h1>
        <p className="text-lg whitespace-pre-wrap leading-relaxed opacity-95">
          {message || (isStop
            ? "現在、管理者により本サービスは一時的に停止されています。"
            : "あなたのアカウントには管理者により制限がかけられています。")}
        </p>
        {until && (
          <div className="rounded-xl bg-white/10 border border-white/30 px-5 py-3 inline-block">
            <div className="text-xs opacity-80">解除予定</div>
            <div className="text-xl font-semibold">{new Date(until).toLocaleString("ja-JP")}</div>
          </div>
        )}
        <p className="text-sm opacity-80">詳しくは管理者へお問い合わせください。</p>
      </div>
    </div>
  );
}