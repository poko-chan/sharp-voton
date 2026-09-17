import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/storage-url";

export const IMG_PREFIX = "[img]";
export const isImageMessage = (content: string) => content.startsWith(IMG_PREFIX);

/** チャットに送られた画像（非公開バケット）を署名付きURLで表示する */
export function ChatImage({ content }: { content: string }) {
  const path = content.slice(IMG_PREFIX.length).trim();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    signedUrl("chat-images", path)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [path]);

  if (failed) return <span className="text-xs opacity-70">画像を表示できません</span>;
  if (!url) return <div className="h-32 w-40 rounded-md bg-muted animate-pulse" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        src={url}
        alt="送信された画像"
        loading="lazy"
        className="max-h-64 max-w-[260px] rounded-md object-contain"
      />
    </a>
  );
}
