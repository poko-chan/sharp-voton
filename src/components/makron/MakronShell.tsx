import { Link, useNavigate } from "@tanstack/react-router";
import { Shield, ArrowLeft, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { type ReactNode } from "react";

export function MakronShell({
  title,
  subtitle,
  back,
  right,
  children,
}: {
  title?: string;
  subtitle?: string;
  back?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="h-14 shrink-0 border-b border-border/60 bg-gradient-to-r from-primary/10 via-background to-background flex items-center gap-3 px-4">
        {back ? (
          <Button size="icon" variant="ghost" onClick={() => navigate({ to: back as any })} title="戻る">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : (
          <Link to="/dashboard" title="メニューへ戻る">
            <Button size="icon" variant="ghost"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
        )}
        <Link to="/makron" className="font-extrabold text-lg tracking-tight">
          <span className="text-primary">Mak</span>ron
        </Link>
        <div className="min-w-0 flex-1 px-3">
          {title && <div className="text-sm font-medium truncate">{title}</div>}
          {subtitle && <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>}
        </div>
        {right}
        <Link
          to={isAdmin ? "/makron/admin" : "/makron"}
          className={`ml-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
            isAdmin
              ? "border-warning/40 bg-warning/10 hover:bg-warning/20 text-foreground"
              : "border-border/60 bg-muted/40 text-muted-foreground cursor-not-allowed pointer-events-none opacity-60"
          }`}
          title={isAdmin ? "管理者画面" : "管理者専用"}
        >
          <Shield className="h-3.5 w-3.5" />管理者
        </Link>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export function MakronBadge({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5">
      <Icon className="h-4 w-4 text-primary" />
      <div className="text-[10px] text-muted-foreground leading-none">{label}</div>
      <div className="text-sm font-bold leading-none">{value}</div>
    </div>
  );
}