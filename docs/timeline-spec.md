# タイムライン（SNS）機能 設計ドキュメント

対象範囲: `/feed`（タイムライン）, `/friends`（フレンド）, `/share`（共有・エクスポート）
最終更新: 本ドキュメント作成時点のスキーマ調査に基づく（既存マイグレーションを実読した上で作成）。

---

## 1. 目的・スコープ

学習者が自分の勉強記録（教材・学習時間・コメント）をタイムラインに投稿し、フォロー関係にあるユーザー同士でいいね・コメントによって励まし合える機能。

対象外: DM（`chat_messages` は別画面）、コイン送付（`friends.tsx` に残置、本ドキュメントの対象外）。

---

## 2. 主要機能一覧

| # | 機能 | 概要 |
|---|------|------|
| 1 | 勉強記録の投稿 | 本文（コメント）、学習時間（分）、教材/教科、公開範囲を指定して投稿 |
| 2 | 直近の学習記録から投稿を作成 | `study_logs` の直近7日分をワンタップで下書きに反映 |
| 3 | タイムライン表示 | タブで「すべて」「フォロー中」「自分」を切替 |
| 4 | 公開範囲（visibility） | `public`（全体公開） / `followers`（フォロワーのみ） / `private`（自分のみ）を投稿ごとに設定 |
| 5 | 組織限定投稿 | 既存の `organization_id` によるクラス/組織限定投稿（visibility とは独立した追加スコープ） |
| 6 | いいね | 1ユーザー1投稿につき1回。トグル可能 |
| 7 | コメント | 投稿に対してスレッド形式のコメント（削除は本人/管理者） |
| 8 | 投稿削除 | 投稿者本人 or 管理者のみ |
| 9 | もっと見る（ページネーション） | 20件ずつ取得し、末尾の「もっと見る」ボタンで追加読込 |
| 10 | フレンド管理 | フォロー/フォロワー/フレンド(相互)/申請中を明確に区別 |

---

## 3. 画面遷移・UI設計

### 3.1 `/feed`（タイムライン）

```
┌ タイムライン ─────────────────────────┐
│ [投稿フォーム]                         │
│  ・直近の学習記録チップ（タップで反映） │
│  ・本文 / 分 / 教科 / 公開範囲セレクト  │
│  ・投稿ボタン                          │
├────────────────────────────────────┤
│ タブ: [すべて] [フォロー中] [自分]     │
│ （組織を持つ場合は組織フィルタを併記） │
├────────────────────────────────────┤
│ 投稿カード ×N                          │
│  ・アバター/名前/日時/公開範囲バッジ    │
│  ・本文                                │
│  ・教科チップ・分数チップ              │
│  ・♥いいね数 / 💬コメント              │
│  ・(展開)コメント一覧 + 入力欄          │
├────────────────────────────────────┤
│ [もっと見る]                           │
└────────────────────────────────────┘
```

**1カードの構成要素**
- ヘッダー: アバター（頭文字）、表示名、投稿日時、`visibility` バッジ（全体公開/フォロワー限定/自分のみ・組織限定は別バッジ）、（本人のみ）削除ボタン
- 本文: 改行保持のテキスト
- メタ情報チップ: 教科名、学習時間（分）
- アクションバー: いいねボタン（トグル、件数表示）、コメント開閉ボタン
- コメントパネル: 既存コメントのリスト＋インライン投稿欄

**タブの種類**
- `すべて`: 自分が閲覧可能な投稿全体（RLS が返す範囲＝`public` 投稿 + 自分がフォロワーとして見える `followers` 投稿 + 自分の投稿 + 組織投稿）
- `フォロー中`: 自分がフォローしている（`follows.status = 'accepted'`）ユーザーの投稿のみ
- `自分`: 自分の投稿のみ（`private` を含む全件）

### 3.2 `/friends`（フレンド）

メンタルモデルを **「相互フォロー = フレンド」** に統一する。

```
タブ: [ランキング] [探す] [フォロー中] [フォロワー] [フレンド(相互)] [申請中]
```

- **フォロー中**: 自分→相手が `accepted` の一覧
- **フォロワー**: 相手→自分が `accepted` の一覧
- **フレンド(相互)**: フォロー中とフォロワーの積集合（＝相互フォロー）。`are_mutual_friends()` の考え方と一致させ、コイン送付など「相互フォローのみ」機能の対象を明示する
- **申請中**: 自分宛の承認待ち（受信）／自分が送った承認待ち（送信）をひとつのタブにまとめて表示

このアプリでは「フレンド申請」という独立の概念・テーブルは持たない。**フォロー申請（`follows.status = 'pending'`）を承認すると相互フォロー＝フレンドになる**、という単一の仕組みに一本化する。`rivals` 等の別概念テーブルは存在しないため削除対象なし（調査の結果、DB上に重複テーブルは無かった）。

---

## 4. DB設計

### 4.1 現状のスキーマ（実装済み・調査結果）

| テーブル | 主要カラム | 備考 |
|---|---|---|
| `profiles`(Users相当) | `id`, `username`, `display_name`, `avatar_url` | 認証ユーザーに1:1 |
| `study_logs` | `id`, `user_id`, `date`, `duration_minutes`, `subject_id`, `content` | 学習記録の実体。投稿の下書き元 |
| `social_posts` | `id`, `user_id`, `body`, `minutes`, `subject`, `organization_id`, `created_at`, `updated_at` | 投稿。**公開範囲カラムが無かった**（今回 `visibility` を追加） |
| `social_likes` | `id`, `post_id`, `user_id` | `unique(post_id,user_id)` |
| `social_comments` | `id`, `post_id`, `user_id`, `body`, `created_at` | |
| `follows` | `id`, `follower_id`, `following_id`, `status('pending'\|'accepted')` | フォロー関係。相互フォロー判定は `are_mutual_friends(a,b)` 関数を使用 |

既存の便利関数:
- `public.is_org_member(org, user)` — 組織メンバー判定
- `public.are_mutual_friends(a, b)` — 相互フォロー(=フレンド)判定（`chat_messages` の DM 許可判定に既に利用中）

### 4.2 今回の差分（提案・実装）

1. `social_posts.visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','followers','private'))` を追加
2. `public.can_view_social_post(post_id, uid)` を新設し、投稿・いいね・コメントの SELECT/INSERT RLS で共通利用
3. `social_posts` / `social_likes` / `social_comments` の RLS ポリシーを visibility 対応に更新（4.3参照）
4. `follows` / `are_mutual_friends` はスキーマ変更なし（そのまま「相互フォロー=フレンド」の実装として採用）

### 4.3 ER 概要

```
profiles 1───* study_logs
profiles 1───* social_posts ───* social_likes
                        └──────* social_comments
profiles *───* follows (follower_id, following_id, status)
```

---

## 5. セキュリティ・プライバシー要件（公開範囲 / RLS方針）

### 5.1 公開範囲の定義

| visibility | 意味 | 閲覧できる人 |
|---|---|---|
| `public` | 全体公開（デフォルト） | 全ログインユーザー |
| `followers` | フォロワーのみ | 投稿者本人 + 投稿者を `accepted` でフォローしているユーザー |
| `private` | 自分のみ | 投稿者本人のみ |

`organization_id` が設定されている投稿は上記に加えて別軸のスコープとして扱い、**組織メンバーであれば閲覧可能**（visibility は組織投稿には適用しない＝組織内共有を優先）。

### 5.2 RLS 方針

- 全テーブルで `ENABLE ROW LEVEL SECURITY` を維持し、`authenticated` ロールにのみ最小権限の GRANT を付与する。
- 閲覧可否のロジックは `can_view_social_post()`（SECURITY DEFINER）に集約し、`social_posts` / `social_likes` / `social_comments` の3テーブルで重複実装しない（follows 情報を横断参照する必要があるため）。
- いいね・コメントの **INSERT** も「閲覧できない投稿には書き込めない」ように `can_view_social_post()` でガードする（`private`/`followers` 投稿への不正な干渉を防止）。
- 投稿の **UPDATE/DELETE** は本人または `has_role(uid,'admin')` のみ（既存のまま）。
- クライアントは RLS を信頼し、フロントの絞り込み（タブ）はあくまで UX 上の补助であり、実際の可視性は DB 側で担保する。

### 5.3 フレンド機能のプライバシー

- フォロー申請 (`pending`) は相手に通知目的でのみ公開し、`follows` テーブルの `SELECT` は認証済み全員に許可（フォロー関係自体は非機微情報として扱う既存方針を踏襲）。
- コイン送付など機微な操作は `are_mutual_friends()` を用いて相互フォローのみに制限（既存のまま）。

---

## 6. 実装ファイル対応表

| ファイル | 役割 |
|---|---|
| `src/routes/_authenticated/feed.tsx` | タイムライン画面（タブ・投稿フォーム・一覧のコンテナ） |
| `src/components/feed/PostComposer.tsx` | 投稿フォーム（本文/時間/教科/公開範囲/直近記録の反映） |
| `src/components/feed/PostCard.tsx` | 投稿1件のカードUI（いいね・コメント） |
| `src/components/feed/VisibilityBadge.tsx` | 公開範囲バッジ表示 |
| `src/lib/social.functions.ts` | タイムライン取得（タブ・ページネーション）、投稿作成のサーバー関数 |
| `src/routes/_authenticated/friends.tsx` | フォロー/フォロワー/フレンド(相互)/申請中の一本化UI |
