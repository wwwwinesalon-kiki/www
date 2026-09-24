# WWW 最小構成 実装・引き継ぎ資料

確認日: 2026-09-12 / 作業ブランチ: `feat/minimal-member-publishing`

**レビュー用実装です 本番DB適用・mainへのマージ・本番公開・Studio公開・外部メッセージ送信は実施していません**

完成条件のうち「運営が原稿と画像を貼り付けて公開し 資格のある会員が読む」は分離環境で確認しました。「会費ペイの実入会から自動開通」は利用契約・コース・資格ルール・Webhook認証の確認待ちです。連携済みとは扱わないでください。

## 1. 実装したこととコード構成

既存 Next.js 16 / React 19 / TypeScript / Supabase Auth・PostgreSQL を改修しました。別の認証基盤・会員管理・決済システムは作っていません。

```text
Studio 紹介ページ → LINE
  ├ 会員登録 → 実際の会費ペイ申込URL［未確認］
  └ 会員サイト → Next.js /member
                    ├ Supabase Auth 本人確認・ログイン
                    ├ article_entitlements 閲覧資格を別判定
                    ├ contents 既存記事 + HTML書式
                    └ /api/media/:id → 資格・記事公開状態 → private Storage

運営 /admin → 原稿貼付・画像・下書き・プレビュー・公開・取り下げ

会費ペイ →［本番アダプター未接続］→ 永続通知・最新情報照合・資格更新
```

| 領域 | 主なファイル | 仕様 |
|---|---|---|
| 会員記事 | `app/member/[[...path]]/page.tsx`, `lib/data.ts` | 新着順・画像・タイトル・カテゴリ・空状態・本文・戻るリンク |
| ログイン | `components/member-login-form.tsx`, `app/member/auth/route.ts` | 既存メール/パスワード認証・再設定・確認リンク処理・安全なnext |
| 初回設定 | `app/member/setup/page.tsx`, `components/password-setup.tsx` | 認証済みセッションで12文字以上のパスワード設定 |
| 資格判定 | `lib/member-access.ts` | リクエスト内で認証/資格/編集権限を取得・共有 キャッシュを利用者間で共有しない |
| 記事管理 | `components/article-admin.tsx` | 既存contentsを編集 新規/保存/プレビュー/公開/取り下げ |
| 書式と検証 | `lib/article.ts`, `lib/article-write.ts` | サーバーでもHTML洗浄・画像参照検証・楽観的更新競合検出 |
| プレビュー | `app/admin/preview/[id]/page.tsx` | owner/editorのみ viewer・一般会員は下書き不可 |
| 画像 | `app/api/admin/media/route.ts`, `app/api/media/[id]/route.ts`, `lib/image-upload.ts` | JPEG/PNG/WebP 最大3MiB・署名検査・代替テキスト・認証付き配信 |
| 最小連携 | `lib/integrations.ts`, `lib/kaihipay-store.ts` | アダプター契約・永続通知・再処理・バッチ照合・招待重複抑止 |
| DB | `supabase/migrations/20260912000000_minimal_publishing.sql` | 既存記事拡張・資格/画像/通知/招待の最小テーブル・RLS |
| 見た目 | `app/articles.css` | 生成り・ワイン色・明朝・スマホの表/画像/長文 既存演出は保持 |

### URLとアクセス

| パス | 用途 |
|---|---|
| `/member/login` | ログイン 独立した新規会員登録フォームは撤去 |
| `/member/reset` | 再設定メール要求 存在するメールかどうかを表示しない |
| `/member/auth` | PKCE codeまたはinvite/recovery token_hashをSupabaseで確認 |
| `/member/setup` | 初回/再設定用パスワード入力 |
| `/member` | 公開済み会員記事一覧 |
| `/member/table`, `/member/field`, `/member/people` | カテゴリ絞り込み 既存カテゴリも保持 |
| `/member/{category}/{slug}` | 記事詳細 |
| `/member/account` | 会費3,300円・契約確認/LINE/再設定案内 状態操作UIなし |
| `/admin` | 記事運用 |
| `/admin/contents/new`, `/admin/contents/{id}` | 新規作成/編集 |
| `/admin/preview/{id}` | 編集者専用プレビュー |
| `/admin/events`, `/admin/applications` | 既存受付を維持するため従来機能を保持 |
| `/api/member/articles` | 未認証401 資格なし403 公開記事のみ |
| `/api/media/{id}` | 読めない画像は404 成功もprivate/no-store |
| `/api/kaihipay/webhook` | 未接続を明示して503 推測した署名方式は実装しない |

### 権限と画像の重要事項

- Supabase Auth成功と有料閲覧資格は別です。`profiles.status=active`だけでは開放しません。
- `article_entitlements`の紐付け・確認日時・許可・有効期限で判定します。資格の更新はservice_roleのみです。
- 一般会員による編集・権限RPC・資格更新をAPI/DB双方で拒否します。従来の管理権限構成は保持し新しい権限管理UIは追加していません。
- 未公開本文はデータ取得箇所とRLSで制限します。ページレイアウトだけに依存していません。会員/管理/APIにno-storeを設定します。
- 画像は専用private bucket。利用者がStorageの恒久公開URL/長期署名URLを発行できるSELECTポリシーは追加しません。配信サーバーだけがRLS確認後に取得します。
- 公開済み記事への新しい画像アップロードも本文またはメイン画像に保存するまでは一般会員へ公開しません。
- 既存の公開写真・Vercel画像URLは削除/移動していません。既に外部へ公開された画像を後から秘密にできるわけではありません。
- 公開取り下げは以後の取得を止めます。既に利用者が保存・撮影・表示済みの内容を回収する機能ではありません。

### 運営の操作手順

1. 編集権限のある既存アカウントで `/member/login?next=/admin` にログインします。
2. 「新しい記事」でタイトル・カテゴリを入力し 本文に完成原稿を貼り付けます。
3. 見出し/太字/箇条書き/番号/リンクを整えます HTMLを書く必要はありません。表は貼り付け可能です。外部埋め込み・スクリプト・外部画像は除外されます。
4. 画像の説明を入力し JPEG/PNG/WebPをアップロードします 「画像を入れる場所」でメイン画像/本文末尾を選べます。
5. 「保存済み画像を選ぶ」で同じ記事の画像を選択・差し替えできます メイン画像の説明も編集できます。本文画像の説明を変えるときは正しい説明で再アップロードして差し替えます。
6. 「下書き保存」→「プレビュー」で確認→「公開する」で公開します 保存前の変更があるとプレビューリンクは表示しません。
7. 公開停止は「公開を取り下げて保存」です。編集だけでは保存されません。
8. エラー時は原稿を画面に保持します。タブを閉じず再試行してください 別画面で更新された409の場合は原稿をコピーしてから再読込してください。通信断で保存結果だけ受信できない場合は別タブの記事一覧で保存済みか確認し 重複作成を避けます。
9. 未保存でリンク移動/画面を閉じると警告します。ただしブラウザー強制終了や端末故障からの復元保証・自動保存機能ではありません。
10. 画像保存と記事保存は別です。画像だけ成功した場合も自動削除せず保持します メタデータ登録失敗時は表示された保存先IDを管理者へ伝えます。未参照画像の整理は確認後の別作業です。

## 2. 整理・非表示にした機能

- 会員画面の音声掲載/プレイヤーなどの未接続UI
- 記事管理の音声URL入力・独自会員状態/権限操作・請求/入金管理・仮の数値分析・制作/配信系メニュー
- WWWでの独立したsignUpフォーム 未接続のKaihipay APIパス/秘密鍵設定
- 会員/管理画面の不要なアクセス分析送信

既存音声列・記事・会員・イベント・申込・公開用画像は保持しています。既存イベント/申込UIと関連APIは移行先未検証のため残しています。旧コンポーネント内部の未使用コードはデータ破壊を避けるため全面削除していません。

## 3. 検証と限界

- `npm run typecheck`: 合格
- `npm test`: 41件合格 記事洗浄/検証・実PostgreSQL RLS・同期/招待・既存テスト
- `npm run lint`: エラー0 非推奨APIとセマンティクスの警告あり contentEditable/execCommandの最小編集方式と既存イベントUIについて記録
- `npm run build`: 合格 テスト用環境変数で実施
- `npm run test:e2e`: Chromeで3件合格 以下の複合シナリオを実施

| 要求ケース | 検証 |
|---|---|
| 1 原稿/画像/下書き | ブラウザで書式付き貼付・画像アップロード・下書き保存 |
| 2 プレビュー/公開/会員閲覧 | editorのプレビューとentitled memberの本文/画像表示 |
| 3 取り下げ | 一覧・詳細・API・画像の以後の取得を拒否 |
| 4 未ログイン | HTML/API/画像・直接SQLの制限 |
| 5 資格なし | ログイン後の案内表示 API403 画像404 直接SQL不可 |
| 6 一般会員の変更 | 記事API/権限変更API拒否 DB資格更新・権限RPC拒否 |
| 7 初回/再設定 | UIとcallback→設定→会員画面 実Supabaseメール配送・期限・新パスワード再認証は未検証 |
| 8 next | 外部URLや内部経路逸脱の拒否 管理画面への安全な復帰 |
| 9 スマホ | 390px幅で表/画像/長文 横はみ出しなし |
| 10 保存失敗 | HTTP500でも原稿保持 離脱確認キャンセルで画面維持 |
| 11 同期 | 模擬アダプターで重複・障害・永続再処理契約 DBで古い確認結果の巻戻し防止 |
| 12 既存会員 | 紐付け済み再利用 メール一致のみは要確認 招待の結果不明時は再送しない |

`tests/support/review-server.mjs` はloopback限定の検証サーバーです。Auth/StorageのHTTPを模擬し データ操作はPGlite内のPostgreSQL/RLSで実行します。Supabase本体のAuth・Storage・PostgREST・本番Vercel CDNの完全な代替ではありません。実SMTP配送やKaihipay入金を成功したと扱わないでください。テスト用データは本番へ投入していません。

未ログイン/資格なし利用者のRSC本文非漏洩も検証します。Next.jsのdevモードはCache-Controlをno-cacheに上書きするため no-storeの最終検証は下記の本番ビルド起動で行います。

```powershell
$env:NEXT_PUBLIC_SITE_URL='http://127.0.0.1:3100'
$env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54329'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='test-public-only'
$env:SUPABASE_SERVICE_ROLE_KEY='test-service-only'
npm run build
$env:WWW_REVIEW_PRODUCTION='1'
npm run dev:review
# このサーバーを起動したまま 別ターミナルで以下を実行
$env:WWW_REVIEW_PRODUCTION='1'
npm run test:e2e
```

これは本番向けコードをローカルで検証する手順であり Vercelへ公開する手順ではありません。実環境のビルド時にはその環境の正しい設定へ戻してください。

WindowsでPlaywrightが自動起動したサーバーの終了待ちが残る挙動を確認したため 上記では検証サーバーを別ターミナルで起動・再利用しています。テスト後はサーバーをCtrl+Cで終了してください。通常devのE2Eではdev固有のno-cache 本番ビルドのE2Eではno-storeを検査し 本文非漏洩の条件は共通です。

再実行: `npm ci --cache .cache/npm` → `npm run typecheck` → `npm test` → `npm run test:e2e`。Chromeが必要です。E2Eは3100/54329を使い専用サーバーを起動します。`npm run dev:review`で手動確認も可能です。実サービスの資格情報を使わないでください。

ローカル専用アカウント: `editor@review.invalid` / `member@review.invalid` / `pending@review.invalid` / `viewer@review.invalid` 共通パスワード `TestPassword123!`。これらは模擬Auth専用で本番ログインには使えません。

## 4. 会費ペイの確認済み事項と未確認事項

参照: [公式APIリファレンス](https://api.kaihipay.jp/api/reference/) / [公式API利用ガイド](https://api.kaihipay.jp/api/reference/api_usage.pdf) 第1.2.4版。

公開資料ではBearer認証・JSON・会員/契約コース/請求取得・通知の種類を確認しました。会員取得は `/v1/customers/{customer_number}` などです。トークンの期限は30日で更新が必要です。支払方法登録と入金完了は別通知です。単発請求APIの存在は確認しましたがイベント受付要件をすべて満たす根拠にはしていません。

未確認: WWWの実申込URL・対象course_id・API契約/権限・実際のトークン運用・入金確認による利用開始条件・退会効力日・未払い/同期障害時の資格期限・Webhook認証/再送/イベント識別・テスト手順。公開資料の頻度制限記載には解釈確認が必要なため本番照合間隔は未設定です。推測したHMACや7日猶予は使っていません。

`processNotice` は認証済み通知を永続化し 最新状態を再取得して適用します。`replayPending` は未処理を再実行し `reconcileBatch` は紐付け済み会員を順次照合します。本番アダプター・cron・自動招待の接続は無効のままです。`inviteOnce` は結果不明の招待をreviewへ止め Auth側照合後に運営が復旧する設計です。

障害時は資格情報を一律に変更しません。ただし検証済み期限が切れた資格は拒否します。期限値/更新間隔は事業上の猶予と同一ではなく 確認済み利用条件から決める必要があります。テストの1日という値は本番ルールではありません。

イベント: 単発決済以外に イベント別申込・定員/終了・一覧/出力・キャンセル/返金・会員価格/限定受付を確認してください。確認まで従来の受付/申込データを維持します。

## 5. 環境変数・外部設定・DB移行

| 設定 | 内容 |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | 確認対象デプロイの正しいorigin callback/CSRF比較に使用 |
| `NEXT_PUBLIC_SUPABASE_URL` | 同じ環境のSupabaseプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | そのプロジェクトの公開用キー |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー限定の画像取得キー NEXT_PUBLICを付けない |
| `LINE_JOIN_URL` | 公式LINE 実値は`.env.example`参照 |
| Kaihipay接続設定 | 認証/ルール確定後に定義 今回は架空の環境変数を設けない |

Supabase: 独立signUpを無効化し verified invitationを利用する設定・本人確認・Site URL/Redirect allowlist・SMTP送信元/送信制限・invite/recoveryメールテンプレートを分離環境で確認します。テンプレートはSupabase公式の確認リンクから `/member/auth` へ適切なcodeまたはtoken_hash/typeを渡す構成とし rawパスワードを送信しません。既存ユーザーと運営ロールは保持してください。

### 本番適用前の必須手順

1. 本番のschema/migrations/RLS/Storageポリシーを別途read-onlyで棚卸しし バックアップと復元確認をします ローカルの旧migrationと同じとは決めつけません。
2. contentsカテゴリが新checkに適合するか 同名テーブル/列・bucket `www-article-images` が既存でないかを確認します 競合時に自動上書きしません。
3. 特にstorage.objectsの既存SELECTポリシーに全bucketを許可するものがないか確認します RLSポリシーはOR合成されるため この追加migrationだけで既存の広い許可を打ち消せません。
4. 本番とは別のSupabaseにmigrationを順番に適用し 実Auth/メール/Storageで全導線を検証します PGlite合格のみで本番適用しません。
5. 既存会員の移行リストを作成します Supabase user UUIDと会費ペイ会員番号それぞれの本人性を確認し 対象コース・資格・確認日時・期限を証跡付きで確定します メール一致だけの自動結合/同名での結合は禁止です。
6. service-onlyの管理手順で一意な紐付けを登録します 既存ユーザーは再利用し 招待の重複がないことを照合します 名前/メールを利用者へ再入力させる新規登録フォームは作りません。証跡の保管は既存の運営手順で行いWWWに顧客情報を大量複製しません。
7. このmigrationは既存active会員を自動で有効化しません 紐付け移行が未完了のまま本番適用すると既存会員も記事を読めなくなります。ロールバック計画・認証リンク・資格データ・アプリを一組でレビューし公開承認を得ます。

### 変更の影響と戻し方

- 新migrationはトランザクションです 途中失敗は全体をrollbackします 既存行の削除/音声列削除/公開画像移動はありません。
- contentsにbody_format/cover_alt追加 認証済み読取ポリシー変更 権限更新RPCの一般実行取消 4テーブルとprivate bucket/関数追加があります。
- 成功後に問題が起きたら新規編集・同期の運用を止め DB/Storageを保全し承認済みアプリ版へ戻します。新列・テーブル・画像をDROPしないでください。
- 旧アプリはHTML書式や新資格に未対応です 単にアプリを戻すだけで完全互換とはなりません。新HTML記事は保全し既存版との表示検証後に切り替えます。
- 旧い「ログインできれば会員本文が読める」RLSへ無条件に戻すのは不可です。安全な一時案内画面を用い 資格制限を保持したまま修正/再展開します。schema全体の復元はバックアップ以降の投稿/招待を失うため対象差分と追加データを保全し別途承認を受けて実施します。

## 6. LINEリッチメニュー用リンク

| 配置 | 表示名 | URL |
|---|---|---|
| LINE | 会員登録 | **未設定 実際の会費ペイ申込URLを確認してから設定** |
| LINE | 会員サイト | https://www-plum-five.vercel.app/member |
| Studio | 会員ログイン | https://www-plum-five.vercel.app/member/login |
| Studio | 公式LINE | https://lin.ee/xWYPyBv |
| 運営専用 | 記事管理 | https://www-plum-five.vercel.app/admin |

公開案内サイトは https://gray185185.studio.site/ です。会員・管理画面は上記Vercel URLを使用します。Studio/LINEのリンク設定変更・メッセージ送信は実施していません。

## 7. 残作業と理由

1. Kaihipay実利用条件/認証/コース/申込URL確認 → 実アダプター・招待・定期照合の接続 仕様不明で推測しないため。
2. 実Supabase Auth/SMTP/Storageで初回確認・期限切れ・再設定後の新パスワード認証・長期セッション・本番相当キャッシュ/RSCの再検証 模擬HTTPでは保証できないため。
3. 本番schema/Storage権限と既存会員の本人確認付き移行 本番のデータ保護と継続利用のため。
4. 本番公開前の依存関係脆弱性対応 `npm audit --omit=dev` で既存react-server-dom-webpackのDoSおよびundici等の警告を確認しました この変更で無関係な依存ツリー全体更新はしていません。本番導入前に修正版/互換性を検証してください。
5. 画像説明変更UIはメイン画像編集または本文画像再アップロードの最小方式 本文中の画像を細かくドラッグする制作システムは対象外です。
6. アプリ・DB・外部設定のレビュー後に別途公開承認 今回は禁止範囲のためmain/本番には反映しません。

## 8. 差分・確認方法

ベース `ff1f726` ブランチ `feat/minimal-member-publishing`。最終コミットは納品報告または `git log -1 --oneline` で確認できます。

`git diff ff1f726..HEAD --stat` と対象ファイルをレビューしてください。エラー修正の7項目ログは [IMPLEMENTATION-ERROR-LOG.md](IMPLEMENTATION-ERROR-LOG.md) に記録しています。

新規テスト基盤はdevDependenciesとtests内のみです。実装中にNext.jsが生成したAGENTS.md/CLAUDE.mdも含めています。秘密鍵・本番パスワード・実顧客データ・ブラウザセッション・テスト生成物はコミット対象に含めません。
