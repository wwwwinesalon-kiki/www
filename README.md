# WWW / Wine Welcome World

既存Next.js / React / TypeScript / Supabase構成を利用した 会員向けの記事閲覧と完成原稿の投稿システムです。認証は個別のSupabase Authアカウントです。共通パスワード方式やD1/R2の旧構成は現在の実装手順ではありません。

仕様・コード構成・操作手順・検証の限界・DB移行/戻し方・LINEリンクは [引き継ぎ資料](docs/MINIMAL-WWW-HANDOFF.md) を参照してください。今回のブランチはレビュー用で本番未適用です。Kaihipay実接続は確認事項が揃うまで無効です。

## Local setup

1. Node.js 22.13以上とChromeを用意し `npm ci --cache .cache/npm` を実行します。
2. 本番から分離した確認には `npm run dev:review` を使います 3100/54329番ポートを使う模擬Auth/Storage + PostgreSQL RLS環境です。
3. 実Supabaseで検証する場合は 別プロジェクトにmigrationを適用し `.env.example` の設定と実Auth/メール/Storageを確認します。
4. 実開発環境は `npm run dev` です。既存会員の検証済み紐付け移行なしに本番DBへ新migrationを適用しないでください。

本番用のキーやパスワードはコミットしません。テスト用資格情報はローカル模擬環境専用で 本番アカウントではありません。

## Data ownership

- 月額契約・月額決済: 会費ペイ
- 本人確認・ログイン: Supabase Auth
- 記事・最小限の閲覧資格/連携記録・既存Events/Applications: Supabase PostgreSQL
- 新規会員記事画像: Supabase private Storage
- 公開紹介ページ: Studio 既存のVercel公開ページ/画像は保持

## Quality commands

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e`

本番ビルドの分離ブラウザ検証ではビルド時にloopbackのテスト環境変数を指定し `WWW_REVIEW_PRODUCTION=1` でE2Eを実行します。詳細は引き継ぎ資料を参照してください。mainへのマージ/本番DB適用/公開は別途承認が必要です。
