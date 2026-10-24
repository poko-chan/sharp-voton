import * as React from 'react'
import { StudyEmail } from './_layout'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ recipient, confirmationUrl }: SignupEmailProps) => (
  <StudyEmail
    preview="Study# メールアドレスの確認 / Confirm your email"
    titleJa="メールアドレスの確認"
    titleEn="Confirm your email"
    bodyJa={<>Study# へようこそ！ {recipient} の登録を完了するため、下のボタンを押してください。</>}
    bodyEn={<>Welcome to Study#! Please confirm {recipient} to finish creating your account.</>}
    ctaUrl={confirmationUrl}
    ctaJa="確認する"
    ctaEn="Confirm"
    noteJa="心当たりがない場合は、このメールを破棄してください。"
    noteEn="If you didn't sign up, you can safely ignore this email."
  />
)

export default SignupEmail
