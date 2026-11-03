/** Hosting adapters can expose an internal request URL. Trust only our
 * configured public origin, never client-supplied forwarded-host headers. */
export function sameAppOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const expected = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url);
    const supplied = new URL(origin);
    return ['http:', 'https:'].includes(expected.protocol) &&
      supplied.origin === expected.origin;
  } catch {
    return false;
  }
}
