import { test, expect } from '@playwright/test';

const PATH = ['camp', 'trail', 'anomaly', 'entrance', 'lab'];

async function assertSceneHealthy(page, id) {
  await expect(page.locator('#game')).toHaveAttribute('data-scene', id);
  await expect(page.locator('#assetError')).toBeHidden();

  const image = page.locator('#sceneImage');
  await expect(image).toBeVisible();
  await expect.poll(async () => image.evaluate(img => ({
    complete: img.complete,
    width: img.naturalWidth,
    height: img.naturalHeight
  }))).toEqual({ complete: true, width: 768, height: 768 });

  const src = await image.getAttribute('src');
  expect(src).toMatch(/^\.\/assets\/scenes\/(camp|trail|anomaly|entrance|lab)\.avif\?v=7$/);

  const assetResponse = await page.request.get(new URL(src, page.url()).href);
  expect(assetResponse.ok()).toBeTruthy();
  expect(assetResponse.headers()['content-type']).toContain('image/avif');
  expect((await assetResponse.body()).byteLength).toBeGreaterThan(8000);
}

async function clickDirection(page, direction) {
  const button = page.locator(`.nav-${direction}`);
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await button.click();
}

test('all five scenes decode and full navigation works in both directions', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/', { waitUntil: 'networkidle' });
  await assertSceneHealthy(page, 'camp');
  for (const id of PATH.slice(1)) {
    await clickDirection(page, 'forward');
    await assertSceneHealthy(page, id);
  }
  for (const id of PATH.slice(0, -1).reverse()) {
    await clickDirection(page, 'back');
    await assertSceneHealthy(page, id);
  }
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('inventory and hint controls work', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await assertSceneHealthy(page, 'camp');
  await page.locator('#inventoryBtn').click();
  await expect(page.locator('#inventoryDrawer')).toHaveClass(/open/);
  await expect(page.locator('#inventoryDrawer')).toContainText('INVENTORY');
  await page.locator('#inventoryClose').click();
  await expect(page.locator('#inventoryDrawer')).not.toHaveClass(/open/);
  await page.locator('#hintBtn').click();
  await expect(page.locator('#hintToast')).toHaveClass(/show/);
  await expect(page.locator('#hintToast')).toContainText('biodiversity');
});

test('layout does not horizontally overflow or overlap the header actions', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await assertSceneHealthy(page, 'camp');
  const metrics = await page.evaluate(() => {
    const brand = document.querySelector('.brand').getBoundingClientRect();
    const actions = document.querySelector('.top-actions').getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      headerOverlap: brand.right > actions.left,
      bodyHeight: document.body.getBoundingClientRect().height,
      innerHeight: window.innerHeight
    };
  });
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.headerOverlap).toBeFalsy();
  expect(Math.abs(metrics.bodyHeight - metrics.innerHeight)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: testInfo.outputPath('camp.png'), fullPage: true });

  for (const id of PATH.slice(1)) {
    await clickDirection(page, 'forward');
    await assertSceneHealthy(page, id);
  }
  await page.screenshot({ path: testInfo.outputPath('lab.png'), fullPage: true });
});
