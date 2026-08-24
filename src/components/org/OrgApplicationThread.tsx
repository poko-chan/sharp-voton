import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ShieldCheck, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

interface Msg {
  id: string;
  body: string;
  is_admin: boolean;
  created_at: string;
  sender_id: string;
}

/** 導入申請ごとの、申請者と運営のあいだの問い合わせスレッド。 */
export function OrgApplicationThread({ applicationId }: { applicationId: string }) {
  const { user, isAdmin } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("organization_application_messages")
      .select("id, body, is_admin, created_at, sender_id")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true });
    if (error) return toast.error(error.message);
    setMsgs((data ?? []) as Msg[]);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`org-app-${applicationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "organization_application_messages", filter: `application_id=eq.${applicationId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [applicationId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [msgs.length]);

  const send = async () => {
    const text = body.trim();
    if (!text || !user) return;
    if (text.length > 2000) return toast.error("2000文字以内で入力してください");
    setBusy(true);
    const { error } = await (supabase as any).from("organization_application_messages").insert({
      application_id: applicationId,
      sender_id: user.id,
      is_admin: isAdmin,
      body: text,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setBody("");
    load();
  };

  return (
    <div className="space-y-3">
      <div className="max-h-72 space-y-2 overflow-auto rounded-xl border border-border/60 bg-muted/30 p-3">
        {msgs.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            まだメッセージはありません。ご質問や補足があればこちらから運営にお送りください。
          </p>
        )}
        {msgs.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  mine ? "bg-primary text-primary-foreground" : "bg-card border border-border/60"
                }`}
              >
                <div className="mb-0.5 flex items-center gap-1 text-[10px] opacity-80">
                  {m.is_admin ? <ShieldCheck className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                  {m.is_admin ? "StudyΩ 運営" : "申請者"}
                  <span>・{new Date(m.created_at).toLocaleString("ja-JP")}</span>
                </div>
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <div className="flex items-end gap-2">
        <Textarea
          rows={2}
          value={body}
          maxLength={2000}
          placeholder="運営へのメッセージを入力"
          onChange={(e) => setBody(e.target.value)}
        />
        <Button onClick={send} disabled={busy || !body.trim()}>
          <Send className="mr-1 h-4 w-4" />
          送信
        </Button>
      </div>
    </div>
  );
}
