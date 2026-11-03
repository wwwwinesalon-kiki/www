import { test, expect, type Page } from '@playwright/test';
test('Vercel entry opens the protected member entrance', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/member\/login\?next=/);
  await expect(page.getByRole('heading', { name: 'おかえりなさい' })).toBeVisible();
});
async function login(page: Page, role: string, next = '/member') {
  await page.goto('/member/login?next=' + encodeURIComponent(next));
  await page
    .getByLabel('メールアドレス', { exact: true })
    .fill(role + '@review.invalid');
  await page.getByLabel('パスワード', { exact: true }).fill('TestPassword123!');
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'),
  );
}
test('isolated editorial flow and withdrawal across UI/API/images/RLS', async ({
  browser,
  page,
}) => {
  test.setTimeout(360000); // Covers cold Next.js dev compilation across all roles/routes.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page, 'editor', '/admin');
  await page.getByRole('link', { name: '＋ 新規作成' }).click();
  await page
    .getByLabel('タイトル', { exact: true })
    .fill('検証用 ワインの食卓');
  await page
    .getByRole('textbox', { name: '本文', exact: true })
    .evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData(
        'text/html',
        '<h2>検証用の見出し</h2><p>PAID_SECRET 本番には存在しない原稿</p><ul><li>材料</li></ul><table><tr><th>材料</th><th>分量</th></tr><tr><td>野菜</td><td>100g</td></tr></table><p>' +
          '長い文章のテスト'.repeat(100) +
          '</p><script>window.evil=1</script>',
      );
      el.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  await page.getByText('画像を追加・差し替え', { exact: true }).click();
  await page.getByLabel('アップロード画像の説明').fill('検証用の小さな画像');
  await page.getByLabel('画像ファイル', { exact: true }).setInputFiles({
    name: 'test.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByRole('status')).toContainText('画像を保存');
  await page.getByRole('button', { name: '下書き保存', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('下書きとして保存しました');
  const preview = page.getByRole('link', { name: 'プレビュー', exact: true });
  const href = await preview.getAttribute('href');
  const id = href!.split('/').pop()!;
  const memberContext = await browser.newContext({
    baseURL: 'http://localhost:3100',
  });
  const member = await memberContext.newPage();
  await login(member, 'member');
  await expect(
    member.getByRole('heading', { name: 'ワインのある日々へ' }),
  ).toBeVisible();
  await expect(
    member.getByRole('link', { name: /畑のいまを知る/ }),
  ).toBeVisible();
  for (const width of [1280, 1024]) {
    await member.setViewportSize({ width, height: 900 });
    await expect(
      member.getByRole('navigation', { name: '会員モバイルナビゲーション' }),
    ).toBeHidden();
    if (width === 1024) {
      await member.screenshot({ path: 'test-results/member-portal-1024.png' });
    }
    const layout = await member.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowing: Array.from(document.body.querySelectorAll('*'))
        .filter((node) => node.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 8)
        .map((node) => ({
          tag: node.tagName,
          className: String(node.className).slice(0, 100),
          right: Math.round(node.getBoundingClientRect().right),
        })),
    }));
    expect(
      layout.scrollWidth <= layout.viewport + 1,
      `会員ポータルが${width}pxで横にはみ出さない: ${JSON.stringify(layout)}`,
    ).toBe(true);
  }
  await member.setViewportSize({ width: 1280, height: 900 });
  await member.screenshot({
    path: 'test-results/member-portal-desktop.png',
  });
  await member.setViewportSize({ width: 390, height: 844 });
  const mobileNav = member.getByRole('navigation', {
    name: '会員モバイルナビゲーション',
  });
  await expect(mobileNav).toBeVisible();
  const mobileNavBox = await mobileNav.boundingBox();
  expect(
    mobileNavBox?.y,
    '会員モバイルナビは画面下部に固定',
  ).toBeGreaterThan(720);
  expect(
    (mobileNavBox?.y || 0) + (mobileNavBox?.height || 0),
    '会員モバイルナビの下端は画面下端に接する',
  ).toBeGreaterThanOrEqual(843);
  expect(
    await member.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    '会員ポータルが390pxで横にはみ出さない',
  ).toBe(true);
  await member.screenshot({
    path: 'test-results/member-portal-mobile.png',
  });
  await expect(
    member.getByText('検証用 ワインの食卓', { exact: true }),
  ).toHaveCount(0);
  const previewPage = await page.context().newPage();
  await previewPage.goto(href!);
  await expect(
    previewPage.getByText('検証用の見出し', { exact: true }),
  ).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '公開する', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('公開しました');
  await member.reload();
  await member.getByRole('link', { name: /検証用 ワインの食卓/ }).click();
  await expect(
    member.getByText('PAID_SECRET 本番には存在しない原稿', { exact: true }),
  ).toBeVisible();
  const image = member.locator('img.article-cover');
  const imageUrl = await image.getAttribute('src');
  expect((await member.request.get(imageUrl!)).status()).toBe(200);
  await member.setViewportSize({ width: 390, height: 844 });
  await expect(member.getByRole('table')).toBeVisible();
  expect(
    await member.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await member.screenshot({
    path: 'test-results/member-mobile.png',
    fullPage: true,
  });
  const anonymous = await browser.newContext({
    baseURL: 'http://localhost:3100',
  });
  const guest = await anonymous.newPage();
  expect((await guest.request.get('/api/member/articles')).status()).toBe(401);
  expect((await guest.request.get(imageUrl!)).status()).toBe(404);
  const html = await (await guest.request.get('/member/table/' + id)).text();
  expect(html).not.toContain('PAID_SECRET');
  const guestRsc = await guest.request.get('/member/table/' + id, {
    headers: { RSC: '1', 'Next-Router-Prefetch': '1' },
  });
  expect(await guestRsc.text()).not.toContain('PAID_SECRET');
  expect(guestRsc.headers()['cache-control']).toMatch(/no-store|no-cache/);
  const pendingContext = await browser.newContext({
    baseURL: 'http://localhost:3100',
  });
  const pending = await pendingContext.newPage();
  await login(pending, 'pending');
  await expect(
    pending.getByText('ご利用状況の確認が必要です', { exact: true }),
  ).toBeVisible();
  expect((await pending.request.get('/api/member/articles')).status()).toBe(
    403,
  );
  expect((await pending.request.get(imageUrl!)).status()).toBe(404);
  const pendingRsc = await pending.request.get('/member/table/' + id, {
    headers: { RSC: '1' },
  });
  expect(await pendingRsc.text()).not.toContain('PAID_SECRET');
  expect(pendingRsc.headers()['cache-control']).toMatch(/no-store|no-cache/);
  expect(
    (
      await member.request.patch('/api/admin/entity/contents/' + id, {
        data: { title: 'hacked' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await member.request.patch('/api/admin/entity/members/' + id, {
        data: { role: 'owner' },
      })
    ).status(),
  ).toBe(403);
  await page
    .getByRole('button', { name: '公開を取り下げて保存', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveText('下書きとして保存しました');
  const api = await member.request.get('/api/member/articles');
  expect(await api.text()).not.toContain('PAID_SECRET');
  expect((await member.request.get(imageUrl!)).status()).toBe(404);
  await member.reload();
  await expect(
    member.getByText('PAID_SECRET 本番には存在しない原稿', { exact: true }),
  ).toHaveCount(0);
  const viewerContext = await browser.newContext({
    baseURL: 'http://localhost:3100',
  });
  const viewer = await viewerContext.newPage();
  await login(viewer, 'viewer', '/admin');
  await viewer.goto(href!);
  await expect(
    viewer.getByText('PAID_SECRET 本番には存在しない原稿', { exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
  await Promise.all([
    memberContext.close(),
    anonymous.close(),
    pendingContext.close(),
    viewerContext.close(),
  ]);
});
test('failed save retains draft and warns before navigation', async ({
  page,
}) => {
  await login(page, 'editor', '/admin');
  await page.getByRole('link', { name: '＋ 新規作成' }).click();
  await page.getByLabel('タイトル', { exact: true }).fill('失敗しても残る原稿');
  await page
    .getByRole('textbox', { name: '本文', exact: true })
    .fill('この原稿は保持される');
  await page.route('**/api/admin/entity/contents', (r) =>
    r.request().method() === 'POST'
      ? r.fulfill({ status: 500, json: { error: '検証用の保存障害' } })
      : r.continue(),
  );
  await page.getByRole('button', { name: '下書き保存', exact: true }).click();
  await expect(page.locator('.article-shell [role="alert"]')).toContainText(
    '原稿はこの画面に保持',
  );
  await expect(
    page.getByRole('textbox', { name: '本文', exact: true }),
  ).toHaveText('この原稿は保持される');
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('link', { name: '← 記事一覧' }).click();
  await expect(page).toHaveURL(/contents\/new$/);
});
test('Markdown upload and round-trip, multiple WebP images, draft reload and list refresh', async ({ page }) => {
  await login(page, 'editor', '/admin');
  await page.getByRole('link', { name: '＋ 新規作成' }).click();
  const title = 'Markdownと複数画像の検証';
  await page.getByLabel('タイトル', { exact: true }).fill(title);
  const body = page.getByRole('textbox', { name: '本文', exact: true });
  await body.evaluate(el => {
    const dt = new DataTransfer();
    dt.setData('text/plain', '## コピペの見出し\n\n**コピペの太字**');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(body.locator('h2')).toHaveText('コピペの見出し');
  await expect(body.locator('strong')).toHaveText('コピペの太字');
  await page.getByRole('tab', { name: 'Markdown', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('Markdownファイルを読み込む').setInputFiles({
    name: 'article.md', mimeType: 'text/markdown',
    buffer: Buffer.from('## 畑の記録\n\n**余市のぶどう**\n\n- 収穫\n- 醸造\n\n[詳しく](https://example.com/wine(2026))'),
  });
  await expect(page.getByLabel('Markdown本文')).toHaveValue(/畑の記録/);
  await page.getByRole('tab', { name: 'ビジュアル', exact: true }).click();
  await expect(body.locator('h2')).toHaveText('畑の記録');
  await expect(body.locator('strong')).toHaveText('余市のぶどう');
  await expect(body.locator('li')).toHaveCount(2);
  await expect(body.locator('a')).toHaveAttribute('href', 'https://example.com/wine(2026)');
  const headingSize = await body.locator('h2').evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize));
  const paragraphSize = await body.locator('p').first().evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(headingSize).toBeGreaterThan(paragraphSize);
  await page.getByText('画像を追加・差し替え', { exact: true }).click();
  await page.getByLabel('画像を入れる場所').selectOption('body');
  const alt = '画像 [余市] \\収穫';
  await page.getByLabel('アップロード画像の説明').fill(alt);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  await page.getByLabel('画像ファイル', { exact: true }).setInputFiles([
    { name: 'first.png', mimeType: 'image/png', buffer: png },
    { name: 'second.png', mimeType: 'image/png', buffer: png },
  ]);
  await expect(page.getByRole('status')).toContainText('2枚の画像を保存しました');
  await expect(body.locator('img')).toHaveCount(2);
  const urls = await body.locator('img').evaluateAll(images => images.map(image => image.getAttribute('src')!));
  expect(new Set(urls).size).toBe(2);
  for (const url of urls) {
    const image = await page.request.get(url);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/webp');
    const bytes = await image.body();
    expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
  }
  await page.getByRole('tab', { name: 'Markdown', exact: true }).click();
  await expect(page.getByLabel('Markdown本文')).toHaveValue(/\\\[余市\\\]/);
  await page.getByRole('tab', { name: 'プレビュー', exact: true }).click();
  const preview = page.getByRole('tabpanel', { name: 'プレビュー', exact: true });
  await expect(preview.locator('img')).toHaveCount(2);
  await expect(preview.locator('img').first()).toHaveAttribute('alt', alt);
  await expect(preview.locator('a')).toHaveAttribute('href', 'https://example.com/wine(2026)');
  await page.getByRole('button', { name: '下書き保存', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('下書きとして保存しました');
  await expect(page).toHaveURL(/\/admin\/contents\/[a-f0-9-]{36}$/);
  await page.reload();
  await expect(page.getByLabel('タイトル', { exact: true })).toHaveValue(title);
  await expect(body.locator('h2')).toHaveText('畑の記録');
  await expect(body.locator('strong')).toHaveText('余市のぶどう');
  await expect(body.locator('img')).toHaveCount(2);
  await page.getByLabel('タイトル', { exact: true }).fill(title + ' 更新済み');
  await page.getByRole('button', { name: '下書き保存', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('下書きとして保存しました');
  await page.getByRole('link', { name: '← 記事一覧' }).click();
  await expect(page.getByText(title + ' 更新済み', { exact: true })).toBeVisible();
});
test('safe next, reset and verified initial setup (Auth transport simulated)', async ({
  page,
}) => {
  await login(page, 'pending', '/admin');
  await expect(
    page.getByText('このアカウントには管理画面の権限がありません'),
  ).toBeVisible();
  await page.goto('/member/reset');
  await page
    .getByLabel('メールアドレス', { exact: true })
    .fill('member@review.invalid');
  await page.getByRole('button', { name: '再設定メールを送る' }).click();
  await expect(page.getByRole('status')).toContainText('案内を送信');
  await page.goto(
    '/member/auth?token_hash=test-invite&type=invite&next=/member/setup',
  );
  await page
    .getByLabel('新しいパスワード', { exact: true })
    .fill('UpdatedTestPassword123!');
  await page
    .getByLabel('確認用パスワード', { exact: true })
    .fill('UpdatedTestPassword123!');
  await page.getByRole('button', { name: 'パスワードを設定する' }).click();
  await expect(page).toHaveURL(/\/member$/);
  await page.goto('/member/login?next=https://evil.invalid');
  await page
    .getByLabel('メールアドレス', { exact: true })
    .fill('member@review.invalid');
  await page.getByLabel('パスワード', { exact: true }).fill('TestPassword123!');
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:3100/member');
});
