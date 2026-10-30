# Voton Study#

**Live app**: https://sharp.voton.app
## Voton 認証連携

Voton ログインを有効にするには、デプロイ環境に次のサーバー環境変数を設定してください。

```text
VOTON_URL=https://bzcapzqxrbjfdlamctrb.supabase.co
VOTON_PUBLISHABLE_KEY=<Voton の publishable key>
```

Supabase のマイグレーションで `profiles.voton_user_id` と一意インデックスが作成されます。Voton 管理画面の OAuth 戻り先には、次の URL を登録してください。

```text
https://sharp.voton.app/login/redirect-voton
```
