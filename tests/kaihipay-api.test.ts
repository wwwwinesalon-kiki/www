import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  resolveMembershipCourseId,
  resolveMembershipCourseIdWithFee,
  readAllOrders,
  readCustomer,
} from '../lib/kaihipay-api';
afterEach(() => vi.unstubAllGlobals());

it('uses verified course detail when the list omits the monthly fee', async () => {
  const course = { id: 7, name: 'www月額費用', billing_type: 'monthly' };
  const fetcher = vi.fn().mockImplementation(async (url: string) => Response.json({ response: {
    data: url.includes('/courses/7') ? { ...course, recurring_payment_type: 'fixed', recurring_fee: 3410 } : [course],
  } }));
  vi.stubGlobal('fetch', fetcher);
  expect(await resolveMembershipCourseIdWithFee('private-token', '7', 3410)).toBe(7);
  expect(fetcher).toHaveBeenCalledWith('https://api.kaihipay.jp/v1/courses/7', expect.objectContaining({ method: 'GET' }));
});

it('rejects mismatched course detail and variable recurring schedules', async () => {
  for (const detail of [
    { id: 8, name: 'www月額費用', billing_type: 'monthly', recurring_payment_type: 'fixed', recurring_fee: 3410 },
    { id: 7, name: 'www月額費用', billing_type: 'monthly', recurring_payment_type: 'each_period', recurring_fee: 3410 },
  ]) {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => Response.json({ response: {
      data: url.includes('/courses/7') ? detail : [{ id: 7, name: 'www月額費用', billing_type: 'monthly' }],
    } })));
    await expect(resolveMembershipCourseIdWithFee('private-token', '7', 3410)).rejects.toThrow('kaihipay_course_detail_failed');
  }
});

it('selects the unique monthly WWW course with 3,300 yen recurring fee', async () => {
  const fetcher = vi.fn().mockImplementation(async () => Response.json({response:{data:[
    {id:1,name:'www月額費用',billing_type:'monthly',recuring_fee:3300},
    {id:2,name:'www月額費用',billing_type:'annual',recuring_fee:3300},
  ]}}));
  vi.stubGlobal('fetch',fetcher);
  expect(await resolveMembershipCourseId('private-token')).toBe(1);
  expect(fetcher.mock.calls[0][0]).toBe('https://api.kaihipay.jp/v1/courses?limit=100&offset=0');
  await expect(resolveMembershipCourseId('private-token','2')).rejects.toThrow('kaihipay_membership_course_ambiguous');
});

it('rejects ambiguous course names and fee mismatches', async () => {
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({response:{data:[
    {id:1,name:'www月額費用',billing_type:'monthly',recuring_fee:3300},
    {id:2,name:'www月額費用',billing_type:'monthly',recuring_fee:3300},
  ]}})));
  await expect(resolveMembershipCourseId('private-token')).rejects.toThrow('kaihipay_membership_course_ambiguous');
});

it('requires a confirmed Neon course ID and exact live recurring fee', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json({ response: { data: [
    { id: 7, name: 'www月額費用', billing_type: 'monthly', recuring_fee: 3410 },
  ] } })));
  expect(await resolveMembershipCourseIdWithFee('private-token', '7', 3410)).toBe(7);
  await expect(resolveMembershipCourseIdWithFee('private-token', '7', 3300))
    .rejects.toThrow('kaihipay_membership_course_ambiguous');
  await expect(resolveMembershipCourseIdWithFee('private-token', '8', 3410))
    .rejects.toThrow('kaihipay_membership_course_ambiguous');
});

it('reads invoices and exact customer identity without accepting mismatched numbers', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({response:{data:[{order_number:'o1',customer_number:'c1'}]}}))
    .mockResolvedValueOnce(Response.json({response:{data:{customer_number:'c1',mail:'person@example.test',name:'Wine'}}}));
  vi.stubGlobal('fetch',fetcher);
  expect(await readAllOrders('private-token')).toHaveLength(1);
  expect(await readCustomer('private-token','c1')).toEqual({number:'c1',email:'person@example.test'});
  expect(fetcher.mock.calls[1][0]).toBe('https://api.kaihipay.jp/v1/customers/c1');
});
