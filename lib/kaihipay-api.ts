import 'server-only';
import type { Order } from './kaihipay-orders';

type Customer = {
  customer_number?: unknown;
  mail?: unknown;
};

async function apiGet(path: string, token: string): Promise<unknown> {
  const response = await fetch('https://api.kaihipay.jp/v1' + path, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('kaihipay_api_failed');
  return response.json();
}

export async function resolveMembershipCourseId(token: string, configuredId?: string): Promise<number> {
  const matching: number[] = [];
  for (let offset = 0; offset <= 1000; offset += 100) {
    const body = await apiGet(`/courses?limit=100&offset=${offset}`,token);
    const data = (body as {response?: {data?: unknown}})?.response?.data;
    if (!Array.isArray(data)) throw new Error('kaihipay_courses_shape');
    for (const item of data) {
      const course = item as Record<string, unknown>;
      if (course.name === 'www月額費用' && course.billing_type === 'monthly' &&
          course.recuring_fee === 3300 && Number.isSafeInteger(course.id) && Number(course.id) > 0)
        matching.push(Number(course.id));
    }
    if (data.length < 100) break;
    if (offset === 1000) throw new Error('kaihipay_course_limit');
  }
  if (matching.length !== 1 || (configuredId && Number(configuredId) !== matching[0]))
    throw new Error('kaihipay_membership_course_ambiguous');
  return matching[0];
}

export async function readAllOrders(token: string): Promise<Order[]> {
  const all: Order[] = [];
  for (let offset = 0; offset <= 1000; offset += 100) {
    const body = await apiGet(`/orders?limit=100&offset=${offset}`, token);
    const response = (body as { response?: { data?: unknown } })?.response;
    if (!Array.isArray(response?.data)) throw new Error('kaihipay_orders_shape');
    all.push(...response.data as Order[]);
    if (response.data.length < 100) return all;
  }
  // Never silently omit a customer's invoices when the account grows.
  throw new Error('kaihipay_order_limit');
}

export async function readCustomer(token: string, customerNumber: string): Promise<{
  number: string; email: string;
}> {
  if (!/^[\w-]{1,100}$/.test(customerNumber)) throw new Error('invalid_customer_number');
  const body = await apiGet(`/customers/${encodeURIComponent(customerNumber)}`, token);
  const customer = (body as { response?: { data?: Customer } })?.response?.data;
  if (!customer || customer.customer_number !== customerNumber ||
      typeof customer.mail !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.mail))
    throw new Error('kaihipay_customer_shape');
  // The address is used only to send the account invitation. Names remain in Kaihipay.
  return { number: customerNumber, email: customer.mail };
}
