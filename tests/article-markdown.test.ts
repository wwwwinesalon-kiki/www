import { expect, it } from 'vitest';
import { markdownToArticle } from '../lib/article-markdown';

it('preserves Markdown structure in article HTML', () => {
  const result = markdownToArticle('# 見出し\n\n本文 **太字**\n\n- ひとつ\n- ふたつ\n\n### 小見出し\n\n次の段落');
  expect(result).toContain('<h2>見出し</h2>');
  expect(result).toContain('<strong>太字</strong>');
  expect(result).toContain('<li>ひとつ</li>');
  expect(result).toContain('<h3>小見出し</h3>');
  expect(result).toContain('<p>次の段落</p>');
});

it('sanitizes unsafe Markdown HTML and external images', () => {
  const result = markdownToArticle('![tracker](https://evil.invalid/a.jpg)\n\n<script>alert(1)</script>\n\n[link](javascript:alert)');
  expect(result).not.toMatch(/<script|<img|href="javascript/);
});
