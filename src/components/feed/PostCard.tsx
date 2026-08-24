import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { VisibilityBadge } from "./VisibilityBadge";

export type FeedPost = {
  id: string; user_id: string; body: string; minutes: number | null; subject: string | null;
  organization_id: string | null; created_at: string; visibility: string;
};

export function PostCard({
  post, name, isMine, like, onToggleLike, onToggleComments, commentsOpen, comments, onAddComment, onDelete,
}: {
  post: FeedPost;
  name: (uid: string) => string;
  isMine: boolean;
  like: { count: number; mine: boolean } | undefined;
  onToggleLike: () => void;
  onToggleComments: () => void;
  commentsOpen: boolean;
  comments: any[] | undefined;
  onAddComment: (body: string) => void;
  onDelete: () => void;
}) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">{name(post.user_id).slice(0, 1)}</div>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{name(post.user_id)}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{new Date(post.created_at).toLocaleString("ja-JP")}</span>
            <VisibilityBadge visibility={post.visibility} isOrg={!!post.organization_id} />
          </div>
        </div>
        {isMine && (
          <Button size="icon" variant="ghost" className="ml-auto" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap">{post.body}</p>
      {(post.minutes || post.subject) && (
        <div className="flex gap-2 text-[11px]">
          {post.subject && <span className="px-2 py-0.5 rounded bg-muted">{post.subject}</span>}
          {post.minutes ? <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">{post.minutes}分</span> : null}
        </div>
      )}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={onToggleLike} className={`flex items-center gap-1 text-xs ${like?.mine ? "text-red-500" : "text-muted-foreground"}`}>
          <Heart className={`h-4 w-4 ${like?.mine ? "fill-current" : ""}`} />{like?.count ?? 0}
        </button>
        <button onClick={onToggleComments} className="flex items-center gap-1 text-xs text-muted-foreground">
          <MessageCircle className="h-4 w-4" />コメント
        </button>
      </div>
      {commentsOpen && (
        <div className="space-y-2 border-t pt-2">
          {(comments ?? []).map((c) => (
            <div key={c.id} className="text-xs">
              <span className="font-semibold">{name(c.user_id)}</span>：{c.body}
            </div>
          ))}
          <CommentInput onSend={onAddComment} />
        </div>
      )}
    </Card>
  );
}

function CommentInput({ onSend }: { onSend: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2">
      <Input value={v} placeholder="コメントを書く…" onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { onSend(v); setV(""); } }} />
      <Button size="sm" onClick={() => { onSend(v); setV(""); }} disabled={!v.trim()}>送信</Button>
    </div>
  );
}
