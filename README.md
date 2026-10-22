# WWW / Wine Welcome World

Next.js / React / TypeScript 製の会員サイトと管理画面です。公開 LP は Studio を維持します。旧 Supabase が削除済みの場合は、Neon PostgreSQL / Neon Auth / 非公開ストレージを使う [新規構築手順](docs/FRESH-START.md) を参照してください。旧 DB と Storage のバックアップがある場合だけ [データ移行手順](docs/NEON-MIGRATION.md) を選びます。

今回の Neon / Netlify 作業ブランチは本番未適用です。会費ペイとの実接続と自動開通は、実コース ID・金額と本番環境変数を照合するまで有効にしません。

## Local setup

1. Node.js 22.13以上とChromeを用意し `npm ci --cache .cache/npm` を実行します。
2. 本番から分離した確認には `npm run dev:review` を使います 3100/54329番ポートを使う模擬Auth/Storage + PostgreSQL RLS環境です。
3. 新規 Neon の確認には、空の検証用 DB に `migrations/neon/0001_www_schema.sql` と `migrations/neon/0002_fresh_start.sql` を順に適用し、`.env.example` の Neon / Auth / Storage 設定を使います。
4. 実開発環境は `npm run dev` です。本番 DB への適用前に必ず [新規構築手順](docs/FRESH-START.md) を確認してください。

本番用のキーやパスワードはコミットしません。テスト用資格情報はローカル模擬環境専用で 本番アカウントではありません。

## Data ownership

- 月額契約・月額決済: 会費ペイ
- 本人確認・ログイン: 新規構築では Neon Auth
- 記事・最小限の閲覧資格/連携記録・Events/Applications: 新規構築では Neon PostgreSQL
- 会員記事画像: 新規構築では非公開 S3 互換ストレージ
- 公開紹介ページ: Studio。既存の公開画像・アプリコードは保持

## Quality commands

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e`

本番ビルドの分離ブラウザ検証ではビルド時に loopback のテスト環境変数を指定し `WWW_REVIEW_PRODUCTION=1` で E2E を実行します。main への反映と本番公開は、新規 DB・Auth・Storage・ホストに接続して実地検証した後に行います。
