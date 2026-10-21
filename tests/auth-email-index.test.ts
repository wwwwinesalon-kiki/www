import { expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('server-only', () => ({}));
import { readAuthEmailIndex } from '../lib/auth-email-index';

it('checks every Auth page without copying identities into profiles', async () => {
  const listUsers = vi.fn()
    .mockResolvedValueOnce({
      data: { users: [{ email: 'FIRST@example.test' }], nextPage: 2, total: 2 },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { users: [{ email: 'second@example.test' }], nextPage: null, total: 2 },
      error: null,
    });
  const db = { auth: { admin: { listUsers } } } as unknown as SupabaseClient;
  expect(await readAuthEmailIndex(db)).toEqual(new Set([
    'first@example.test', 'second@example.test',
  ]));
  expect(listUsers).toHaveBeenCalledTimes(2);
});

it('fails closed if Auth identity pagination is incomplete', async () => {
  const db = { auth: { admin: { listUsers: vi.fn().mockResolvedValue({
    data: { users: [{ email: 'first@example.test' }], nextPage: null, total: 2 },
    error: null,
  }) } } } as unknown as SupabaseClient;
  await expect(readAuthEmailIndex(db)).rejects.toThrow('auth_users_pagination_incomplete');
});
