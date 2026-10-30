import * as React from 'react'
import { StudyEmail } from './_layout'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <StudyEmail
    preview="Study# ログインリンク / Your login link"
    titleJa="ログインリンク"
    titleEn="Your login link"
    bodyJa="下のボタンを押すと、パスワードなしで Study# にログインできます。"
    bodyEn="Use the button above to sign in to Study# without a password."
    ctaUrl={confirmationUrl}
    ctaJa="ログイン"
    ctaEn="Log in"
    noteJa="リンクは一度だけ・短時間有効です。心当たりがない場合は破棄してください。"
    noteEn="This link works once and expires soon. If you didn't request it, ignore this email."
  />
)

export default MagicLinkEmail
