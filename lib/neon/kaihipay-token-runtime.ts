import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, randomUUID } from 'node:crypto';
import { neonSql } from './db-runtime';

const RENEW_AHEAD_MS = 3 * 24 * 60 * 60 * 1000;
const AAD = 'www:kaihipay:token:v1';
type TokenRow = {
  encrypted_token: string | null; expires_at: string | Date | null;
  updated_at: string | Date | null; next_attempt_at: string | Date | null;
  last_error_code: string | null;
  credentials_fingerprint: string | null;
};
let schemaReady: Promise<void> | undefined;

export function automaticKaihipayTokenConfigured() {
  return process.env.BACKEND_PROVIDER === 'neon' &&
    !!process.env.KAIHIPAY_API_EMAIL?.trim() && !!process.env.KAIHIPAY_API_PASSWORD;
}

function encryptionKey() {
  const secret = process.env.KAIHIPAY_EMAIL_HMAC_SECRET || '';
  if (Buffer.byteLength(secret, 'utf8') < 32) throw new Error('kaihipay_token_encryption_not_configured');
  // A distinct HKDF context separates token encryption from email HMAC use.
  return Buffer.from(hkdfSync('sha256', secret, 'www-provider-credentials', AAD, 32));
}
function encrypt(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(AAD));
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}
function decrypt(value: string) {
  try {
    const [version, iv, tag, data, extra] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !data || extra) throw new Error('invalid_ciphertext');
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(AAD));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch { throw new Error('kaihipay_token_decryption_failed'); }
}
const millis = (value: string | Date | null) => value ? new Date(value).getTime() : 0;
function credentialsFingerprint() {
  return createHmac('sha256', encryptionKey()).update('credentials-v1\0' + process.env.KAIHIPAY_API_EMAIL!.trim() + '\0' + process.env.KAIHIPAY_API_PASSWORD!).digest('hex');
}

async function ensureStore() {
  schemaReady ??= (async () => {
    const sql = neonSql();
    await sql`CREATE SCHEMA IF NOT EXISTS www_private`;
    await sql`REVOKE ALL ON SCHEMA www_private FROM PUBLIC`;
    await sql`CREATE TABLE IF NOT EXISTS www_private.kaihipay_token (
      singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
      encrypted_token text, expires_at timestamptz, updated_at timestamptz,
      lease_owner uuid, lease_until timestamptz, next_attempt_at timestamptz,
      last_error_code text, credentials_fingerprint text
    )`;
    await sql`ALTER TABLE www_private.kaihipay_token ENABLE ROW LEVEL SECURITY`;
    await sql`REVOKE ALL ON www_private.kaihipay_token FROM PUBLIC`;
    await sql`INSERT INTO www_private.kaihipay_token(singleton) VALUES(true) ON CONFLICT DO NOTHING`;
  })().catch(() => { schemaReady = undefined; throw new Error('kaihipay_token_store_unavailable'); });
  await schemaReady;
}
async function readRow() {
  return ((await neonSql()`SELECT encrypted_token,expires_at,updated_at,next_attempt_at,last_error_code,credentials_fingerprint
    FROM www_private.kaihipay_token WHERE singleton=true`) as unknown as TokenRow[])[0];
}

export function kaihipayTokenExpiry(value: unknown, now = Date.now()): string {
  if (typeof value !== 'string') throw new Error('kaihipay_token_expiry_invalid');
  const source = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(' ', 'T') + '+09:00' : value;
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(source)) throw new Error('kaihipay_token_expiry_invalid');
  const timestamp = Date.parse(source);
  if (!Number.isFinite(timestamp) || timestamp <= now + 60 * 60 * 1000 || timestamp > now + 32 * 24 * 60 * 60 * 1000)
    throw new Error('kaihipay_token_expiry_invalid');
  return new Date(timestamp).toISOString();
}

/** Existing manual-token operation stays active until both API credentials are configured. */
export async function getKaihipayToken(rejectedToken?: string): Promise<string> {
  if (!automaticKaihipayTokenConfigured()) {
    const token = process.env.KAIHIPAY_API_TOKEN?.trim();
    if (!token) throw new Error('kaihipay_token_not_configured');
    return token;
  }
  encryptionKey(); // Refuse renewal before storage can encrypt the returned secret.
  await ensureStore();
  const sql = neonSql();
  const row = await readRow();
  if (!row) throw new Error('kaihipay_token_store_unavailable');
  const current = row.encrypted_token ? decrypt(row.encrypted_token) : null;
  const valid = !!current && millis(row.expires_at) > Date.now();
  const rejectedCurrent = !!rejectedToken && rejectedToken === current;
  const fingerprint = credentialsFingerprint();
  const sameCredentials = row.credentials_fingerprint === fingerprint;
  const fallback = () => {
    if (valid && !rejectedCurrent) return current!;
    const manual = process.env.KAIHIPAY_API_TOKEN?.trim();
    return manual && manual !== rejectedToken ? manual : null;
  };
  if (valid && !rejectedCurrent &&
      (millis(row.expires_at) > Date.now() + RENEW_AHEAD_MS || (rejectedToken && rejectedToken !== current))) return current!;
  if (sameCredentials && (row.last_error_code === 'credentials_rejected' || millis(row.next_attempt_at) > Date.now())) {
    const existing = fallback();
    if (existing) return existing;
    throw new Error('kaihipay_token_refresh_backoff');
  }
  const owner = randomUUID();
  const leases = (await sql`UPDATE www_private.kaihipay_token SET lease_owner=${owner}::uuid,
    lease_until=now()+interval '90 seconds',credentials_fingerprint=${fingerprint},last_error_code=NULL,next_attempt_at=NULL
    WHERE singleton=true AND (lease_until IS NULL OR lease_until<now())
      AND encrypted_token IS NOT DISTINCT FROM ${row.encrypted_token}
      AND (last_error_code IS DISTINCT FROM 'credentials_rejected' OR credentials_fingerprint IS DISTINCT FROM ${fingerprint})
      AND (next_attempt_at IS NULL OR next_attempt_at<=now() OR credentials_fingerprint IS DISTINCT FROM ${fingerprint}) RETURNING singleton`) as unknown as object[];
  if (!leases.length) {
    if (valid && !rejectedCurrent) return current!;
    // Another worker owns renewal; reuse its result rather than reissuing twice.
    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const latest = await readRow();
      if (latest?.encrypted_token && millis(latest.expires_at) > Date.now()) {
        const token = decrypt(latest.encrypted_token);
        if (token !== rejectedToken) return token;
      }
      if (latest?.last_error_code) break;
    }
    throw new Error('kaihipay_token_refresh_in_progress');
  }
  let errorCode = 'request_failed';
  try {
    const requestedAt = Date.now();
    const response = await fetch('https://api.kaihipay.jp/v1/regenerate_token', {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: process.env.KAIHIPAY_API_EMAIL!.trim(), password: process.env.KAIHIPAY_API_PASSWORD! }),
    });
    errorCode = response.status === 401 || response.status === 403 ? 'credentials_rejected' : `http_${response.status}`;
    if (!response.ok) throw new Error('refresh_failed');
    errorCode = 'response_invalid_json';
    const data = await response.json();
    errorCode = 'response_invalid_token';
    if (typeof data?.token !== 'string' || !/^\S{16,4096}$/.test(data.token)) throw new Error('refresh_failed');
    errorCode = 'response_invalid_expiry';
    // Production may omit expire_date despite the documented response schema.
    // The official lifetime is 30 days; use an earlier 29-day management limit
    // from request start, then renew another 3 days ahead of that limit.
    const expiresAt = data.expire_date == null
      ? new Date(requestedAt + 29 * 24 * 60 * 60 * 1000).toISOString()
      : kaihipayTokenExpiry(data.expire_date);
    errorCode = 'token_store_failed';
    const encrypted = encrypt(data.token);
    const saved = (await sql`UPDATE www_private.kaihipay_token SET encrypted_token=${encrypted},
      expires_at=${expiresAt}::timestamptz,updated_at=now(),lease_owner=NULL,lease_until=NULL,
      next_attempt_at=NULL,last_error_code=NULL
      WHERE singleton=true AND lease_owner=${owner}::uuid RETURNING singleton`) as unknown as object[];
    if (!saved.length) { errorCode = 'token_lease_lost'; throw new Error('lease_lost'); }
    return data.token;
  } catch {
    await sql`UPDATE www_private.kaihipay_token SET lease_owner=NULL,lease_until=NULL,
      next_attempt_at=now()+interval '5 minutes',last_error_code=${errorCode}
      WHERE singleton=true AND lease_owner=${owner}::uuid`;
    const existing = fallback();
    if (existing) return existing;
    throw new Error('kaihipay_token_refresh_failed');
  }
}

/** No token, password, email or ciphertext is exposed through this status. */
export async function kaihipayTokenStatus() {
  const configured = automaticKaihipayTokenConfigured();
  if (!configured) return { configured, initialized: false, expiresAt: null, refreshedAt: null, error: null };
  try {
    const row = await readRow();
    return { configured, initialized: !!row?.encrypted_token,
      expiresAt: row?.expires_at ? new Date(row.expires_at).toISOString() : null,
      refreshedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
      error: row?.last_error_code || null };
  } catch { return { configured, initialized: false, expiresAt: null, refreshedAt: null, error: 'not_initialized' }; }
}
