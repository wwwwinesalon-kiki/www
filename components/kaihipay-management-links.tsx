import { KAIHIPAY_ADMIN_URL } from '@/lib/membership-policy';
import '@/app/kaihipay-management.css';

export default function KaihipayManagementLinks() {
  return (
    <aside className="kaihipay-management" aria-label="イベントと会員の管理先">
      <dl>
        <div><dt>この管理画面</dt><dd>イベント作成・公開・予約受付</dd></div>
        <div><dt>会費ペイ</dt><dd>会員情報・月会費・イベント参加費の請求</dd></div>
      </dl>
      <a href={KAIHIPAY_ADMIN_URL} target="_blank" rel="noopener noreferrer">
        会員・請求を管理 <span aria-hidden="true">↗</span>
      </a>
    </aside>
  );
}
