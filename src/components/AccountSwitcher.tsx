import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";

const KEY = "lovable.linkedAccounts.v1";
type Saved = { id: string; label: string; access_token: string; refresh_token: string };

function readAll(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function writeAll(list: Saved[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function AccountSwitcher() {
  const { session } = useAuth();
  const [list, setList] = useState<Saved[]>([]);

  // 現在のセッションを常に最新トークンで保存
  useEffect(() => {
    if (!session?.user) return;
    const u = session.user;
    const meta = (u.user_metadata ?? {}) as { username?: string; full_name?: string };
    const entry: Saved = {
      id: u.id,
      label: meta.full_name || meta.username || u.email || u.phone || "アカウント",
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    };
    const next = [entry, ...readAll().filter((a) => a.id !== u.id)].slice(0, 6);
    writeAll(next);
    setList(next);
  }, [session]);

  const switchTo = async (a: Saved) => {
    const { error } = await supabase.auth.setSession({
      access_token: a.access_token,
      refresh_token: a.refresh_token,
    });
    if (error) {
      toast.error("期限切れのため再ログインしてください");
      const next = readAll().filter((x) => x.id !== a.id);
      writeAll(next);
      setList(next);
      return;
    }
    window.location.href = "/dashboard";
  };

  const add = async () => {
    // 端末内だけログアウト（保存したトークンは他端末同様に有効なまま）
    await supabase.auth.signOut({ scope: "local" });
    window.location.href = "/login";
  };

  const remove = (id: string) => {
    const next = readAll().filter((x) => x.id !== id);
    writeAll(next);
    setList(next);
  };

  if (!session) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="アカウント切り替え"
          title="アカウント切り替え"
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-accent"
        >
          <Users className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">アカウント切り替え</div>
        {list.map((a) => {
          const current = a.id === session.user.id;
          return (
            <div
              key={a.id}
              role="button"
              onClick={() => !current && switchTo(a)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
            >
              <span className="flex-1 truncate">{a.label}</span>
              {current ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <span
                  role="button"
                  aria-label="端末から削除"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    remove(a.id);
                  }}
                  className="p-1 rounded hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          );
        })}
        <div className="my-1 h-px bg-border" />
        <button onClick={add} className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent">
          <UserPlus className="mr-2 h-4 w-4" /> 別のアカウントを追加
        </button>
      </PopoverContent>
    </Popover>
  );
}
