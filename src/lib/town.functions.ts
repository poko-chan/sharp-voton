import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { paidAiDisabled } from "@/lib/paid-ai-disabled.server";

const MODEL = "google/gemini-2.5-flash";

export const listTowns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("towns")
      .select("id, name, town_goal, stage, max_stage_reached, archived, last_judged_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createTown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    name: z.string().min(1).max(100),
    town_goal: z.string().min(1).max(4000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    paidAiDisabled();
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("towns").insert({
      user_id: userId, name: data.name, town_goal: data.town_goal,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateTown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100).optional(),
    town_goal: z.string().min(1).max(4000).optional(),
    archived: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: { name?: string; town_goal?: string; archived?: boolean } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.town_goal !== undefined) patch.town_goal = data.town_goal;
    if (data.archived !== undefined) patch.archived = data.archived;
    const { error } = await supabase.from("towns").update(patch).eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("towns").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getTownHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ townId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("town_history")
      .select("id, stage_before, stage_after, delta, reason, narrative, created_at")
      .eq("town_id", data.townId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const judgeTown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ townId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY が設定されていません");

    const { data: town, error: e1 } = await supabase
      .from("towns").select("*").eq("id", data.townId).eq("user_id", userId).single();
    if (e1 || !town) throw new Error("町が見つかりません");

    // 直近30日の集計
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const [logsRes, subsRes, goalsRes, gradesRes, historyRes] = await Promise.all([
      supabase.from("study_logs").select("date, duration_minutes, content, subjects(name)").eq("user_id", userId).gte("date", since),
      supabase.from("submissions").select("score, xp_awarded, submitted_at").eq("user_id", userId).gte("submitted_at", new Date(Date.now() - 30 * 86400000).toISOString()),
      supabase.from("goals").select("title, done, progress_minutes, target_minutes").eq("user_id", userId),
      supabase.from("grading_history").select("score, correct").eq("user_id", userId).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
      supabase.from("town_history").select("delta, reason, created_at").eq("town_id", data.townId).order("created_at", { ascending: false }).limit(5),
    ]);

    const logs = logsRes.data ?? [];
    const totalMin = logs.reduce((s, l) => s + (l.duration_minutes ?? 0), 0);
    const activeDays = new Set(logs.map((l) => l.date)).size;
    const subjectMin = new Map<string, number>();
    for (const l of logs as any[]) {
      const n = l.subjects?.name ?? "その他";
      subjectMin.set(n, (subjectMin.get(n) ?? 0) + (l.duration_minutes ?? 0));
    }
    const subjects = Array.from(subjectMin.entries()).map(([n, m]) => `${n}:${m}分`).join(", ");
    const subs = subsRes.data ?? [];
    const xpTotal = subs.reduce((s, r) => s + (r.xp_awarded ?? 0), 0);
    const goals = goalsRes.data ?? [];
    const goalsSummary = goals.map((g) => `${g.done ? "✓" : "・"}${g.title}(${g.progress_minutes}/${g.target_minutes}分)`).join("; ");
    const grades = gradesRes.data ?? [];
    const avgScore = grades.length ? Math.round(grades.reduce((s, g) => s + (g.score ?? 0), 0) / grades.length) : 0;
    const lastLog = logs.length ? logs.reduce((m, l) => l.date > m ? l.date : m, logs[0].date) : null;
    const daysSinceLast = lastLog
      ? Math.floor((Date.now() - new Date(lastLog + "T00:00:00").getTime()) / 86400000)
      : 999;
    const recentHistory = (historyRes.data ?? []).map((h) => `${h.created_at.slice(0, 10)}: Δ${h.delta} (${h.reason ?? ""})`).join(" / ");

    const systemPrompt = `あなたは学習ゲーム「Study+」の町の発展を判定するAI裁定者です。
ユーザーが設定した「町の目標」と、過去30日の学習データを見て、町のステージ(stage)をどう変化させるか決めます。

- stage は 0(廃墟) から無限大の整数。
- 出力 delta は -3 から +3 の整数。良い努力=正、サボリ=負。
- 目標との一致度を最重視。目標から大きく外れている場合は伸びを控えめor減少。
- 30日以上完全に停滞なら delta=-3。
- 適切に厳しく、適切に褒めてください。
- 必ず JSON のみで返答してください: {"delta": number, "reason": string(120字以内), "narrative": string(町の様子を物語風に200字以内)}`;

    const userPrompt = `町の目標: ${town.town_goal}
現在のステージ: ${town.stage} (${town.max_stage_reached}まで到達)

直近30日の学習データ:
- 合計学習時間: ${totalMin}分
- 活動日数: ${activeDays}日/30日
- 教科別: ${subjects || "なし"}
- 課題提出XP合計: ${xpTotal}pt (${subs.length}件)
- 採点平均点: ${avgScore}点 (${grades.length}件)
- 目標: ${goalsSummary || "未設定"}
- 最終学習からの経過日数: ${daysSinceLast}日
- 直近の判定履歴: ${recentHistory || "初回判定"}

この町の発展ステージ変化を判定してください。`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("AIのリクエスト上限に達しました。少し時間を置いてください");
      if (res.status === 402) throw new Error("AIクレジットが不足しています");
      throw new Error(`AI判定失敗: ${res.status}`);
    }
    const aiJson = await res.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { delta?: number; reason?: string; narrative?: string };
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const delta = Math.max(-3, Math.min(3, Math.round(Number(parsed.delta ?? 0))));
    const reason = String(parsed.reason ?? "").slice(0, 200);
    const narrative = String(parsed.narrative ?? "").slice(0, 400);

    const newStage = Math.max(0, town.stage + delta);
    const newMax = Math.max(town.max_stage_reached, newStage);

    const { error: e2 } = await supabase.from("towns").update({
      stage: newStage,
      max_stage_reached: newMax,
      last_judged_at: new Date().toISOString(),
    }).eq("id", town.id).eq("user_id", userId);
    if (e2) throw new Error(e2.message);

    await supabase.from("town_history").insert({
      town_id: town.id,
      user_id: userId,
      stage_before: town.stage,
      stage_after: newStage,
      delta,
      reason,
      narrative,
      ai_response: parsed as any,
    });

    return { delta, reason, narrative, newStage, newMax };
  });

/**
 * Deterministic recompute based on the last 7 days of study (not AI).
 * - >= avg target/day → +1 stage
 * - >= 2x avg → +2
 * - 0 minutes for 7 days → -2
 * - 0 minutes for 3 consecutive days → -1
 * - otherwise → 0
 * 400+ minute log entries are clamped to 400.
 */
export const recomputeTown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ townId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: town, error: e1 } = await supabase
      .from("towns").select("*").eq("id", data.townId).eq("user_id", userId).single();
    if (e1 || !town) throw new Error("町が見つかりません");

    const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const { data: logs } = await supabase
      .from("study_logs").select("date, duration_minutes")
      .eq("user_id", userId).gte("date", since);

    const dayMap = new Map<string, number>();
    let total = 0;
    for (const l of logs ?? []) {
      const capped = Math.min(400, l.duration_minutes ?? 0);
      dayMap.set(l.date, (dayMap.get(l.date) ?? 0) + capped);
      total += capped;
    }
    const activeDays = Array.from(dayMap.values()).filter((v) => v > 0).length;
    const avgPerDay = total / 7;

    // Check 3-day streak of zero ending today
    let zeroStreak = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      if ((dayMap.get(d) ?? 0) === 0) zeroStreak++;
      else break;
    }

    // Target per day grows with stage to keep difficulty up
    const targetPerDay = 30 + town.stage * 10;
    let delta = 0;
    let reason = "";
    if (activeDays === 0) {
      delta = -2;
      reason = "7日間まったく勉強がありません。町は荒れ果てました。";
    } else if (zeroStreak >= 3) {
      delta = -1;
      reason = `${zeroStreak}日連続で記録なし。町は少し寂れました。`;
    } else if (avgPerDay >= targetPerDay * 2) {
      delta = 2;
      reason = `7日平均 ${Math.round(avgPerDay)}分(目標 ${targetPerDay}分/日)。圧倒的努力！`;
    } else if (avgPerDay >= targetPerDay) {
      delta = 1;
      reason = `7日平均 ${Math.round(avgPerDay)}分(目標 ${targetPerDay}分/日)。順調な発展。`;
    } else if (avgPerDay >= targetPerDay * 0.5) {
      delta = 0;
      reason = `7日平均 ${Math.round(avgPerDay)}分。現状維持。もう少し頑張ろう。`;
    } else {
      delta = -1;
      reason = `7日平均 ${Math.round(avgPerDay)}分(目標 ${targetPerDay}分/日に届かず)。少し退化。`;
    }

    const newStage = Math.max(0, town.stage + delta);
    const newMax = Math.max(town.max_stage_reached, newStage);

    const narrative =
      delta > 0
        ? `${activeDays}日活動で町に活気が戻り、新しい建物が立ち並んだ。`
        : delta < 0
        ? `静まり返った町。住人は減り、いくつかの建物は朽ち果てた。`
        : `穏やかな日々。町は変わらず存在する。`;

    const { error: e2 } = await supabase.from("towns").update({
      stage: newStage,
      max_stage_reached: newMax,
      last_judged_at: new Date().toISOString(),
    }).eq("id", town.id).eq("user_id", userId);
    if (e2) throw new Error(e2.message);

    await supabase.from("town_history").insert({
      town_id: town.id,
      user_id: userId,
      stage_before: town.stage,
      stage_after: newStage,
      delta,
      reason,
      narrative,
      ai_response: { mode: "deterministic", avgPerDay, activeDays, zeroStreak, targetPerDay },
    });

    return { delta, reason, narrative, newStage, newMax };
  });
