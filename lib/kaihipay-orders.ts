import { paidMonthEnd, paidMonthStart } from './membership-policy';

type Detail = { type?: unknown; course_id?: unknown; usage_month?: unknown };
export type Order = {
  order_number?: unknown;
  customer_number?: unknown;
  determine_status?: unknown;
  payment_status?: unknown;
  details?: unknown;
};

export function paidServiceMonths(
  orders: Order[],
  customerNumber: string,
  courseId: number,
): string[] {
  const months = new Set<string>();
  for (const order of orders) {
    if (order.customer_number !== customerNumber ||
        order.determine_status !== '確定済' ||
        order.payment_status !== '入金済' ||
        typeof order.order_number !== 'string' || !order.order_number ||
        !Array.isArray(order.details)) continue;
    for (const detail of order.details as Detail[]) {
      if (!detail || !['利用開始月', '利用開始翌月', '継続課金'].includes(String(detail.type)) ||
          detail.course_id !== courseId || typeof detail.usage_month !== 'string') continue;
      const match = /^(\d{4})年(0[1-9]|1[0-2])月$/.exec(detail.usage_month);
      if (!match) continue;
      const month = `${match[1]}-${match[2]}`;
      try { paidMonthEnd(month); months.add(month); } catch { /* invalid provider month */ }
    }
  }
  return [...months].sort();
}

// Access starts at paid service-month midnight JST. Future payments never open early.
// A later paid month extends access only when all intervening months are paid.
export function paidAccessWindow(
  months: string[], now: Date,
): { validFrom: string; validUntil: string } | null {
  const sorted = [...new Set(months)].sort();
  const current = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const currentMonth = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}`;
  const startIndex = sorted.includes(currentMonth)
    ? sorted.indexOf(currentMonth)
    : sorted.findIndex((month) => month > currentMonth);
  if (startIndex < 0) return null;
  let endIndex = startIndex;
  while (endIndex + 1 < sorted.length &&
         paidMonthEnd(sorted[endIndex]) === paidMonthStart(sorted[endIndex + 1])) endIndex++;
  return { validFrom: paidMonthStart(sorted[startIndex]), validUntil: paidMonthEnd(sorted[endIndex]) };
}
