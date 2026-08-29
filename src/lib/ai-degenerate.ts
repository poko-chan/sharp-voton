// 端末内AIが「!!!!!!!」のように同じ文字・語句を延々と吐く「暴走出力」を検出・除去する

/** 同じ文字（記号など）が長く連続しているか */
function hasCharRun(text: string, run = 12): boolean {
  return new RegExp(`(.)\\1{${run - 1},}`, "u").test(text);
}

/** 短いパターン（「あああ」「はい。はい。」など）の反復か */
function hasPatternLoop(text: string): boolean {
  const tail = text.slice(-400);
  return /(.{2,20}?)\1{5,}/su.test(tail);
}

/** 文単位の重複ループ */
function hasSentenceLoop(text: string): boolean {
  if (text.length < 240) return false;
  const parts = text.slice(-600).split(/[。．.!?！？\n]/).map((s) => s.trim()).filter((s) => s.length > 8);
  if (parts.length < 4) return false;
  return new Set(parts).size <= Math.floor(parts.length / 2);
}

/** 生成が壊れている（無限反復）か */
export function isDegenerate(text: string): boolean {
  if (!text) return false;
  return hasCharRun(text) || hasPatternLoop(text) || hasSentenceLoop(text);
}

/** 反復部分を取り除いて、読める部分だけを返す */
export function sanitizeAiText(text: string): string {
  let out = text
    // 同じ文字の3連続以上は3つに圧縮（!!!! → !!!）
    .replace(/(.)\1{3,}/gsu, "$1$1$1")
    // 短いパターンの反復は1回に
    .replace(/(.{2,20}?)\1{3,}/gsu, "$1");

  // 文の重複を除去（連続して同じ文が並ぶ場合）
  const lines = out.split("\n");
  const dedupLines: string[] = [];
  for (const l of lines) {
    if (l.trim() && dedupLines[dedupLines.length - 1]?.trim() === l.trim()) continue;
    dedupLines.push(l);
  }
  out = dedupLines.join("\n").trim();
  return out;
}

/** 中身のある回答になっているか（記号だけ・極端に短いものを弾く） */
export function hasMeaningfulContent(text: string): boolean {
  const t = sanitizeAiText(text).replace(/[\s!！?？。、.,\-*#>_~`]/g, "");
  return t.length >= 4;
}
