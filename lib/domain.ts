export const MEMBER_STATUSES = [
  'candidate',
  'invited',
  'active',
  'pause',
  'churned',
] as const;
export const APPLICATION_STATUSES = [
  'pending',
  'approved',
  'waitlist',
  'cancelled',
  'attended',
  'no_show',
] as const;
export const PAYMENT_STATUSES = [
  'unpaid',
  'paid',
  'refunded',
  'waived',
] as const;
export const CONTENT_TYPES = [
  'PEOPLE',
  'FIELD',
  'TABLE',
  'NEWS',
  'EVENT_REPORT',
  'GUIDE',
  'FAQ',
  'FEATURE',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type Visibility = {
  publishStatus: 'draft' | 'published' | 'archived';
  publicVisible: boolean;
  memberVisible: boolean;
};
export function canView(v: Visibility, audience: 'public' | 'member') {
  return (
    v.publishStatus === 'published' &&
    (audience === 'public' ? v.publicVisible : v.memberVisible)
  );
}
export function nextApplicationStatus(
  capacity: number,
  approved: number,
  waitlistEnabled: boolean,
) {
  if (approved < capacity) return 'pending' as const;
  return waitlistEnabled ? ('waitlist' as const) : ('closed' as const);
}
export function togglePayment(
  current: PaymentStatus,
  now = new Date().toISOString(),
) {
  return current === 'paid'
    ? { status: 'unpaid' as const, paidAt: null }
    : { status: 'paid' as const, paidAt: now };
}
export function paymentSummary(
  rows: Array<{ amount: number; status: PaymentStatus }>,
) {
  const expected = rows
    .filter((r) => r.status !== 'waived')
    .reduce((s, r) => s + r.amount, 0);
  const collected = rows
    .filter((r) => r.status === 'paid')
    .reduce((s, r) => s + r.amount, 0);
  return {
    expected,
    collected,
    outstanding: expected - collected,
    rate: expected ? Math.round((collected / expected) * 100) : 0,
    unpaidCount: rows.filter((r) => r.status === 'unpaid').length,
  };
}
export function validateEvent(input: {
  slug: string;
  capacity: number;
  price: number;
  startAt: string;
  endAt: string;
}) {
  const errors: Record<string, string> = {};
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug))
    errors.slug = '英小文字・数字・ハイフンで入力してください';
  if (!Number.isInteger(input.capacity) || input.capacity < 1)
    errors.capacity = '定員は1以上の整数です';
  if (!Number.isInteger(input.price) || input.price < 0)
    errors.price = '価格は0以上の整数です';
  if (
    !input.startAt ||
    !input.endAt ||
    new Date(input.startAt) >= new Date(input.endAt)
  )
    errors.dates = '終了日時は開始日時より後にしてください';
  return errors;
}
