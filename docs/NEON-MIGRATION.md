# Supabase → Neon 移行手順（データを残す）

この手順は **まだ本番で実行していません**。Supabase の無料枠停止を理由に既存データを削除せず、Neon の新規 PostgreSQL・Neon Auth・非公開オブジェクトストレージへ移すための準備です。WWW の公開 LP は Studio のままです。会費ペイは契約・決済の唯一の正本であり、WWW 側にカード情報や顧客台帳を複製しません。

## 移すもの / 移さないもの

| 対象 | 方法 |
| --- | --- |
| `profiles`、`contents`、`events`、`event_applications` | 全行・全カラムを元の UUID のまま移す。削除済み・下書きも残す |
| `article_entitlements`、`article_media` | 全行を移す。旧 UUID の外部キーを保持する |
| `kaihipay_sync_events`、`kaihipay_invitation_jobs` | 処理済み・保留・要確認の全行を移す。重複通知の防止状態を失わない |
| Supabase 非公開 `www-article-images` オブジェクト | バケット全体を階層を含めて列挙する。`article_media.object_path` に紐付く全オブジェクトを非公開保存先へコピーし、両側を SHA-256 で照合する。紐付かない孤立オブジェクトが 1 件でもあれば切替を停止する |
| Supabase Auth | パスワード・ハッシュ・セッションはコピーしない。旧ユーザー UUID と確認済みメールのオフライン照合表だけ退避し、Neon Auth に新しい個別ログインを作る |

現在、会費ペイで支払い済みの会員は **0 人** と確認済み。それでも既存のオーナー・保留中ユーザー、投稿、画像はすべて保全する。旧 `profiles.status='active'` だけで閲覧権を付けない。

## 実装上の対応関係

- `profiles.id` は既存の Supabase UUID のまま維持する。新規ユーザーのみ新しい UUID を作る。
- `www_auth_links(profile_id, auth_subject, legacy_supabase_user_id, verified_at)` で Neon Auth のテキスト ID を紐付ける。メールアドレスが一致するだけでは既存オーナー・会員へ紐付けない。本人確認後に 1 対 1 で登録する。
- 新規会員は会費ペイの確認済み支払から `www_pending_claims` にメールの HMAC-SHA256 と当月の有効期間だけ記録する。Neon Auth の `emailVerified=true` をサーバーが確認した後、同じ正規化メールをサーバー秘密鍵で HMAC 化し、`www_claim_paid_membership(subject,hmac)` で原子的に紐付ける。関数は 5 分以内の会費ペイ再照合を要求する。未確認メール・古い照合・会費ペイ障害では開通しない。
- 本番サーバー専用の `KAIHIPAY_EMAIL_HMAC_SECRET`（32 バイト以上）を別途生成する。未請求の HMAC と照合するため、変更時は古い未請求行を再生成する。ブラウザや Git に入れない。既存の cron / 管理画面同期は Neon 切替時に会費ペイの注文・顧客 API で各対象会員を再確認し、未紐付け会員を HMAC 行に登録する。会員が確認済みメールでログインすると、`POST /api/member/claim` が会費ペイを再照会してから原子的に開通する。会費ペイ API が停止中なら 503 で権限を付けない。
- 現在の cron は毎日 03:00 UTC。初回ログイン時にまだ HMAC 行がない場合、確認済み会員メールに対して会費ペイの当月入金済み注文と顧客メールをその場で照合する。最大 40 会員、同じメールの探索は 5 分に 1 回、複数契約で同じメールなら自動選択しない。照合エラー時はスロットを解除し、後で再試行可能にする。Neon には探索用メール HMAC と次回可能時刻だけ残す。
- 月額総額は承認済みの **3,410 円**。旧 API 判定は `recuring_fee=3300` のコースを探していたが、その値と総額の差の内訳はまだ検証できていない。Neon 開通前に会費ペイの正式なコース情報・実際の請求内訳を確認する。`KAIHIPAY_MEMBERSHIP_COURSE_ID` と API の `recuring_fee` と一致する `KAIHIPAY_EXPECTED_RECURRING_FEE_YEN` を明示設定し、API 上の ID・金額が一致する場合に限り同期・新規開通を実行する。3,410 円が `recuring_fee` なのか別途 110 円を含む総額なのかを推測して環境変数を入れない。Supabase の旧同期判定は切替まで変更しない。
- 会費ペイ API の 1 回の同期対象は現実装では最大 120 会員。超過したら同期成功と偽らずエラーにし、バッチ化とレート制限の拡張後に再実行する。
- `www_member_access(subject)` は検証済みの紐付け、会費ペイで確認した資格、`valid_from <= now() < valid_until`、確認日時が過去48時間以内（未来時刻は1分以内）が揃ったときだけ `true`。毎日03:00 UTCの同期が2回程度失敗すると、会費の対象月内でも安全側に倒して会員閲覧を停止する。同期を復旧すれば閲覧できる。`www_apply_to_member_event(subject,event_id)` は行ロックで定員を割り当てる。イベント料金は月額会費とは別。
- ブラウザから Neon DB に直接つながない。DB 接続文字列・HMAC 秘密鍵はホスティングのサーバー側のみ。SQL 関数の `subject` と `hmac` は **クライアント入力をそのまま渡さず**、サーバーで検証したセッションから生成する。
- 新規予約では会費ペイの顧客連絡先を重複保存しない。旧予約の `name`・`email` 等は移行時に保持し、新規行だけスクラブするトリガーを最終段階で取り付ける。

## 事前条件

1. 本番の Supabase プロジェクトを **読み取り可能** にする。上限で読み取り自体ができなければここで停止し、プラン・サポート・バックアップからの復旧後に再開する。データを推測して作り直さない。
2. 新規 Neon プロジェクトと Neon Auth を作り、非公開メディア保存先を用意する。新 DB は空であること。実 DB 接続文字列と秘密鍵は Git に入れない。
3. 本番 DB の実際の `public` テーブル定義・列・制約を調べ、`migrations/neon/0001_www_schema.sql` と一致することを確認する。既存 migration ファイルと本番の実態が違えば SQL を修正してから続ける。未知の列を黙って捨てない。
4. PostgreSQL の `pg_dump` と `psql` を用意する。作業用バックアップは Git リポジトリ外の暗号化ディレクトリに置く。外部へ共有しない。
5. 書き込みを一時停止する。管理画面の投稿・予約受付・会費ペイ同期 cron を止め、停止時刻を記録する。DB テーブルだけでなく画像アップロードも停止する。

## エクスポート・インポート

`export_legacy_data.ps1` は Supabase から 8 表をそれぞれ SQL に出力し、前後の件数と行フィンガープリントを照合する。加えて、パスワードを含まない `auth.users` の `id,email,email_confirmed_at` をオフライン照合表へ出す。Supabase 用 `PGHOST`・`PGPORT`・`PGDATABASE`・`PGUSER`・`PGPASSWORD`・`PGSSLMODE=require` を **画面に表示せず** 設定してから実行する。

```powershell
./migrations/neon/export_legacy_data.ps1 -OutputDirectory 'D:\encrypted-www-backup\migration-2026-xx-xx'
```

次に、接続設定を **新しい Neon DB** に入れ替える。`import_legacy_data.ps1` は Neon ホスト名を明示確認し、空 DB に schema → 8 表の順で取り込む。8 表の投入は 1 トランザクションで行われ、失敗時は差分投入を残さない。成功してもサイトは開通しない。

```powershell
./migrations/neon/import_legacy_data.ps1 `
  -InputDirectory 'D:\encrypted-www-backup\migration-2026-xx-xx' `
  -ExpectedTargetHost 'ep-xxxx.region.aws.neon.tech'
```

スクリプトは既存バックアップの上書きや Supabase DB への誤インポートを拒否する。ダンプやオフライン照合表には個人情報が含まれる。必要以上に保管せず、移行・復旧確認後の削除は所有者の明示判断で行う。

## 画像とログイン ID

1. `article_media` の全 `object_path` を Supabase の非公開バケットから新しい非公開バケットへコピーする。`MIGRATION_SUPABASE_URL` は元プロジェクトの URL に限定され、`SUPABASE_SERVICE_ROLE_KEY`・`NEON_DATABASE_URL`・`AWS_ENDPOINT_URL_S3`・`AWS_REGION`・`AWS_ACCESS_KEY_ID`・`AWS_SECRET_ACCESS_KEY`、必要なら `NEON_ARTICLE_BUCKET` を Git 管理外の `.env.migration` に設定する。まず `node --env-file=.env.migration scripts/migrate-private-images.mjs` で dry-run。内容を確認した後、`NEON_MEDIA_MIGRATION_APPROVED=1` を環境に設定し、`node --env-file=.env.migration scripts/migrate-private-images.mjs --apply` を実行する。元の Supabase オブジェクトは削除されない。
   スクリプトは [Supabase Storage の cursor ページング](https://supabase.com/docs/reference/javascript/file-buckets-listv2) でバケット内の階層下まで全オブジェクトを列挙し、取込済み `article_media` のキー集合と完全一致させる。孤立オブジェクト・メタデータだけの画像・列挙エラー・ページング異常はすべて停止する。レポートには件数とキー集合の SHA-256 のみを出し、ファイル名や内容は表示しない。孤立オブジェクトが見つかったら旧バケットを維持し、個別の由来・公開可否を確認してメタデータとコピー対象を整備する。**削除や推測による紐付けを行わない。** 再度 dry-run から実行する。
   オペレーターが元プロジェクト内で孤立キーを調べる場合は、認証済みの Supabase SQL Editor で次の**読み取り専用**クエリを使用できる。結果のキー名に個人情報が含まれる可能性があるため共有ログには貼らない。

   ```sql
   select o.name
   from storage.objects o
   left join public.article_media m on m.object_path = o.name
   where o.bucket_id = 'www-article-images' and m.id is null
   order by o.name;
   ```
2. 1 オブジェクトずつ元と新保存先のバイト列を SHA-256 で照合する。サイズ・ハッシュ不一致はその画像を未移行とする。コピー済みのファイルでもハッシュを再確認し、異なれば上書きしない。
3. 一致した行だけ `www_media_migration_status(media_id,target_object_key,sha256,verified_at)` に登録する。`--apply` は古い在庫確認記録を先に無効化し、コピー後に元バケットを再列挙してキー集合が変わっていないことまで確認した場合のみ `www_media_inventory_checkpoint` を記録する。公開前は `/api/media/:id` が画像ごとの検証行を確認し、行がなければ 404/403 で閉じる。
4. 新しいオーナーログインは Neon Auth で個別に作成し、確認済みの本人 ID を `www_auth_links` に手動で結び付ける。旧 Supabase のパスワードは流用しない。既存の保留中ユーザーも本人確認前には結び付けない。**メール一致だけで owner 権限を付けない。**
5. 会費ペイ支払後の新会員は上記 HMAC 請求フローで個別ログインを開通する。パスワードやログイン URL を共用しない。

## 開通判定

Supabase で `source_fingerprints.sql` を再実行し、書き込み停止時に採った 8 件の値と一致することを確認する。Neon 側でも次を確認する。

```sql
select * from public.www_migration_fingerprints();
select count(*) from public.article_media m
left join public.www_media_migration_status s on s.media_id=m.id
where s.media_id is null;
select source_bucket,source_object_count,source_keys_sha256,verified_at
from public.www_media_inventory_checkpoint;
select * from public.www_migration_control;
```

件数・全行フィンガープリント・全画像 SHA-256・**元バケット全体の在庫確認記録**が一致した場合だけ `migrations/neon/0002_activate.sql` を実行する。この SQL 自体も同じ 8 件、画像の検証記録、在庫数と取込済みキー集合の照合を再確認し、1 件でも欠ければロールバックしてサイトを閉じたままにする。移行開始前から切替完了まで元バケットへの書き込み停止を維持する。実行後、旧 Supabase を削除せず、Netlify の隔離されたプレビューでオーナーログイン・会員制限・記事・画像・予約・会費ペイ反映を確認し、本番を切り替える。

切替後に問題が出た場合は旧 Vercel デプロイへ戻せるよう保持する。ただし新 DB 上で受付けた投稿・予約・決済同期は旧 Supabase へ自動逆流しない。**書き込み後のロールバックは差分を照合してから** 行う。安易に Supabase データを削除・上書きしない。

## 検証と未完了事項

`npm test -- --run tests/neon-migration.test.ts` は空 DB、移行前閉鎖、行差分・画像欠落での開通拒否、旧予約連絡先の保持、新規予約の最小化、会員期間、二重請求防止、古い会費ペイ通知拒否を PGlite で検証する。ただし PGlite 合格は本番 Neon・Neon Auth・会費ペイ・画像保存先・Netlify の統合確認の代わりにはならない。

本番への切替に必要なものは、Supabase の読み取り接続、Neon プロジェクトとサーバー専用接続、Neon Auth 設定、非公開ストレージ、確認済みオーナー ID、会費ペイ API のサーバー設定、Netlify の新規サイトへのアクセスである。これらが揃うまでは Supabase 依存の本番経路を消さない。

## 商用利用できる無料ホストへの移行

会費を伴うサイトは Vercel Hobby の非商用条件に合わないため、次の公開先は Netlify Free とする。GitHub の WWW リポジトリを Netlify の新規サイトへ接続し、Next.js として `npm run build` を実行する。Netlify の `.netlify.app` URL が決まるまでは Studio の公開 LP と旧 Vercel 会員画面の導線を変更しない。Netlify Free は商用利用可能だが、月の無料クレジットを使い切るとサイトが停止するため、利用量を監視する。課金しない運用でも無停止を保証するものではない。

Netlify の Production 環境だけに `.env.example` の Neon・会費ペイ用設定を登録する。`NEXT_PUBLIC_SITE_URL` は **Studio LP ではなく会員/管理サイトの Netlify URL** とし、Neon Auth の trusted origin / allowed callback に同じ URL を登録する。プレビューに本番 DB・秘密鍵を渡さない。`BACKEND_PROVIDER=neon` は 8 表・全画像・オーナーリンクの照合とプレビュー動作確認を終えるまで設定しない。

`vercel.json` の毎日 03:00 UTC 同期は Netlify では使われない。代わりに `netlify/functions/kaihipay-schedule.ts` が同時刻に `kaihipay-background.ts` を呼び、後者が Neon の同期本体を直接実行する。通常の Next API を経由しないので、その同期は通常関数の60秒制限を受けない。Netlify の Scheduled Function は30秒上限、Background Function は15分上限。1人の照合失敗があっても残りを処理し、部分失敗を例外としてNetlifyの再試行と実行ログへ通知する。実会員数と API 応答時間で本番検証し、15分を超える前に同期を分割する。切替時は **旧 Vercel cron を停止** し、二重実行を避ける。

Neon でメール認証が有効であることをテストユーザーで確認し、確認済みオーナーの Auth subject と旧 owner profile を `www_auth_links` へ本人確認のうえ結び付ける。会費ペイの総額 3,410 円と API が返す継続課金額を公式画面で照合し、実コース ID と金額を `KAIHIPAY_MEMBERSHIP_COURSE_ID` / `KAIHIPAY_EXPECTED_RECURRING_FEE_YEN` に設定する。推測値を入れると自動開通の安全確認にならない。最後に Studio・公式 LINE からの会員リンクを新しい Netlify URL へ切り替え、ログイン、限定記事、画像、イベント、管理画面、決済同期を実地確認する。
