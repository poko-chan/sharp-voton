import { supabase } from "@/integrations/supabase/client";
import { aiJSON } from "@/lib/ai-provider";

/** AI が提案できる操作（ユーザーが許可したときだけ実行される） */
export type StudyLogAction = {
  kind: "add_study_log";
  date: string;          // YYYY-MM-DD
  subject: string;       // 教科名（存在しなければ作成）
  minutes: number;
  content: string;
  material: string | null; // 教材名（部分一致で検索）
};

export type GoalAction = {
  kind: "add_goal";
  title: string;
  target_minutes: number;
  deadline: string | null;
};

export type AiAction = StudyLogAction | GoalAction;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const actionSystem = (subjects: string[]) =>
  `あなたはユーザーの発言から「アプリへの登録操作」を抽出する変換器です。JSONだけを出力し、説明文やコードブロックは絶対に書かないでください。

今日の日付: ${today()}
登録済みの教科: ${subjects.join("、") || "（なし）"}

ユーザーが「勉強記録をつけて」「〜分やったから記録して」など学習記録の追加を求めている場合:
{"kind":"add_study_log","date":"YYYY-MM-DD","subject":"教科名","minutes":60,"content":"やった内容","material":"教材名またはnull"}

ユーザーが学習目標の作成を求めている場合:
{"kind":"add_goal","title":"目標名","target_minutes":600,"deadline":"YYYY-MM-DD または null"}

どちらでもない場合:
{"kind":"none"}

日付は「今日」「昨日」「◯月◯日」などを今日の日付から計算して必ず YYYY-MM-DD にしてください。時間は分単位の数値にしてください（「1時間半」→90）。`;

/** 「記録して」「目標を作って」など、明示的な登録依頼っぽいときだけ true。
 *  普通の質問で余計な判定AIを走らせないための軽量フィルタ（正規表現のみ・コストゼロ）。 */
export function looksLikeActionRequest(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 400) return false;
  const verb = /(記録|登録|つけて|付けて|保存|追加|作って|作成|設定)/;
  const target = /(勉強|学習|スタディ|ログ|記録|目標|ゴール|プラン|分|時間|h|時間半)/i;
  if (!verb.test(t)) return false;
  if (!target.test(t)) return false;
  // 質問文だけのケース（「どう記録するの？」など）は除外
  if (/(方法|やり方|どうやって|どうすれば|できますか|とは|なぜ|教えて.*方法)/.test(t) && !/(して|してください|お願い|しといて|してね)/.test(t)) return false;
  return true;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

/** ユーザーの最後の発言から操作提案を抽出する。提案がなければ null */
export async function detectAiAction(userText: string, subjects: string[]): Promise<AiAction | null> {
  if (!looksLikeActionRequest(userText)) return null;
  try {
    const raw = await withTimeout(aiJSON<any>(`ユーザーの発言:\n${userText}\n\nJSON:`, actionSystem(subjects)), 30000);
    if (!raw || typeof raw !== "object") return null;

    if (raw.kind === "add_study_log") {
      const minutes = Math.max(1, Math.min(400, Math.round(Number(raw.minutes) || 0)));
      if (!minutes) return null;
      return {
        kind: "add_study_log",
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date)) ? String(raw.date) : today(),
        subject: String(raw.subject ?? "").trim() || "その他",
        minutes,
        content: String(raw.content ?? "").trim(),
        material: raw.material && String(raw.material).toLowerCase() !== "null" ? String(raw.material).trim() : null,
      };
    }
    if (raw.kind === "add_goal" && String(raw.title ?? "").trim()) {
      return {
        kind: "add_goal",
        title: String(raw.title).trim().slice(0, 100),
        target_minutes: Math.max(1, Math.round(Number(raw.target_minutes) || 600)),
        deadline: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.deadline)) ? String(raw.deadline) : null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchSubjectNames(userId: string): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase.from("subjects").select("id,name").eq("user_id", userId);
  return (data ?? []) as any[];
}

export async function findMaterial(name: string): Promise<{ id: string; title: string } | null> {
  const { data } = await (supabase as any)
    .from("materials").select("id,title").eq("status", "approved").ilike("title", `%${name}%`).limit(1);
  return (data ?? [])[0] ?? null;
}

/** ユーザーが許可したときだけ呼ぶ */
export async function applyAiAction(action: AiAction, userId: string): Promise<string> {
  if (action.kind === "add_study_log") {
    const subs = await fetchSubjectNames(userId);
    let subject = subs.find((s) => s.name === action.subject) ?? subs.find((s) => s.name.includes(action.subject));
    if (!subject) {
      const { data, error } = await supabase
        .from("subjects").insert({ user_id: userId, name: action.subject } as never).select("id,name").single();
      if (error) throw error;
      subject = data as any;
    }
    const mat = action.material ? await findMaterial(action.material) : null;
    const { error } = await supabase.from("study_logs").insert({
      user_id: userId,
      date: action.date,
      subject_id: subject!.id,
      duration_minutes: action.minutes,
      content: action.content,
      material_id: mat?.id ?? null,
      material_ids: mat ? [mat.id] : [],
    } as never);
    if (error) throw error;
    return `${action.date} に ${subject!.name} ${action.minutes}分を記録しました`;
  }

  const { error } = await supabase.from("goals").insert({
    user_id: userId,
    title: action.title,
    target_minutes: action.target_minutes,
    deadline: action.deadline,
    scope: "all",
    progress_minutes: 0,
  } as never);
  if (error) throw error;
  return `目標「${action.title}」を作成しました`;
}
