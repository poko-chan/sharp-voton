import { supabase } from "@/integrations/supabase/client";

export type ClassroomAttachment = {
  name: string;
  url: string;
  size?: number;
  type?: string;
};

export async function uploadClassroomFile(userId: string, file: File): Promise<ClassroomAttachment> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("classroom-files").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("classroom-files").getPublicUrl(path);
  return { name: file.name, url: data.publicUrl, size: file.size, type: file.type };
}

export function fileExt(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}
