import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ admin: vi.fn(), courses: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: mocks.admin }));
vi.mock('@/lib/kaihipay-read', () => ({ readKaihipayCourses: mocks.courses }));
import { GET, POST } from '../app/api/admin/kaihipay/check/route';
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
function request(origin = 'https://www.example.test') {
  return new Request('https://www.example.test/api/admin/kaihipay/check', {
    method: 'POST', headers: { origin },
  });
}
it.each([null, { role: 'viewer' }, { role: 'editor' }])('refuses non-owner %j before contacting provider', async actor => {
  mocks.admin.mockResolvedValue(actor);
  expect((await POST(request())).status).toBe(403);
  expect(mocks.courses).not.toHaveBeenCalled();
});
it('rejects cross-origin and missing-origin requests', async () => {
  mocks.admin.mockResolvedValue({ role: 'owner' });
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.example.test');
  expect((await POST(request('https://other.example.test'))).status).toBe(403);
  expect((await POST(request(''))).status).toBe(403);
  expect(mocks.courses).not.toHaveBeenCalled();
});
it('reports absent configuration without calling provider', async () => {
  mocks.admin.mockResolvedValue({ role: 'owner' });
  vi.stubEnv('KAIHIPAY_API_TOKEN', '');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.example.test');
  expect((await POST(request())).status).toBe(503);
  expect(mocks.courses).not.toHaveBeenCalled();
});
it('allows owner read check without enabling automatic activation', async () => {
  mocks.admin.mockResolvedValue({ role: 'owner' });
  mocks.courses.mockResolvedValue({ courses: [], total: 0 });
  vi.stubEnv('KAIHIPAY_API_TOKEN', 'test-only-secret');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.example.test');
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toMatchObject({ courses: [], total: 0, canAttemptSync: false, courseVerification: 'missing_configuration' });
});

function configure() {
  mocks.admin.mockResolvedValue({ role: 'owner' });
  for (const [key, value] of Object.entries({
    NEXT_PUBLIC_SITE_URL: 'https://www.example.test', BACKEND_PROVIDER: 'neon',
    NEON_DATABASE_URL: 'postgresql://test-only-database.invalid/test',
    KAIHIPAY_API_TOKEN: 'test-only-token-secret', KAIHIPAY_EMAIL_HMAC_SECRET: 'test-only-hmac-secret-32-characters',
    KAIHIPAY_MEMBERSHIP_COURSE_ID: '5', KAIHIPAY_EXPECTED_RECURRING_FEE_YEN: '3300',
    CRON_SECRET: 'test-only-cron-secret',
  })) vi.stubEnv(key, value);
  mocks.courses.mockResolvedValue({ total: 1, courses: [{ id: 5, name: 'www月額費用', billingType: 'monthly', recurringFee: 3300 }] });
}
it('owner GET reports only configuration booleans and never contacts the provider', async () => {
  configure();
  const response = await GET(new Request('https://www.example.test/api/admin/kaihipay/check'));
  const text = await response.text();
  const data = JSON.parse(text);
  expect(data).toMatchObject({ configuration: { missing: [], settingsReady: true }, courseVerification: 'not_checked', canAttemptSync: false });
  expect(data.configuration.checks).toContainEqual({ key: 'KAIHIPAY_API_TOKEN', configured: true });
  for (const secret of ['test-only-token-secret', 'test-only-hmac-secret-32-characters', 'test-only-cron-secret', 'postgresql://']) expect(text).not.toContain(secret);
  expect(mocks.courses).not.toHaveBeenCalled();
});
it.each([null, { role: 'viewer' }, { role: 'editor' }])('GET refuses non-owner %j', async actor => {
  mocks.admin.mockResolvedValue(actor);
  expect((await GET(new Request('https://www.example.test/api/admin/kaihipay/check'))).status).toBe(403);
});
it('allows attempting sync only after all configuration and the exact course fee are verified', async () => {
  configure();
  expect(await (await POST(request())).json()).toMatchObject({ canAttemptSync: true, courseVerification: 'matched', configuration: { settingsReady: true } });
});
it.each([
  ['KAIHIPAY_EXPECTED_RECURRING_FEE_YEN', '3410'],
  ['KAIHIPAY_MEMBERSHIP_COURSE_ID', '6'],
])('keeps sync disabled on provider mismatch for %s', async (key, value) => {
  configure(); vi.stubEnv(key, value);
  expect(await (await POST(request())).json()).toMatchObject({ canAttemptSync: false, courseVerification: 'mismatch' });
});
it('reports malformed or missing settings without echoing their values', async () => {
  configure();
  vi.stubEnv('KAIHIPAY_EMAIL_HMAC_SECRET', 'short-secret');
  vi.stubEnv('KAIHIPAY_MEMBERSHIP_COURSE_ID', 'invalid-secret');
  vi.stubEnv('CRON_SECRET', '');
  const response = await POST(request());
  const text = await response.text();
  expect(JSON.parse(text)).toMatchObject({ canAttemptSync: false, configuration: { missing: ['KAIHIPAY_EMAIL_HMAC_SECRET', 'KAIHIPAY_MEMBERSHIP_COURSE_ID', 'CRON_SECRET'] } });
  expect(text).not.toContain('short-secret'); expect(text).not.toContain('invalid-secret');
});
it('does not consider a partial course list verified', async () => {
  configure();
  const sample = await mocks.courses();
  mocks.courses.mockResolvedValue({ ...sample, total: 101 });
  expect(await (await POST(request())).json()).toMatchObject({ canAttemptSync: false, courseVerification: 'incomplete_course_list' });
});
it('hides provider failures and secrets', async () => {
  mocks.admin.mockResolvedValue({ role: 'owner' });
  mocks.courses.mockRejectedValue(new Error('test-only-secret'));
  vi.stubEnv('KAIHIPAY_API_TOKEN', 'test-only-secret');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.example.test');
  const response = await POST(request());
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain('test-only-secret');
});
