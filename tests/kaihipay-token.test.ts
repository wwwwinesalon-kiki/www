import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock('../lib/neon/db-runtime', () => ({ neonSql: () => mocks.sql }));
const db = new PGlite();
let service: typeof import('../lib/neon/kaihipay-token-runtime');
const originalToken = 'test-api-token-original-123456';
const renewedToken = 'test-api-token-renewed-654321';
const expiry = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const tokenResponse = (token = originalToken) => Response.json({ token, expire_date: expiry() });

beforeAll(async () => {
  await db.exec('CREATE ROLE www_token_test_member');
  mocks.sql.mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const query = parts.map((part, index) => part + (index < parts.length - 1 ? `$${index + 1}` : '')).join('');
    return (await db.query(query, values)).rows;
  });
}, 30000);
beforeEach(async () => {
  await db.exec('DROP SCHEMA IF EXISTS www_private CASCADE');
  vi.resetModules();
  service = await import('../lib/neon/kaihipay-token-runtime');
  for (const [key, value] of Object.entries({
    BACKEND_PROVIDER: 'neon', KAIHIPAY_API_EMAIL: 'api@example.test', KAIHIPAY_API_PASSWORD: 'test-api-password-only',
    KAIHIPAY_EMAIL_HMAC_SECRET: 'test-only-encryption-secret-at-least-32-bytes', KAIHIPAY_API_TOKEN: '',
  })) vi.stubEnv(key, value);
  mocks.sql.mockClear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
afterAll(async () => db.close());

it('keeps existing manual-token operation until both renewal credentials are configured', async () => {
  vi.stubEnv('KAIHIPAY_API_PASSWORD', '');
  vi.stubEnv('KAIHIPAY_API_TOKEN', 'existing-manual-token');
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  expect(await service.getKaihipayToken()).toBe('existing-manual-token');
  expect(mocks.sql).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  expect(await service.kaihipayTokenStatus()).toMatchObject({ configured: false, initialized: false });
});

it('issues once, persists only authenticated encryption, and reuses the stored token', async () => {
  const fetcher = vi.fn().mockImplementation(async () => tokenResponse()); vi.stubGlobal('fetch', fetcher);
  expect(await service.getKaihipayToken()).toBe(originalToken);
  expect(await service.getKaihipayToken()).toBe(originalToken);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith('https://api.kaihipay.jp/v1/regenerate_token', expect.objectContaining({
    method: 'POST', redirect: 'error', body: JSON.stringify({ email: 'api@example.test', password: 'test-api-password-only' }),
  }));
  const stored = JSON.stringify((await db.query('SELECT * FROM www_private.kaihipay_token')).rows);
  for (const secret of [originalToken, 'test-api-password-only', 'api@example.test']) expect(stored).not.toContain(secret);
  expect(stored).toContain('v1.');
  expect(await service.kaihipayTokenStatus()).toMatchObject({ configured: true, initialized: true, error: null });
  const status = JSON.stringify(await service.kaihipayTokenStatus());
  expect(status).not.toContain(originalToken); expect(status).not.toContain('encrypted_token');
});

it('serializes concurrent first-use renewals using the database lease', async () => {
  const fetcher = vi.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 50)); return tokenResponse();
  }); vi.stubGlobal('fetch', fetcher);
  expect(await Promise.all([service.getKaihipayToken(), service.getKaihipayToken(), service.getKaihipayToken()]))
    .toEqual([originalToken, originalToken, originalToken]);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('renews before expiry and preserves a still-valid token during a temporary failure', async () => {
  const fetcher = vi.fn().mockImplementation(async () => tokenResponse()); vi.stubGlobal('fetch', fetcher);
  await service.getKaihipayToken();
  await db.exec("UPDATE www_private.kaihipay_token SET expires_at=now()+interval '2 days'");
  fetcher.mockImplementation(async () => tokenResponse(renewedToken));
  expect(await service.getKaihipayToken()).toBe(renewedToken);
  await db.exec("UPDATE www_private.kaihipay_token SET expires_at=now()+interval '2 days'");
  fetcher.mockRejectedValue(new Error('test-api-password-only')); 
  expect(await service.getKaihipayToken()).toBe(renewedToken);
  expect(await service.getKaihipayToken()).toBe(renewedToken);
  expect(fetcher).toHaveBeenCalledTimes(3);
  await expect(service.getKaihipayToken(renewedToken)).rejects.toThrow('kaihipay_token_refresh_backoff');
  expect(await service.kaihipayTokenStatus()).toMatchObject({ initialized: true, error: 'refresh_failed' });
});

it('stops retrying rejected credentials until they change while retaining manual access', async () => {
  vi.stubEnv('KAIHIPAY_API_TOKEN', 'existing-manual-token');
  const fetcher = vi.fn().mockImplementation(async () => Response.json({ error: 'private-provider-body' }, { status: 401 }));
  vi.stubGlobal('fetch', fetcher);
  expect(await service.getKaihipayToken()).toBe('existing-manual-token');
  expect(await service.getKaihipayToken()).toBe('existing-manual-token');
  expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(service.getKaihipayToken('existing-manual-token')).rejects.toThrow('kaihipay_token_refresh_backoff');
  vi.stubEnv('KAIHIPAY_API_PASSWORD', 'corrected-test-password');
  fetcher.mockImplementation(async () => tokenResponse());
  expect(await service.getKaihipayToken()).toBe(originalToken);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('retries a rejected provider read once using the newly issued token', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => tokenResponse()));
  await service.getKaihipayToken();
  const fetcher = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
    if (url.endsWith('/regenerate_token')) return tokenResponse(renewedToken);
    return options.headers && (options.headers as Record<string,string>).Authorization === `Bearer ${renewedToken}`
      ? Response.json({ response: { data: [] } }) : new Response(null, { status: 403 });
  });
  vi.stubGlobal('fetch', fetcher);
  const { kaihipayGet } = await import('../lib/kaihipay-request');
  expect((await kaihipayGet('/orders', originalToken)).status).toBe(200);
  expect(fetcher.mock.calls.map(call => call[0])).toEqual([
    'https://api.kaihipay.jp/v1/orders', 'https://api.kaihipay.jp/v1/regenerate_token', 'https://api.kaihipay.jp/v1/orders',
  ]);
});

it('refuses corrupted encrypted state and denies public-role database reads', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => tokenResponse()));
  await service.getKaihipayToken();
  await db.exec('SET ROLE www_token_test_member');
  try { await expect(db.query('SELECT * FROM www_private.kaihipay_token')).rejects.toThrow(/permission denied/); }
  finally { await db.exec('RESET ROLE'); }
  await db.exec("UPDATE www_private.kaihipay_token SET encrypted_token='invalid-encrypted-state'");
  await expect(service.getKaihipayToken()).rejects.toThrow('kaihipay_token_decryption_failed');
});

it('rejects invalid expiry responses without storing or exposing the new token', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ token: originalToken, expire_date: '2099-01-01 00:00:00' })));
  await expect(service.getKaihipayToken()).rejects.toThrow(/^kaihipay_token_refresh_failed$/);
  expect((await db.query<{ encrypted_token: string | null }>('SELECT encrypted_token FROM www_private.kaihipay_token')).rows[0].encrypted_token).toBeNull();
  const now = Date.parse('2026-11-04T03:00:00Z');
  expect(service.kaihipayTokenExpiry('2026-12-04 12:00:00', now)).toBe('2026-12-04T03:00:00.000Z');
  expect(() => service.kaihipayTokenExpiry('invalid', now)).toThrow('kaihipay_token_expiry_invalid');
});
