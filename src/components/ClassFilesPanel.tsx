import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { uploadClassroomFile } from "@/lib/classroom-files";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ClassFileRow = {
  id: string;
  class_id: string;
  uploader_id: string;
  name: string;
  url: string;
  size: number | null;
  mime: string | null;
  created_at: string;
};

export function ClassFilesPanel({
  classId,
  isTeacher,
  canUpload,
}: {
  classId: string;
  isTeacher: boolean;
  canUpload: boolean;
}) {
  const { user } = useAuth();
  const [files, setFiles] = useState<ClassFileRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaders, setUploaders] = useState<Record<string, { name: string }>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("class_files")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setFiles(data ?? []);
    const ids = Array.from(new Set((data ?? []).map((f) => f.uploader_id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .rpc("public_profiles_by_ids", { _ids: ids });
      const map: Record<string, { name: string }> = {};
      (profs ?? []).forEach((p: any) => {
        map[p.id] = { name: p.display_name ?? p.username ?? "?" };
      });
      setUploaders(map);
    }
  };

  useEffect(() => {
    load();
  }, [classId]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("25MB を超えるファイルはアップロードできません");
      return;
    }
    setUploading(true);
    try {
      const att = await uploadClassroomFile(user.id, file);
      const { error } = await supabase.from("class_files").insert({
        class_id: classId,
        uploader_id: user.id,
        name: att.name,
        url: att.url,
        size: att.size ?? null,
        mime: att.type ?? null,
      });
      if (error) throw error;
      toast.success("アップロードしました");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "アップロードに失敗しました");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDelete = async (f: ClassFileRow) => {
    if (!confirm(`「${f.name}」を削除しますか？`)) return;
    const { error } = await supabase.from("class_files").delete().eq("id", f.id);
    if (error) toast.error(error.message);
    else {
      toast.success("削除しました");
      load();
    }
  };

  const fmtSize = (n: number | null) => {
    if (!n) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <Card className="p-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-semibold">共有フォルダー</div>
          <p className="text-xs text-muted-foreground">クラスのメンバー全員が閲覧できます。</p>
        </div>
        {canUpload ? (
          <>
            <input ref={inputRef} type="file" className="hidden" onChange={onUpload} />
            <Button onClick={() => inputRef.current?.click()} disabled={uploading} size="sm">
              {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
              アップロード
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">あなたにはアップロード権限がありません</p>
        )}
      </Card>

      {files.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          ファイルはまだありません
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {files.map((f) => {
          const canDelete = isTeacher || f.uploader_id === user?.id;
          return (
            <Card key={f.id} className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded bg-muted grid place-items-center shrink-0">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{f.name}</div>
                <div className="text-xs text-muted-foreground">
                  {uploaders[f.uploader_id]?.name ?? "?"} ・ {fmtSize(f.size)} ・{" "}
                  {new Date(f.created_at).toLocaleDateString("ja-JP")}
                </div>
              </div>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded hover:bg-muted"
                title="開く / ダウンロード"
              >
                <Download className="h-4 w-4" />
              </a>
              {canDelete && (
                <button
                  onClick={() => onDelete(f)}
                  className="p-2 rounded hover:bg-destructive/10 text-destructive"
                  title="削除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
