import { neon } from '@neondatabase/serverless';

type NeonSql = ReturnType<typeof neon>;

let sqlClient: NeonSql | null = null;

/** Keep the existing production backend active until data and media are verified. */
export function isNeonBackend() {
  return process.env.BACKEND_PROVIDER === 'neon';
}

/** Server-only Postgres access. Never expose the connection string to the browser. */
export function neonSql(): NeonSql {
  if (!isNeonBackend()) {
    throw new Error('Neon backend is not enabled');
  }
  const url = process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error('NEON_DATABASE_URL is not configured');
  }
  if (!sqlClient) sqlClient = neon(url);
  return sqlClient;
}
