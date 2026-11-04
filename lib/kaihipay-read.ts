// Read-only transport. Credentials are supplied only by server callers.
export type CourseSummary = { id: number; name: string; billingType: string; recurringFee: number | null };
export async function readCourseRecurringFee(token: string, course: { id: number; name: string; billingType: string }, fetcher: typeof fetch = fetch): Promise<number> {
  try {
    const response = await fetcher(`https://api.kaihipay.jp/v1/courses/${course.id}`, {
      method: 'GET', headers: { Authorization: `Bearer ${token.trim()}`, Accept: 'application/json' },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('upstream_error');
    const detail = (await response.json())?.response?.data;
    if (detail?.id !== course.id || detail?.name !== course.name || detail?.billing_type !== course.billingType ||
        detail?.recurring_payment_type !== 'fixed' || !Number.isSafeInteger(detail?.recurring_fee) || detail.recurring_fee < 0)
      throw new Error('invalid_course_detail');
    return detail.recurring_fee;
  } catch { throw new Error('kaihipay_course_detail_failed'); }
}
export async function readKaihipayCourses(
  token: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<{ courses: CourseSummary[]; total: number }> {
  if (!token?.trim()) throw new Error('kaihipay_not_configured');
  try {
    const response = await fetcher('https://api.kaihipay.jp/v1/courses?limit=100&offset=0', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token.trim()}`, Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('upstream_error');
    const body = await response.json();
    const result = body?.response;
    if (!Array.isArray(result?.data) || !Number.isInteger(result.total_count) || result.total_count < 0)
      throw new Error('invalid_response');
    const courses = result.data.map((item: Record<string, unknown>) => {
      if (!item || !Number.isInteger(item.id) || Number(item.id) < 1 ||
          typeof item.name !== 'string' || typeof item.billing_type !== 'string')
        throw new Error('invalid_course');
      if (item.recuring_fee !== undefined &&
          (!Number.isSafeInteger(item.recuring_fee) || Number(item.recuring_fee) < 0))
        throw new Error('invalid_course_fee');
      // The list endpoint spells this field "recuring_fee" in the official spec.
      return {
        id: item.id as number, name: item.name, billingType: item.billing_type,
        recurringFee: item.recuring_fee === undefined ? null : item.recuring_fee as number,
      };
    });
    for (const course of courses) {
      if (course.recurringFee === null && course.name === 'www月額費用' && course.billingType === 'monthly')
        course.recurringFee = await readCourseRecurringFee(token, course, fetcher);
    }
    return { courses, total: result.total_count };
  } catch {
    // Never propagate upstream bodies, headers or request errors containing secrets.
    throw new Error('kaihipay_lookup_failed');
  }
}
