import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, role = 'member', next = '/member') {
  await page.goto('/member/login?next=' + encodeURIComponent(next));
  await page.getByLabel('メールアドレス', { exact: true }).fill(role + '@review.invalid');
  await page.getByLabel('パスワード', { exact: true }).fill('TestPassword123!');
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(next + '$'));
}

async function alphaAt(page: Page, x: number, y: number) {
  return page.locator('#wine-ripple-canvas').evaluate((element, point) => {
    const canvas = element as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const pixelX = Math.round((point.x - rect.left) * canvas.width / rect.width);
    const pixelY = Math.round((point.y - rect.top) * canvas.height / rect.height);
    return canvas.getContext('2d')!.getImageData(pixelX, pixelY, 1, 1).data[3];
  }, { x, y });
}

test('member tap draws a fading wine ripple while admin has no canvas', async ({ page, browser }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await login(page);
  const heading = page.getByRole('heading', { name: 'ワインのある日々へ' });
  await expect(heading).toBeVisible();
  await expect(page.locator('#wine-ripple-canvas')).toBeVisible();
  const box = (await heading.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  expect(await alphaAt(page, x, y)).toBe(0);
  await heading.click();
  await expect.poll(() => alphaAt(page, x, y), { timeout: 2500, intervals: [50, 100] }).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/member-wine-ripple.png' });
  await expect.poll(() => alphaAt(page, x, y), { timeout: 6000 }).toBe(0);

  const adminContext = await browser.newContext({ baseURL: 'http://localhost:3100' });
  const admin = await adminContext.newPage();
  await login(admin, 'editor', '/admin');
  await expect(admin.getByRole('heading', { name: '記事管理' })).toBeAttached();
  await expect(admin.locator('#wine-ripple-app')).toHaveCount(0);
  await admin.goto('/admin/events');
  await expect(admin.getByRole('heading', { name: 'イベント', exact: true })).toBeVisible();
  await expect(admin.locator('#wine-ripple-app')).toHaveCount(0);
  await expect(admin.getByRole('link', { name: '会員・請求を管理' })).toHaveAttribute(
    'href', 'https://www.kaihipay.jp/admin/top?system_code=9824098600477842',
  );
  await adminContext.close();
});

test('member reduced-motion preference keeps the decorative canvas clear', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  const heading = page.getByRole('heading', { name: 'ワインのある日々へ' });
  await expect(heading).toBeVisible();
  const box = (await heading.boundingBox())!;
  await heading.click();
  // Sample after animation frames would have started, rather than before RAF.
  await page.waitForTimeout(350);
  expect(await alphaAt(page, box.x + box.width / 2, box.y + box.height / 2)).toBe(0);
});
