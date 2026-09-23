// Read-only transport. Credentials are supplied only by server callers.
export type CourseSummary = { id: number; name: string; billingType: string };
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
      return { id: item.id as number, name: item.name, billingType: item.billing_type };
    });
    return { courses, total: result.total_count };
  } catch {
    // Never propagate upstream bodies, headers or request errors containing secrets.
    throw new Error('kaihipay_lookup_failed');
  }
}
