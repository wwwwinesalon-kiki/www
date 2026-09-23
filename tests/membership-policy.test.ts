import { expect, it, vi } from 'vitest';
import { paidMonthEnd, MEMBERSHIP_SIGNUP_URL, MEMBERSHIP_TOTAL_LABEL } from '../lib/membership-policy';
import { readKaihipayCourses } from '../lib/kaihipay-read';

it('uses the approved signup form and total charge', () => {
  expect(MEMBERSHIP_TOTAL_LABEL).toBe('3,410円');
  expect(new URL(MEMBERSHIP_SIGNUP_URL).searchParams.get('form_code')).toBe('3006100915631325');
});
it.each([
  ['2026-09', '2026-09-30T15:00:00.000Z'],
  ['2026-12', '2026-12-31T15:00:00.000Z'],
  ['2028-02', '2028-02-29T15:00:00.000Z'],
  ['2026-02', '2026-02-28T15:00:00.000Z'],
])('ends %s at next month midnight JST', (month, end) => {
  expect(paidMonthEnd(month)).toBe(end);
});
it.each(['2026-00', '2026-13', '2026-9', '2026-09-01', '', '0099-01'])('rejects invalid month %s', month => {
  expect(() => paidMonthEnd(month)).toThrow('invalid_service_month');
});
it('reads only courses and returns only selected fields', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ response: { total_count: 1, data: [
    { id: 5, name: 'WWW', billing_type: 'monthly', contracted_count: 10 },
  ] } }));
  expect(await readKaihipayCourses('test-token', fetcher)).toEqual({
    total: 1, courses: [{ id: 5, name: 'WWW', billingType: 'monthly' }],
  });
  expect(fetcher).toHaveBeenCalledWith('https://api.kaihipay.jp/v1/courses?limit=100&offset=0',
    expect.objectContaining({ method: 'GET', cache: 'no-store', redirect: 'error' }));
});
it('never calls provider without credentials', async () => {
  const fetcher = vi.fn();
  await expect(readKaihipayCourses(undefined, fetcher)).rejects.toThrow('kaihipay_not_configured');
  expect(fetcher).not.toHaveBeenCalled();
});
it('does not expose upstream error details', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('secret token and request data'));
  await expect(readKaihipayCourses('test-token', fetcher)).rejects.toThrow(/^kaihipay_lookup_failed$/);
});
it('rejects unexpected response shape', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ response: { total_count: 1, data: [{}] } }));
  await expect(readKaihipayCourses('test-token', fetcher)).rejects.toThrow('kaihipay_lookup_failed');
});
