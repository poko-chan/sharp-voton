import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Perm = {
  student_id: string;
  can_view_grades: boolean;
  can_upload_files: boolean;
  can_comment: boolean;
};

const DEFAULTS: Omit<Perm, "student_id"> = {
  can_view_grades: true,
  can_upload_files: true,
  can_comment: true,
};

export function ClassPermissionsPanel({
  classId,
  members,
  ownerId,
}: {
  classId: string;
  members: { user_id: string; role: string; profile?: { display_name?: string | null; username?: string | null } }[];
  ownerId: string;
}) {
  const students = members.filter((m) => m.user_id !== ownerId && m.role !== "teacher");
  const [perms, setPerms] = useState<Record<string, Perm>>({});

  const load = async () => {
    const { data, error } = await supabase
      .from("class_student_permissions")
      .select("student_id, can_view_grades, can_upload_files, can_comment")
      .eq("class_id", classId);
    if (error) {
      toast.error(error.message);
      return;
    }
    const map: Record<string, Perm> = {};
    (data ?? []).forEach((row: any) => {
      map[row.student_id] = row;
    });
    setPerms(map);
  };

  useEffect(() => {
    load();
  }, [classId]);

  const update = async (studentId: string, field: keyof Omit<Perm, "student_id">, value: boolean) => {
    const existing = perms[studentId] ?? { student_id: studentId, ...DEFAULTS };
    const next = { ...existing, [field]: value };
    setPerms({ ...perms, [studentId]: next });
    const { error } = await supabase
      .from("class_student_permissions")
      .upsert(
        { class_id: classId, ...next },
        { onConflict: "class_id,student_id" },
      );
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  if (students.length === 0) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">生徒がまだいません</Card>;
  }

  return (
    <Card className="p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr className="text-left">
            <th className="p-3">生徒</th>
            <th className="p-3 text-center">成績を閲覧</th>
            <th className="p-3 text-center">ファイル投稿</th>
            <th className="p-3 text-center">コメント</th>
          </tr>
        </thead>
        <tbody>
          {students.map((m) => {
            const p = perms[m.user_id] ?? { student_id: m.user_id, ...DEFAULTS };
            const name = m.profile?.display_name ?? m.profile?.username ?? "?";
            return (
              <tr key={m.user_id} className="border-t">
                <td className="p-3">{name}</td>
                <td className="p-3 text-center">
                  <Switch
                    checked={p.can_view_grades}
                    onCheckedChange={(v) => update(m.user_id, "can_view_grades", v)}
                  />
                </td>
                <td className="p-3 text-center">
                  <Switch
                    checked={p.can_upload_files}
                    onCheckedChange={(v) => update(m.user_id, "can_upload_files", v)}
                  />
                </td>
                <td className="p-3 text-center">
                  <Switch
                    checked={p.can_comment}
                    onCheckedChange={(v) => update(m.user_id, "can_comment", v)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="p-3 text-xs text-muted-foreground border-t bg-muted/30">
        既定: すべて許可。OFF にすると、その生徒は該当の操作ができなくなります。
      </div>
    </Card>
  );
}

/** Helper hook for the current user's effective permissions in a class. */
export function useMyClassPermissions(classId: string, userId: string | undefined, isTeacherOrOwner: boolean) {
  const [perm, setPerm] = useState<Omit<Perm, "student_id">>(DEFAULTS);
  useEffect(() => {
    if (!userId || isTeacherOrOwner) {
      setPerm(DEFAULTS);
      return;
    }
    supabase
      .from("class_student_permissions")
      .select("can_view_grades, can_upload_files, can_comment")
      .eq("class_id", classId)
      .eq("student_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPerm(data as Omit<Perm, "student_id">);
      });
  }, [classId, userId, isTeacherOrOwner]);
  return perm;
}
