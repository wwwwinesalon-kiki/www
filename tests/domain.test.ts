import { describe, expect, it } from 'vitest';
import {
  canView,
  nextApplicationStatus,
  paymentSummary,
  togglePayment,
  validateEvent,
} from '../lib/domain';
describe('visibility', () => {
  it('Member ON / Public OFFは会員だけ閲覧できる', () => {
    const v = {
      publishStatus: 'published' as const,
      publicVisible: false,
      memberVisible: true,
    };
    expect(canView(v, 'member')).toBe(true);
    expect(canView(v, 'public')).toBe(false);
  });
  it('Public ON / Member OFFは公開サイトだけ閲覧できる', () => {
    const v = {
      publishStatus: 'published' as const,
      publicVisible: true,
      memberVisible: false,
    };
    expect(canView(v, 'public')).toBe(true);
    expect(canView(v, 'member')).toBe(false);
  });
  it('下書きはどちらにも出ない', () => {
    const v = {
      publishStatus: 'draft' as const,
      publicVisible: true,
      memberVisible: true,
    };
    expect(canView(v, 'public')).toBe(false);
    expect(canView(v, 'member')).toBe(false);
  });
});
describe('event capacity', () => {
  it('空きがあればpending', () =>
    expect(nextApplicationStatus(20, 19, true)).toBe('pending'));
  it('満席かつwaitlist ONならwaitlist', () =>
    expect(nextApplicationStatus(20, 20, true)).toBe('waitlist'));
  it('満席かつwaitlist OFFならclosed', () =>
    expect(nextApplicationStatus(20, 20, false)).toBe('closed'));
});
describe('payments', () => {
  it('toggleでpaidとなり集計が変わる', () => {
    const next = togglePayment('unpaid', '2026-08-29T00:00:00Z');
    expect(next.status).toBe('paid');
    const s = paymentSummary([
      { amount: 5500, status: next.status },
      { amount: 4500, status: 'unpaid' },
    ]);
    expect(s).toEqual({
      expected: 10000,
      collected: 5500,
      outstanding: 4500,
      rate: 55,
      unpaidCount: 1,
    });
  });
});
describe('validation', () => {
  it('価格・定員・日付・slugをサーバー側規則で拒否', () => {
    const e = validateEvent({
      slug: 'Bad Slug',
      capacity: 0,
      price: -1,
      startAt: '2026-09-20',
      endAt: '2026-09-19',
    });
    expect(Object.keys(e).sort()).toEqual([
      'capacity',
      'dates',
      'price',
      'slug',
    ]);
  });
});
