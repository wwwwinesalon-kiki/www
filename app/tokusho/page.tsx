import LegalPage from '@/components/legal-page';
export default function Tokusho() {
  return (
    <LegalPage eyebrow="LEGAL NOTICE" title="特定商取引法に基づく表記">
      <dl className="legal-dl">
        <div>
          <dt>販売・運営</dt>
          <dd>Wine Work Women</dd>
        </div>
        <div>
          <dt>運営責任者・所在地・電話番号</dt>
          <dd>請求があった場合、遅滞なく開示します。</dd>
        </div>
        <div>
          <dt>問い合わせ先</dt>
          <dd>harusanx@gmail.com</dd>
        </div>
        <div>
          <dt>販売価格</dt>
          <dd>
            会費ペイの申込画面および各イベントページに税込価格を表示します。
          </dd>
        </div>
        <div>
          <dt>支払方法・時期</dt>
          <dd>会費ペイが提供する決済方法・決済日に従います。</dd>
        </div>
        <div>
          <dt>提供時期</dt>
          <dd>会員資格は決済確認後、イベントは記載の開催日に提供します。</dd>
        </div>
        <div>
          <dt>キャンセル・返金</dt>
          <dd>
            申込画面または各イベントに記載する条件に従います。提供済みの会員サービスは原則として返金対象外です。
          </dd>
        </div>
      </dl>
      <p className="legal-note">
        正式公開前に、運営者の法定表示情報と実際の返金条件へ更新してください。
      </p>
    </LegalPage>
  );
}
