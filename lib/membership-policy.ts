// Public membership configuration. Never put API credentials in this module.
export const MEMBERSHIP_TOTAL_LABEL = '3,410円';
export const MEMBERSHIP_SIGNUP_URL =
  'https://www.kaihipay.jp/forms?form_code=3006100915631325&auth_key=m3HzQrPumGCgBzkE';

// Exclusive end: the first instant of the following month in Japan.
// Call only with a verified monthly fee's service month, never an event payment.
export function paidMonthEnd(serviceMonth: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(serviceMonth))
    throw new Error('invalid_service_month');
  const [year, month] = serviceMonth.split('-').map(Number);
  if (year < 2000 || year > 9998) throw new Error('invalid_service_month');
  return new Date(Date.UTC(year, month, 1) - 9 * 60 * 60 * 1000).toISOString();
}

export function paidMonthStart(serviceMonth: string): string {
  paidMonthEnd(serviceMonth);
  const [year, month] = serviceMonth.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1) - 9 * 60 * 60 * 1000).toISOString();
}
