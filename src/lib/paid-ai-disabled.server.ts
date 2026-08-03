export function paidAiDisabled(): never {
  throw new Error("クラウド AI（AI Gateway）は有料プラン専用のため使用できません。上部のAIボタンから無料の端末内AIを選択してください。");
}