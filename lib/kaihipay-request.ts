import { automaticKaihipayTokenConfigured, getKaihipayToken } from './neon/kaihipay-token-runtime';

/** All provider reads share the same bounded authentication retry. */
export async function kaihipayGet(path: string, token: string, fetcher: typeof fetch = fetch) {
  const read = (value: string) => fetcher('https://api.kaihipay.jp/v1' + path, {
    method: 'GET', headers: { Authorization: `Bearer ${value.trim()}`, Accept: 'application/json' },
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let response = await read(token);
  if ((response.status === 401 || response.status === 403) && automaticKaihipayTokenConfigured()) {
    const refreshed = await getKaihipayToken(token);
    if (refreshed !== token) response = await read(refreshed);
  }
  return response;
}
