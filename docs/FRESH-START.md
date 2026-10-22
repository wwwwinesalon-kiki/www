# 旧 Supabase 削除後の新規構築

この手順は、旧 Supabase プロジェクトが削除済みで、復元可能な DB / Storage バックアップもない場合の **新規開始** 用です。旧会員プロフィール・管理画面の記事・予約・非公開画像は、この手順では復元されません。バックアップが見つかった場合は実行を止め、[移行手順](NEON-MIGRATION.md)を選び直してください。Git 管理の公開ページ・公開画像・アプリコードは残っています。

## データの正本

- 契約・請求・顧客情報: 会費ペイ。WWW の DB にカード情報や顧客台帳を複製しない
- ログイン: Neon Auth の個別アカウント。共通パスワードを発行しない
- 記事・イベント・予約・最小限の閲覧資格: 新しい Neon PostgreSQL
- 記事の非公開画像: 非公開 S3 互換ストレージ
- 公開 LP: 既存 Studio サイトを維持。会員/管理画面のみ新しいホストへ切り替える

## 開始前

1. 旧 Supabase が本当に削除済みで、バックアップもないことを確認する。残存する旧 Vercel 環境変数は復元可能なデータの証明にはならない。
2. 空の Neon PostgreSQL、Neon Auth、非公開 S3 互換ストレージ、Netlify サイトを用意する。DB・Auth・Storage・Netlify の秘密鍵はチャットや Git に貼らず、対象サービスの環境変数に設定する。
3. 会費ペイで現在の会員・支払状態と、総額 **3,410 円** の実コース ID / API の継続課金額を確認する。金額を推測して自動開通を有効にしない。旧 DB がなくても会費ペイの契約状態は独立している。

## 空 DB の初期化

新規 DB に `migrations/neon/0001_www_schema.sql` を実行し、全テーブルが空であることを確認してから `migrations/neon/0002_fresh_start.sql` を実行する。後者は記事・プロフィール・移行記録などが 1 行でもあると拒否し、旧データの混入や誤開通を防ぐ。**旧データがある DB には使わない。**

続いてオーナー本人が Neon Auth でアカウントを作り、メール認証を完了する。Neon Auth の管理画面で確認済みメールと subject ID を照合した後に限り、DB 管理者がその subject に owner 権限を紐付ける。メールアドレスが一致するだけで権限を付けない。次は入力例であり、`<...>` を実際の検証済み値に置き換えてから新 DB の管理者 SQL 画面で実行する。

```sql
begin;
do $$
declare
  verified_subject text := '<Neon Auth の確認済み subject ID>';
  verified_email text := '<同じアカウントの確認済みメール>';
  new_profile_id uuid;
begin
  if verified_subject like '<%' or verified_email like '<%' then
    raise exception 'replace_verified_owner_values';
  end if;
  if exists (select 1 from public.www_auth_links)
    or exists (select 1 from public.profiles where role = 'owner') then
    raise exception 'owner_already_configured';
  end if;
  insert into public.profiles(email, name, role, status)
  values (verified_email, 'WWW 管理者', 'owner', 'active')
  returning id into new_profile_id;
  insert into public.www_auth_links(profile_id, auth_subject, verified_at)
  values (new_profile_id, verified_subject, now());
end;
$$;
commit;
```

この SQL は subject の本人性を自動検証しない。**Auth 管理画面での照合を省略しない。** 管理者のパスワードや確認コードを作業担当者へ渡す必要はない。

## ホスト設定と公開前検証

Netlify の Production 側で `.env.example` のうち Neon / Auth / S3 / 会費ペイ用の値を設定し、`BACKEND_PROVIDER=neon` とする。新規構築では `NEXT_PUBLIC_SUPABASE_*`・`SUPABASE_SERVICE_ROLE_KEY`・`MIGRATION_SUPABASE_URL` は不要。`NEXT_PUBLIC_SITE_URL` には Studio LP ではなく会員サイトの Netlify URL を入れ、Neon Auth の許可 origin / callback も同じ URL にする。Preview には本番の DB・秘密鍵を渡さない。

GitHub の作業ブランチを Netlify で検証する。GitHub App 接続が難しい場合は、認証済み Netlify CLI の手動デプロイでも検証できるが、継続的な更新には GitHub 連携を後で整える。会員サイトはサーバー処理が必要なので、単なる静的ファイルのアップロードでは動かない。

公開前に次を実地確認する。

1. 未ログイン・未払い・メール未認証のユーザーが限定記事や非公開画像へ入れない
2. 確認済みオーナーが管理画面で FIELD / TABLE / PEOPLE / NOMIKAI の記事とイベントを作成・公開でき、会員ページへ反映される
3. 記事画像が非公開で保存され、権限を持つユーザーにだけ表示される
4. 会費ペイの正しい実コースと支払を照合した会員だけが当月末まで閲覧でき、イベント料金は別扱いになる
5. Kaihipay 同期が Netlify で一度だけ動き、旧 Vercel cron は停止している
6. ログイン・パスワード再設定・記事・予約・管理画面をスマートフォンと PC で確認する

これらが通るまで Studio / 公式 LINE の会員リンクを切り替えない。旧 Supabase にあった投稿や画像は、バックアップが見つからない限り管理画面で再作成する。
