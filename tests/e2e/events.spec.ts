import { test, expect, type Page } from '@playwright/test';
test.use({ actionTimeout: 30000 });

async function login(page: Page, role: string, next = '/admin/events') {
  await page.goto('/member/login?next=' + encodeURIComponent(next));
  await page
    .getByLabel('メールアドレス', { exact: true })
    .fill(role + '@review.invalid');
  await page.getByLabel('パスワード', { exact: true }).fill('TestPassword123!');
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(next + '$'));
}

test('events retain the editor through draft, publish, edit and soft deletion', async ({
  page,
  browser,
}) => {
  test.setTimeout(360000);
  await login(page, 'editor');
  await expect(page.locator('#wine-ripple-canvas')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: '会員・請求を管理' }),
  ).toHaveAttribute('href', /kaihipay\.jp\/admin\/top/);
  await page.getByRole('button', { name: '＋ 新規作成', exact: true }).click();
  let form = page.getByRole('form', {
    name: 'イベントの新規作成',
    exact: true,
  });
  await form.getByLabel('イベント名', { exact: true }).fill('検証用 NOMIKAI');
  await form.getByLabel('URL名', { exact: true }).fill('test-nomikai-workflow');
  await form
    .getByLabel('開始日時（日本時間）', { exact: true })
    .fill('2026-12-10T18:00');
  await form
    .getByLabel('終了日時（日本時間）', { exact: true })
    .fill('2026-12-10T20:00');
  await form.getByLabel('会場', { exact: true }).fill('KiKi');
  await form.getByLabel('参加費（円）', { exact: true }).fill('1000');
  await form.getByRole('button', { name: '下書き保存', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('下書きとして保存しました');
  form = page.getByRole('form', { name: 'イベントの編集', exact: true });
  await expect(
    form.getByRole('button', { name: '公開する', exact: true }),
  ).toBeVisible();
  await expect(
    form.getByLabel('開始日時（日本時間）', { exact: true }),
  ).toHaveValue('2026-12-10T18:00');
  await form.getByRole('button', { name: '公開する', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('イベントを公開しました');
  await expect(
    page.getByRole('row').filter({ hasText: 'test-nomikai-workflow' }),
  ).toContainText('公開中');
  const previewHref = await form
    .getByRole('link', { name: '会員向け表示を確認' })
    .getAttribute('href');
  const preview = await page.context().newPage();
  await preview.goto(previewHref!);
  await expect(
    preview.getByRole('heading', { name: '検証用 NOMIKAI', exact: true }),
  ).toBeVisible();
  await expect(preview.getByText(/18:00/)).toBeVisible();
  await preview.close();
  await expect(
    form.getByRole('button', { name: '変更を保存', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/admin-event-published.png',
    fullPage: true,
  });
  await form
    .getByLabel('イベント名', { exact: true })
    .fill('検証用 NOMIKAI 更新済み');
  await form.getByRole('button', { name: '変更を保存', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('変更を保存しました');
  await page.reload();
  const row = page
    .getByRole('row')
    .filter({ hasText: 'test-nomikai-workflow' });
  await expect(row).toContainText('検証用 NOMIKAI 更新済み');
  form = page.getByRole('form', { name: 'イベントの編集', exact: true });
  await expect(form).toBeVisible();
  await expect(
    form.getByLabel('開始日時（日本時間）', { exact: true }),
  ).toHaveValue('2026-12-10T18:00');
  await expect(form.getByLabel('参加費（円）', { exact: true })).toHaveValue(
    '1000',
  );
  await form
    .getByRole('button', { name: '非公開にして保存', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveText('下書きとして保存しました');
  await expect(row).toContainText('下書き');
  await form.getByRole('button', { name: '削除する', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText(
    '申込の記録は保持されます',
  );
  await form
    .getByRole('button', { name: '削除を確定する', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveText('イベントを削除しました');
  await page.reload();
  await expect(row).toHaveCount(0);

  const viewerContext = await browser.newContext({
    baseURL: 'http://localhost:3100',
  });
  const viewer = await viewerContext.newPage();
  await login(viewer, 'viewer');
  await expect(
    viewer.getByRole('button', { name: '＋ 新規作成', exact: true }),
  ).toHaveCount(0);
  const denied = await viewer.request.post('/api/admin/entity/events', {
    data: {},
  });
  expect(denied.status()).toBe(403);
  await viewerContext.close();

  const memberContext = await browser.newContext({
    baseURL: 'http://localhost:3100',
  });
  const member = await memberContext.newPage();
  await login(member, 'member', '/member');
  await expect(member.locator('#wine-ripple-canvas')).toHaveCount(1);
  await member.mouse.click(170, 220);
  await member.waitForTimeout(450);
  await member.screenshot({ path: 'test-results/member-ripple-restored.png' });
  await memberContext.close();
});
