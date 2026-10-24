import * as React from 'react'
import { StudyEmail } from './_layout'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ oldEmail, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <StudyEmail
    preview="Study# メールアドレス変更の確認 / Confirm your email change"
    titleJa="メールアドレス変更の確認"
    titleEn="Confirm your email change"
    bodyJa={<>{oldEmail} から {newEmail} への変更を確定するには、下のボタンを押してください。</>}
    bodyEn={<>Confirm changing your email from {oldEmail} to {newEmail}.</>}
    ctaUrl={confirmationUrl}
    ctaJa="変更を確定"
    ctaEn="Confirm"
    noteJa="心当たりがない場合は、すぐにパスワードを変更してください。"
    noteEn="If you didn't request this, please change your password right away."
  />
)

export default EmailChangeEmail
