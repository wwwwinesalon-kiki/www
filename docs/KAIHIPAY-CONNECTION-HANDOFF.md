# 会費ペイ接続手順（Neon・Netlify） 2026-11-04

## 2026-11-04 本番接続確認

- API接続成功、コース一覧・詳細で `www月額費用` / monthly / ID `643029` を確認。
- 一覧APIで継続課金額が省略されたため、詳細APIの `recurring_payment_type=fixed` と `recurring_fee=3300` を照合して補完する。支払案内総額3,410円の内訳は別途確認する。
- Productionへ確認済みID・継続課金額3,300円・新しいCRON_SECRETを登録し再デプロイ済み。
- ownerの本番「入金同期」が成功。確認対象0件・更新0件・要確認0件。実際の支払済み会員の新規開通は未検証。
- 定期実行は毎日12:00 JST、次回予定2026-11-05 12:00。NetlifyのRun nowから定期処理→バックグラウンド同期を実行し、成功ログ `Kaihipay reconciliation completed { scanned: 0, updated: 0, review: 0 }` を確認済み。
- 現行の申込URLは https://www.kaihipay.jp/forms?form_code=3006100915631325 。メール認証画面の表示を確認。旧auth_key付きURLは使用しない。

現在の本番は以下。後半の「旧Supabase・Vercel構成」は移行前の参考情報であり、新しい設定には使用しない。

- 会員サイト: https://velvety-tarsier-0c3859.netlify.app/member
- 接続確認: https://velvety-tarsier-0c3859.netlify.app/admin/kaihipay （ownerのみ）
- 本番環境変数: https://app.netlify.com/projects/velvety-tarsier-0c3859/configuration/env

## 現在必要なProduction設定

|キー|内容|
|---|---|
|`BACKEND_PROVIDER`|`neon`|
|`NEON_DATABASE_URL`|本番Neon接続文字列|
|`KAIHIPAY_API_TOKEN`|会費ペイの「設定 → API連携」で取得した有効なトークン|
|`KAIHIPAY_MEMBERSHIP_COURSE_ID`|APIのコース一覧で確認した月会費コースID|
|`KAIHIPAY_EXPECTED_RECURRING_FEE_YEN`|対象コースの一覧API項目`recuring_fee`と一致する整数金額|
|`KAIHIPAY_EMAIL_HMAC_SECRET`|メール照合用の独立した秘密値 32UTF-8バイト以上 既存値を不用意に変更しない|
|`CRON_SECRET`|定期同期の呼び出しを認証する秘密値|
|`NEXT_PUBLIC_SITE_URL`|`https://velvety-tarsier-0c3859.netlify.app`|

秘密値はNetlifyで秘密変数として保存し、再デプロイする。チャット・Gitへ記載しない。
会員への案内総額は月3,410円。APIの継続課金額が3,300円か3,410円かは推測せず、コース・請求内訳を確認する。現行照合条件はコース名`www月額費用`、`billing_type=monthly`、設定IDと金額の一致。

## 接続確認と開通

1. 「接続設定」の未設定・要確認項目を見る。この読取では外部APIへ接続せず、秘密値も表示しない。
2. 有効なAPIトークンを設定・再デプロイし「接続確認」を実行する。コースIDと継続課金額を確認し、不足設定を埋める。
3. 「接続確認」は請求・メール送信・権限変更を行わない。設定とコースの照合後に「入金同期」を実行する。照合成功だけではDB移行や実会員の開通成功まで保証しない。
4. 会費ペイの支払い済み月会費と確認済みメールを使い、実会員のログイン・記事閲覧・対象月末の期限終了を検証する。

Neon経路では会費ペイの注文・顧客APIを読み、会員番号・閲覧期限・メール照合用HMACで判定する。同期記録へ生のメールや氏名を保存せず、招待メールも自動送信しない。会員が会費ペイと同じメールで登録・確認・ログインするとAPIで再照合して開通する。

月会費の閲覧期限は対象月末。イベント・単発課金・別コース・未入金は月会費の資格に含めない。イベントの作成・予約受付は自作管理画面、参加費の請求は会費ペイ。イベント決済と予約確定の自動連動は未実装。

Netlifyの定期同期は毎日12:00（日本時間）。ログイン時にも照合する。`/api/kaihipay/webhook`は未実装で503を返すため、会費ペイの通知先へ登録しない。旧Vercelの同期が有効な場合は二重実行を避ける。

## トークン期限・ログインロック

公式API利用ガイドではトークンの期限は30日。自動更新コードを追加した。Productionの秘密変数 `KAIHIPAY_API_EMAIL` と `KAIHIPAY_API_PASSWORD` に「設定 → API連携」の認証情報を一度設定し、再デプロイ後にownerの接続確認を実行すると初回発行する。両変数が未設定の間は従来の `KAIHIPAY_API_TOKEN` を使用する。自動更新の本番初回発行は認証情報の設定待ちであり、未検証。

自動発行したトークンは既存のHMAC秘密値から用途別に導出した鍵によるAES-256-GCMで暗号化し、Neonの非公開 `www_private.kaihipay_token` へ保存する。初回利用時に表を作成するため、DB接続ロールにスキーマ作成権限が必要。API用メール・パスワードはNetlifyのみへ保存し、DBやログへ保存しない。HMAC秘密値は既存会員照合と暗号化の両方に必要なので不用意に変更しない。

日次同期・ログイン照合・接続確認で期限の3日前から更新する。DBの90秒リースで並行発行を抑止し、APIの401/403時は更新して一度だけ読取を再試行する。一時エラーは5分待って再試行し、有効な旧トークンがあれば維持する。認証情報が拒否された場合はアカウントロックを避けるため繰返し試行せず、認証情報の訂正を待つ。パスワード変更・アカウント停止・サービス側仕様変更などは手動対応が必要。「永久に必ず更新不要」という保証はしない。

管理画面がロックされた場合は再試行を止める。公式案内では一定時間後に自動解除されるが、具体的な時間は公開されていない。急ぐ場合は担当者からサポートへ解除を依頼する。保管済みの有効なトークンがあればNetlifyへの設定は進められるが、利用可否はAPI接続確認で判断する。

- API利用ガイド: https://api.kaihipay.jp/api/reference/api_usage.pdf
- ロック解除案内: https://kaihipay.zendesk.com/hc/ja/articles/360034521454

## 旧Supabase・Vercel構成（移行前の参考）

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
