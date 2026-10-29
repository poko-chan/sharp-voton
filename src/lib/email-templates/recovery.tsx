import * as React from 'react'
import { StudyEmail } from './_layout'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <StudyEmail
    preview="Study# パスワードの再設定 / Reset your password"
    titleJa="パスワードの再設定"
    titleEn="Reset your password"
    bodyJa="パスワード再設定のリクエストを受け付けました。下のボタンから新しいパスワードを設定してください。"
    bodyEn="We received a request to reset your password. Use the button above to choose a new one."
    ctaUrl={confirmationUrl}
    ctaJa="再設定する"
    ctaEn="Reset"
    noteJa="リンクの有効期限は短時間です。心当たりがない場合は破棄してください（パスワードは変更されません）。"
    noteEn="This link expires soon. If you didn't request it, ignore this email — your password won't change."
  />
)

export default RecoveryEmail
