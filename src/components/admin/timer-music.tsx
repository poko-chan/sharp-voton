import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Music2, Plus, Trash2, Upload } from "lucide-react";

type Track = {
  id: string;
  title: string;
  cover_path: string;
  audio_path: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};


export function TimerMusicAdminTab() {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const load = async () => {
    const { data, error } = await supabase
      .from("timer_music_tracks")
      .select("*")
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    const list = data ?? [];
    setTracks(list);
    if (list.length) {
      const { data: signed } = await supabase.storage
        .from("timer-music")
        .createSignedUrls(
          list.map((t) => t.cover_path),
          60 * 60,
        );
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s) => {
        if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
      });
      setCoverUrls(map);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => {
    setTitle("");
    setCover(null);
    setAudio(null);
    if (coverRef.current) coverRef.current.value = "";
    if (audioRef.current) audioRef.current.value = "";
  };

  const save = async () => {
    if (!user || !title.trim() || !cover || !audio) {
      toast.error("曲名、写真、音楽ファイルをすべて指定してください");
      return;
    }
    if (!cover.type.startsWith("image/") || cover.size > 5 * 1024 * 1024) {
      toast.error("写真は5MB以下の画像を選んでください");
      return;
    }
    if (!audio.type.startsWith("audio/") || audio.size > 50 * 1024 * 1024) {
      toast.error("音楽ファイルは50MB以下の音声を選んでください");
      return;
    }

    setSaving(true);
    const id = crypto.randomUUID();
    const coverPath = `${id}/cover-${cover.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const audioPath = `${id}/audio-${audio.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    try {
      const coverUpload = await supabase.storage.from("timer-music").upload(coverPath, cover);
      if (coverUpload.error) throw coverUpload.error;
      const audioUpload = await supabase.storage.from("timer-music").upload(audioPath, audio);
      if (audioUpload.error) throw audioUpload.error;
      const { error } = await supabase.from("timer_music_tracks").insert({
        id,
        title: title.trim(),
        cover_path: coverPath,
        audio_path: audioPath,
      });
      if (error) throw error;
      toast.success("曲を公開しました");
      setOpen(false);
      resetForm();
      await load();
    } catch (error) {
      await supabase.storage.from("timer-music").remove([coverPath, audioPath]);
      toast.error(error instanceof Error ? error.message : "アップロードに失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (track: Track) => {
    const { error } = await supabase
      .from("timer_music_tracks")
      .update({ is_active: !track.is_active })
      .eq("id", track.id);
    if (error) return toast.error(error.message);
    await load();
  };

  const remove = async (track: Track) => {
    if (!confirm(`「${track.title}」を削除しますか？`)) return;
    const { error } = await supabase.from("timer_music_tracks").delete().eq("id", track.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("timer-music").remove([track.cover_path, track.audio_path]);
    toast.success("曲を削除しました");
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">タイマー音楽マーケット</h2>
          <p className="text-sm text-muted-foreground">
            公開した曲はタイマー利用者が再生し、お気に入りに登録できます。
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> 曲を追加
        </Button>
      </div>

      <div className="space-y-2">
        {tracks.map((track) => (
          <Card key={track.id} className="flex items-center gap-3 p-3">
            <img
              src={coverUrls[track.cover_path]}
              alt=""
              className="h-14 w-14 rounded object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{track.title}</div>
              <div className="text-xs text-muted-foreground">
                {track.is_active ? "公開中" : "非公開"} ·{" "}
                {new Date(track.created_at).toLocaleDateString("ja-JP")}
              </div>
            </div>
            <Switch
              checked={track.is_active}
              onCheckedChange={() => void toggle(track)}
              aria-label="公開状態"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void remove(track)}
              aria-label="曲を削除"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
        {tracks.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            <Music2 className="mx-auto mb-2 h-6 w-6" />
            まだ曲がありません
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>マーケットに曲を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="timer-music-title">曲名</Label>
              <Input
                id="timer-music-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timer-music-cover">曲の写真（5MB以下）</Label>
              <Input
                ref={coverRef}
                id="timer-music-cover"
                type="file"
                accept="image/*"
                onChange={(event) => setCover(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timer-music-audio">音楽ファイル（50MB以下）</Label>
              <Input
                ref={audioRef}
                id="timer-music-audio"
                type="file"
                accept="audio/*"
                onChange={(event) => setAudio(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              キャンセル
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              <Upload className="mr-1 h-4 w-4" />
              {saving ? "アップロード中..." : "公開する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
