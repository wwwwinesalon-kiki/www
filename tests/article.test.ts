import { describe, it, expect } from 'vitest';
import {
  articleHtml,
  articlePayload,
  cleanArticle,
  safeNext,
} from '../lib/article';
import { checkImage } from '../lib/image-upload';
describe('article safety', () => {
  it('removes executable markup and remote tracking images', () => {
    const html = cleanArticle(
      '<h2>見出し</h2><script>alert(1)</script><img src="https://evil.invalid/x" onerror="alert(1)"><a href="javascript:alert(1)">危険</a><table><tr><td>表</td></tr></table>',
    );
    expect(html).toContain('<h2>見出し</h2>');
    expect(html).toContain('<td>表</td>');
    expect(html).not.toMatch(/script|onerror|evil.invalid|javascript/);
  });
  it('keeps useful formatting and approved article images', () =>
    expect(
      cleanArticle(
        '<p><strong>太字</strong></p><img src="/api/media/11111111-1111-4111-8111-111111111111" alt="畑">',
      ),
    ).toContain('alt="畑"'));
  it('escapes legacy plaintext', () =>
    expect(articleHtml('<script>evil</script>', 'plain')).toContain(
      '&lt;script&gt;',
    ));
  it.each([
    'https://evil.invalid',
    '//evil.invalid',
    '/\\evil.invalid',
    '/member/%2f%2fevil.invalid',
    '/member/../../evil',
    '/member/login',
    '/member/../..//evil.invalid',
    ' /admin',
    '/api/admin',
  ])('rejects next %s', (value) => expect(safeNext(value)).toBe('/member'));
  it('preserves internal admin deep link', () =>
    expect(safeNext('/admin/contents/new')).toBe('/admin/contents/new'));
  it('requires title/body before publication', () =>
    expect(() =>
      articlePayload({
        title: '',
        type: 'TABLE',
        body: '',
        publish_status: 'published',
      }),
    ).toThrow());
  it('does not copy visibility or audio from requests', () => {
    const p = articlePayload({
      title: '記事',
      type: 'TABLE',
      body: '<p>本文</p>',
      publish_status: 'draft',
      audio: 'x',
      public_visible: true,
    });
    expect(p).not.toHaveProperty('audio');
    expect(p).not.toHaveProperty('public_visible');
  });
  it('stores the member-card summary without changing visibility', () => {
    const p = articlePayload({
      title: '畑の記録',
      type: 'FIELD',
      body: '<p>本文</p>',
      summary: '余市の畑から届いた話',
      publish_status: 'published',
      member_visible: false,
      public_visible: true,
    });
    expect(p.summary).toBe('余市の畑から届いた話');
    expect(p.publish_status).toBe('published');
    expect(p).not.toHaveProperty('member_visible');
    expect(p).not.toHaveProperty('public_visible');
  });
  it('rejects overly long summaries', () => {
    expect(() =>
      articlePayload({
        title: '記事',
        type: 'TABLE',
        body: '本文',
        summary: '長'.repeat(301),
        publish_status: 'draft',
      }),
    ).toThrow('概要は300文字以内');
  });
  it('can remove a legacy cover without deleting the source', () =>
    expect(
      articlePayload(
        {
          title: '記事',
          type: 'TABLE',
          body: '本文',
          publish_status: 'draft',
          cover_image: null,
        },
        { cover_image: '/old.jpg' },
      ).cover_image,
    ).toBeNull());
  it('rejects disguised SVG and oversized images', () => {
    expect(checkImage(new TextEncoder().encode('<svg/>'), 'image/png')).toBe(
      false,
    );
    expect(checkImage(new Uint8Array(8388609), 'image/jpeg')).toBe(false);
  });
});
