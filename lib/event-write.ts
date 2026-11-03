import { validateEvent } from './domain';

/** Event editor dates are Japan time, regardless of browser/server timezone. */
export function eventDateIso(value: unknown) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : '';
  if (typeof value !== 'string' || !value.trim()) return '';
  const input = value.trim();
  const source = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(input)
    ? input + '+09:00'
    : input;
  const date = new Date(source);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

export function eventWritePayload(input: Record<string, unknown>, existing: Record<string, unknown> = {}) {
  const merged = { ...existing, ...input };
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const start = eventDateIso(merged.start_at);
  const end = eventDateIso(merged.end_at);
  const errors = validateEvent({
    slug: text(merged.slug), capacity: Number(merged.capacity), price: Number(merged.price),
    startAt: start, endAt: end,
  });
  if (!text(merged.title) || text(merged.title).length > 200) errors.title = 'イベント名を200文字以内で入力してください';
  if (!text(merged.venue)) errors.venue = '会場を入力してください';
  if (!['draft', 'published'].includes(String(merged.publish_status ?? 'draft')))
    errors.publish_status = '公開状態を確認してください';
  for (const key of ['member_only', 'registration_enabled', 'waitlist_enabled', 'public_visible', 'member_visible']) {
    if (key in input && typeof input[key] !== 'boolean') errors[key] = '表示と受付の設定を確認してください';
  }
  const payload = { ...input };
  for (const key of ['title', 'venue', 'slug']) if (key in input) payload[key] = text(input[key]);
  if ('start_at' in input) payload.start_at = start;
  if ('end_at' in input) payload.end_at = end;
  if ('capacity' in input) payload.capacity = Number(input.capacity);
  if ('price' in input) payload.price = Number(input.price);
  return { payload, errors };
}
