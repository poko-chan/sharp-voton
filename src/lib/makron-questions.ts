import { supabase } from "@/integrations/supabase/client";

/**
 * 正解データ（correct_options / accepted_answers / model_answer）は
 * クライアントから直接 SELECT できません。編集画面では
 * makron_question_keys RPC（管理者・作成者のみ）で取得します。
 */
export const QUESTION_COLUMNS =
  "id, unit_id, pack_id, prompt, image_url, type, options, explanation, points, grading, hint_text, order_idx, is_active, status, created_by, submitted_at, reviewed_at, reviewed_by, created_at, updated_at";

export type QuestionKeys = {
  correct_options: string[];
  accepted_answers: string[];
  model_answer: string | null;
};

export async function loadQuestionKeys(questionId: string): Promise<QuestionKeys> {
  const { data, error } = await (supabase as any).rpc("makron_question_keys", { _ids: [questionId] });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0];
  return {
    correct_options: (row?.correct_options as string[]) ?? [],
    accepted_answers: (row?.accepted_answers as string[]) ?? [],
    model_answer: (row?.model_answer as string | null) ?? "",
  };
}
