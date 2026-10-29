import * as React from 'react'
import { StudyEmail } from './_layout'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <StudyEmail
    preview={`Study# 確認コード ${token} / Your verification code`}
    titleJa="確認コード"
    titleEn="Your verification code"
    bodyJa="本人確認のため、次のコードを入力してください。"
    bodyEn="Enter the code above to confirm it's you."
    code={token}
    noteJa="コードの有効期限は短時間です。誰にも教えないでください。"
    noteEn="This code expires soon. Never share it with anyone."
  />
)

export default ReauthenticationEmail
