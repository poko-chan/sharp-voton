import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export const BRAND = '#00C9B7'
export const BRAND_DARK = '#00877B'
export const SITE_URL = 'https://sharp.voton.app'

const css = `
@media (prefers-color-scheme: dark) {
  .card { background:#12201f !important; border-color:#1f3a37 !important; }
  .t { color:#e6f4f2 !important; }
  .m { color:#a7c4c0 !important; }
}
@media only screen and (max-width:600px) {
  .card { padding:24px 18px !important; }
}
`

interface Props {
  preview: string
  titleJa: string
  titleEn: string
  bodyJa: React.ReactNode
  bodyEn: React.ReactNode
  ctaUrl?: string
  ctaJa?: string
  ctaEn?: string
  code?: string
  noteJa: string
  noteEn: string
}

export const StudyEmail = (p: Props) => (
  <Html lang="ja" dir="ltr">
    <Head>
      <meta name="color-scheme" content="light dark" />
      <style>{css}</style>
    </Head>
    <Preview>{p.preview}</Preview>
    <Body style={main}>
      <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '24px 12px' }}>
        <Section style={{ textAlign: 'center', padding: '8px 0 18px' }}>
          <Text style={logo}>
            Study<span style={{ color: BRAND }}>#</span>
          </Text>
        </Section>
        <Section className="card" style={card}>
          <div style={bar} />
          <Heading className="t" style={h1}>{p.titleJa}</Heading>
          <Text className="t" style={text}>{p.bodyJa}</Text>
          {p.code ? <Text style={codeStyle}>{p.code}</Text> : null}
          {p.ctaUrl ? (
            <Section style={{ textAlign: 'center', margin: '26px 0' }}>
              <Button href={p.ctaUrl} style={button}>
                {p.ctaJa} / {p.ctaEn}
              </Button>
            </Section>
          ) : null}
          <Text className="m" style={note}>{p.noteJa}</Text>
          <Hr style={{ borderColor: '#e3efed', margin: '22px 0' }} />
          <Text className="t" style={h2}>{p.titleEn}</Text>
          <Text className="m" style={textEn}>{p.bodyEn}</Text>
          <Text className="m" style={note}>{p.noteEn}</Text>
          {p.ctaUrl ? (
            <Text className="m" style={small}>
              ボタンが押せない場合 / If the button doesn't work:
              <br />
              <Link href={p.ctaUrl} style={{ color: BRAND_DARK, wordBreak: 'break-all' }}>
                {p.ctaUrl}
              </Link>
            </Text>
          ) : null}
        </Section>
        <Text style={footer}>
          このメールは Study# から自動送信されています（返信不可）。
          <br />
          This is an automated message from Study#. Please do not reply.
          <br />
          <Link href={SITE_URL} style={{ color: BRAND_DARK }}>sharp.voton.app</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

const font =
  "'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Segoe UI',Meiryo,Arial,sans-serif"
const main = { backgroundColor: '#ffffff', fontFamily: font, margin: 0 }
const logo = { fontSize: '26px', fontWeight: 800 as const, color: '#0f2a28', margin: 0, letterSpacing: '-0.5px' }
const card = {
  backgroundColor: '#F4FBFA',
  border: '1px solid #d6efec',
  borderRadius: '16px',
  padding: '32px 30px',
}
const bar = { height: '4px', width: '48px', backgroundColor: BRAND, borderRadius: '4px', marginBottom: '18px' }
const h1 = { fontSize: '22px', fontWeight: 700 as const, color: '#0f2a28', margin: '0 0 14px' }
const h2 = { fontSize: '16px', fontWeight: 700 as const, color: '#0f2a28', margin: '0 0 8px' }
const text = { fontSize: '15px', lineHeight: '1.8', color: '#28403d', margin: '0 0 8px' }
const textEn = { fontSize: '14px', lineHeight: '1.7', color: '#4a6360', margin: '0 0 8px' }
const note = { fontSize: '12.5px', lineHeight: '1.6', color: '#6b8582', margin: '8px 0 0' }
const small = { fontSize: '12px', lineHeight: '1.6', color: '#6b8582', margin: '18px 0 0' }
const button = {
  backgroundColor: BRAND,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700 as const,
  borderRadius: '999px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const codeStyle = {
  fontFamily: "'SFMono-Regular',Consolas,monospace",
  fontSize: '30px',
  fontWeight: 700 as const,
  letterSpacing: '8px',
  color: BRAND_DARK,
  backgroundColor: '#ffffff',
  border: `2px dashed ${BRAND}`,
  borderRadius: '12px',
  textAlign: 'center' as const,
  padding: '14px 0',
  margin: '18px 0',
}
const footer = { fontSize: '11.5px', lineHeight: '1.7', color: '#8aa19e', textAlign: 'center' as const, margin: '20px 0 0' }
