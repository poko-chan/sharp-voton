import * as React from 'react'
import { StudyEmail } from './_layout'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <StudyEmail
    preview="Study# への招待 / You've been invited to Study#"
    titleJa="Study# への招待"
    titleEn="You've been invited"
    bodyJa="Study# に招待されました。下のボタンから招待を受けてアカウントを作成してください。"
    bodyEn="You've been invited to join Study#. Accept to create your account."
    ctaUrl={confirmationUrl}
    ctaJa="招待を受ける"
    ctaEn="Accept"
    noteJa="心当たりがない場合は、このメールを破棄してください。"
    noteEn="If you weren't expecting this, you can ignore this email."
  />
)

export default InviteEmail
