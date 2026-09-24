# 会費ペイ自動開通 2026-09-24

## 実装

- 申込は会費ペイの公開フォーム 支払総額は月3,410円 イベントは別料金
- GET `/courses` から `www月額費用` 月次 継続課金3,300円の一意なコースを確定 不一致は同期停止
- GET `/orders` の確定済かつ入金済の請求詳細から対象コースの利用対象月を読む
- イベント 単発課金 システム利用料 別コース 未入金は閲覧資格に含めない
- 対象月の日本時間1日00:00から翌月1日00:00までだけ資格を付ける
- 新しい支払済会員は会費ペイの登録メールへSupabase招待メールを一度だけ送る
- 自作サイトのイベント申込は有効な会員だけ 定員計算はDB内の行ロックで確定
- 既存メールに重なる場合は確認待ちにし 自動で既存アカウントへ結び付けない
- 取消 返金や支払状態の変更は次回同期で反映する
- APIエラー時は既存資格を書き換えず 期限到達時に閲覧を止める
- 同期口はBearer `CRON_SECRET` を必須とする

## 本番で必要な設定

1. Supabase SQL Editorで `WWW-03-自動開通の準備.sql` 実行済
2. `WWW-04-支払月の閲覧制限.sql` と `WWW-04B-会員限定イベント申込.sql` をこの順に実行
3. Vercel www Productionへ `KAIHIPAY_API_TOKEN` `SUPABASE_SERVICE_ROLE_KEY` `CRON_SECRET` `NEXT_PUBLIC_SITE_URL` を設定
4. `NEXT_PUBLIC_SITE_URL` は会員・管理画面の `https://www-plum-five.vercel.app` 公開案内サイトは `https://gray185185.studio.site`
5. コースIDは自動照合 `KAIHIPAY_MEMBERSHIP_COURSE_ID` は任意 設定すると照合に使う
6. コードを本番デプロイしたら `/admin/kaihipay` でコース確認と入金同期を一度実行し 本番ログとDBの結果を確認
7. Vercel Hobbyでは毎日03:00 UTCに再照合 早めの開通はSupabase Cron / Vault / pg_netを設定し 新URLへ更新済みの `WWW-05-5分間隔の同期.sql` を実行

資格情報はチャット Git ソースコードに貼り付けない

## 未完了の実接続検証

- 実APIトークンでのコース お客様 注文の取得
- 実請求に対する入金状態と利用対象月の照合
- Supabaseの実招待メール到達とパスワード設定
- 本番の支払い→自動開通→期限切れを通した動作確認
- APIトークンは期限付きのため失効前の更新運用

公式APIリファレンス https://api.kaihipay.jp/api/reference/
