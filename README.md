# Wine Work Women Core

WWWのPublic Site、共通パスワード式Member Site、Admin Dashboard、D1 Core DB、R2 Media、Kaihipay/LINE Ops Bridgeを1つのCloudflare Worker互換アプリにまとめています。

## Local setup

1. `.env.example`を`.env.local`へコピーし、秘密値を設定します。
2. `npm run db:migrate:local` でD1 migrationを適用します。
3. `npm run db:seed:local` で開発データを投入します。
4. `npm run dev` で起動します。

プレビュー用Member Passwordは環境変数未設定時のみ `www-preview-2026` です。本番では必ず `MEMBER_PASSWORD_HASH`（SHA-256 hex）とランダムな `MEMBER_SESSION_SECRET` を設定してください。Adminは本番でCloudflare Accessを設定し、`cf-access-authenticated-user-email` と `admin_users` のRoleをサーバー側で検証します。

## Data ownership

- 月額契約・月額決済: 会費ペイ
- 会員運営状態、Events、Applications、イベント入金、Contents、掲載状態: WWW Core D1
- 画像・音声: R2（D1にはmetadataのみ）

## Quality commands

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

重要レコードは削除APIでも`deleted_at`を更新するSoft Deleteです。入金、会員状態、イベント、コンテンツ等の変更は`audit_logs`へ同一D1 batchで記録します。
