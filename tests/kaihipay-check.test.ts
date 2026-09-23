import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ admin: vi.fn(), courses: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: mocks.admin }));
vi.mock('@/lib/kaihipay-read', () => ({ readKaihipayCourses: mocks.courses }));
import { POST } from '../app/api/admin/kaihipay/check/route';
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
  expect(await response.json()).toEqual({ courses: [], total: 0, automaticActivation: false });
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
