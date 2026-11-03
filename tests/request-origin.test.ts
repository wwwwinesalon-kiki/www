import { afterEach, expect, it, vi } from 'vitest';
import { sameAppOrigin } from '../lib/request-origin';
afterEach(() => vi.unstubAllEnvs());
it('accepts the configured public origin when a host adapter uses an internal URL', () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.example.test');
  expect(sameAppOrigin(new Request('http://localhost:3000/api/admin/media', {
    headers: { origin: 'https://www.example.test' },
  }))).toBe(true);
});
it('rejects foreign origins and spoofed forwarded hosts', () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.example.test');
  expect(sameAppOrigin(new Request('http://localhost:3000/api/admin/media', {
    headers: { origin: 'https://other.example.test', 'x-forwarded-host': 'other.example.test' },
  }))).toBe(false);
  expect(sameAppOrigin(new Request('http://localhost:3000/api/admin/media'))).toBe(false);
});
