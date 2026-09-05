import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ReactNode } from "react";

/** Markon と同じく全画面で使うノートのシェル */
export function NoteShell({
  title,
  subtitle,
  back,
  right,
  children,
}: {
  title?: ReactNode;
  subtitle?: string;
  back?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-gradient-to-r from-primary/10 via-background to-background px-3">
        {back ? (
          <Button size="icon" variant="ghost" onClick={() => navigate({ to: back as any })} title="戻る">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : (
          <Link to="/dashboard" title="メニューへ戻る">
            <Button size="icon" variant="ghost"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
        )}
        <Link to="/notebooks" className="shrink-0 text-lg font-extrabold tracking-tight">
          <span className="text-primary">Voton</span> Cnote
        </Link>
        <div className="min-w-0 flex-1 px-2">
          {title && <div className="truncate text-sm font-medium">{title}</div>}
          {subtitle && <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
        {right}
      </header>
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
