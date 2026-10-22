import { afterEach, describe, expect, it, vi } from 'vitest';

const sync = vi.hoisted(() => vi.fn());
vi.mock('../lib/neon/kaihipay-runtime', () => ({ activateNeonFromKaihipay: sync }));

import runKaihipaySync from '../netlify/functions/kaihipay-background';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sync.mockReset();
});

describe('Netlify Kaihipay background reconciliation', () => {
  it('rejects a missing bearer without running a provider sync', async () => {
    vi.stubEnv('BACKEND_PROVIDER', 'neon');
    vi.stubEnv('CRON_SECRET', 'private-scheduler-secret');
    const response = await runKaihipaySync(new Request('https://member.example/.netlify/functions/kaihipay-background', {
      method: 'POST',
    }));
    expect(response.status).toBe(401);
    expect(sync).not.toHaveBeenCalled();
  });

  it('runs reconciliation directly and propagates failure for background retry', async () => {
    vi.stubEnv('BACKEND_PROVIDER', 'neon');
    vi.stubEnv('CRON_SECRET', 'private-scheduler-secret');
    const fetcher = vi.fn(() => { throw new Error('synchronous_route_must_not_be_called'); });
    vi.stubGlobal('fetch', fetcher);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    sync.mockResolvedValueOnce({ scanned: 1, updated: 1, review: 0 })
      .mockRejectedValueOnce(new Error('kaihipay_reconcile_partial_failure:1'));
    const request = new Request('https://member.example/.netlify/functions/kaihipay-background', {
      method: 'POST',
      headers: { Authorization: 'Bearer private-scheduler-secret' },
    });
    expect((await runKaihipaySync(request)).status).toBe(204);
    await expect(runKaihipaySync(request)).rejects.toThrow('kaihipay_reconcile_partial_failure:1');
    expect(sync).toHaveBeenCalledTimes(2);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
