import sanitizeHtml from 'sanitize-html';

export const PRIMARY_CATEGORIES = ['TABLE', 'FIELD', 'PEOPLE'];
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function safeNext(value: unknown, fallback = '/member') {
  if (
    typeof value !== 'string' ||
    !/^\/(member|admin)(\/|\?|$)/.test(value) ||
    /[\\%\s#]/.test(value)
  )
    return fallback;
  const url = new URL(value, 'https://www.invalid');
  if (
    url.origin !== 'https://www.invalid' ||
    !/^\/(member|admin)(\/|$)/.test(url.pathname)
  )
    return fallback;
  if (/^\/member\/(login|reset|setup|auth)(\/|$)/.test(url.pathname))
    return fallback;
  return url.pathname + url.search;
}
export function safeImage(value: unknown) {
  return typeof value === 'string' &&
    (/^\/api\/media\/[a-f0-9-]{36}$/i.test(value) ||
      /^\/(images|photos|assets)\/[a-zA-Z0-9_./-]+$/.test(value))
    ? value
    : '';
}
export function cleanArticle(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'h2',
      'h3',
      'strong',
      'b',
      'em',
      'i',
      'ul',
      'ol',
      'li',
      'a',
      'blockquote',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'td',
      'th',
      'hr',
    ],
    allowedAttributes: {
      a: ['href', 'rel'],
      img: ['src', 'alt'],
      th: ['scope'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
    exclusiveFilter: (frame) =>
      frame.tag === 'img' && !safeImage(frame.attribs.src),
  });
}
export function articleHtml(body: string, format?: string) {
  if (format === 'html') return cleanArticle(body);
  return body
    .split(/\r?\n/)
    .map(
      (p) =>
        `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`,
    )
    .join('');
}
export function articlePayload(
  input: Record<string, unknown>,
  existing?: Record<string, unknown>,
) {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const type = typeof input.type === 'string' ? input.type : '';
  if (!title || title.length > 200 || !/^[A-Z_]{1,40}$/.test(type))
    throw new Error('タイトルとカテゴリを確認してください');
  if (typeof input.body !== 'string' || input.body.length > 200_000)
    throw new Error('本文は20万文字以内にしてください');
  if (!['draft', 'published'].includes(String(input.publish_status)))
    throw new Error('公開状態が不正です');
  const body = cleanArticle(input.body);
  const cover = input.cover_image ? safeImage(input.cover_image) : null;
  const legacyCover =
    typeof existing?.cover_image === 'string' ? existing.cover_image : null;
  // Preserve an unchanged legacy cover URL; new remote URLs are not accepted.
  if (
    input.cover_image &&
    !cover &&
    input.cover_image !== existing?.cover_image
  )
    throw new Error('画像をアップロードまたは選択してください');
  const coverAlt =
    typeof input.cover_alt === 'string'
      ? input.cover_alt.trim().slice(0, 500)
      : '';
  if (input.cover_image && !coverAlt)
    throw new Error('メイン画像の説明を入力してください');
  if (
    input.publish_status === 'published' &&
    !sanitizeHtml(body, { allowedTags: [], allowedAttributes: {} }).trim()
  )
    throw new Error('公開前に本文を入力してください');
  return {
    title,
    type,
    body,
    body_format: 'html',
    cover_image: input.cover_image ? cover || legacyCover : null,
    cover_alt: coverAlt,
    publish_status: input.publish_status,
    published_at:
      input.publish_status === 'published'
        ? existing?.published_at || new Date().toISOString()
        : existing?.published_at || null,
  };
}
