import { expect, it } from 'vitest';
import { paidServiceMonths, paidAccessWindow } from '../lib/kaihipay-orders';
const order = (details: unknown[], status='入金済') => ({
  order_number:'ord-1',customer_number:'customer-1',determine_status:'確定済',
  payment_status:status, details,
});
const detail = (month:string, course_id=7, type='継続課金') => ({
  type, course_id,usage_month:month,
});
it('accepts only confirmed paid monthly fees for the exact customer and course', () => {
  expect(paidServiceMonths([
    order([detail('2026年09月'),detail('2026年10月',8),detail('2026年11月',7,'単発課金')]),
    order([detail('2026年10月')],'未入金'),
    {...order([detail('2026年12月')]),customer_number:'someone-else'},
  ],'customer-1',7)).toEqual(['2026-09']);
});
it('does not open future or skipped months early', () => {
  expect(paidAccessWindow(['2026-10'],new Date('2026-09-24T00:00:00Z'))).toEqual({
    validFrom:'2026-09-30T15:00:00.000Z',validUntil:'2026-10-31T15:00:00.000Z',
  });
  expect(paidAccessWindow(['2026-09','2026-11'],new Date('2026-09-24T00:00:00Z'))).toEqual({
    validFrom:'2026-08-31T15:00:00.000Z',validUntil:'2026-09-30T15:00:00.000Z',
  });
  expect(paidAccessWindow(['2026-08'],new Date('2026-09-24T00:00:00Z'))).toBeNull();
});
it('extends consecutive paid months across year end', () => {
  expect(paidAccessWindow(['2026-12','2027-01'],new Date('2026-12-15T00:00:00Z'))).toEqual({
    validFrom:'2026-11-30T15:00:00.000Z',validUntil:'2027-01-31T15:00:00.000Z',
  });
});
