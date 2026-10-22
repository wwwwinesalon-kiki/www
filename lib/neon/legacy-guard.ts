import type { createClient } from '@/lib/supabase/server';

/** A temporary tripwire for any route not migrated to direct Neon SQL yet. */
export function legacySupabaseUnavailable(): Awaited<
  ReturnType<typeof createClient>
> {
  return new Proxy(
    {},
    {
      get() {
        throw new Error('この処理は新しい保存先への切り替え前です');
      },
    },
  ) as Awaited<ReturnType<typeof createClient>>;
}
