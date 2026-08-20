import { test, expect } from '@playwright/test';

const PATH = ['camp', 'trail', 'anomaly', 'entrance', 'lab'];

async function assertSceneHealthy(page, id) {
  await expect(page.locator('#game')).toHaveAttribute('data-scene', id);
  await expect(page.locator('#assetError')).toBeHidden();
  const image = page.locator('#sceneImage');
  await expect(image).toBeVisible();
  await expect.poll(async () => image.evaluate(img => ({ complete: img.complete, width: img.naturalWidth, height: img.naturalHeight }))).toEqual({ complete: true, width: 768, height: 768 });
  const src = await image.getAttribute('src');
  expect(src).toMatch(/^\.\/assets\/scenes\/(camp|trail|anomaly|entrance|lab)\.avif\?v=8$/);
  const assetResponse = await page.request.get(new URL(src, page.url()).href);
  expect(assetResponse.ok()).toBeTruthy();
  expect(assetResponse.headers()['content-type']).toContain('image/avif');
  expect((await assetResponse.body()).byteLength).toBeGreaterThan(8000);
}

async function clickForward(page) {
  const hotspot = page.locator('.scene-hotspot');
  await expect(hotspot).toHaveCount(1);
  await hotspot.click({ position: { x: 20, y: 20 } });
}

async function clickBack(page) {
  const back = page.locator('#backBtn');
  await expect(back).toBeVisible();
  const box = await back.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await back.click();
}

test('five scenes decode and forward movement is point-and-click only', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/?test=v8', { waitUntil: 'networkidle' });
  await assertSceneHealthy(page, 'camp');
  await expect(page.locator('#backBtn')).toBeHidden();
  await expect(page.locator('.nav-forward')).toHaveCount(0);

  for (const id of PATH.slice(1)) {
    await clickForward(page);
    await assertSceneHealthy(page, id);
  }
  await expect(page.locator('.scene-hotspot')).toHaveCount(0);

  for (const id of PATH.slice(0, -1).reverse()) {
    await clickBack(page);
    await assertSceneHealthy(page, id);
  }

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('satchel and hint controls work', async ({ page }) => {
  await page.goto('/?test=v8', { waitUntil: 'networkidle' });
  await assertSceneHealthy(page, 'camp');
  await expect(page.locator('#inventoryBtn')).toBeVisible();
  await expect(page.locator('.satchel')).toBeVisible();
  await page.locator('#inventoryBtn').click();
  await expect(page.locator('#inventoryTray')).toHaveClass(/open/);
  await expect(page.locator('.inventory-slot')).toHaveCount(5);
  await page.locator('#inventoryBtn').click();
  await expect(page.locator('#inventoryTray')).not.toHaveClass(/open/);
  await page.locator('#hintBtn').click();
  await expect(page.locator('#hintToast')).toHaveClass(/show/);
});

test('HUD stays inside viewport', async ({ page }, testInfo) => {
  await page.goto('/?test=v8', { waitUntil: 'networkidle' });
  await assertSceneHealthy(page, 'camp');
  const metrics = await page.evaluate(() => {
    const hint = document.querySelector('#hintBtn').getBoundingClientRect();
    const satchel = document.querySelector('#inventoryBtn').getBoundingClientRect();
    const frame = document.querySelector('.scene-frame').getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      hintInside: hint.left >= 0 && hint.right <= window.innerWidth,
      satchelInside: satchel.left >= 0 && satchel.right <= window.innerWidth,
      frameInside: frame.left >= -1 && frame.right <= window.innerWidth + 1
    };
  });
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.hintInside).toBeTruthy();
  expect(metrics.satchelInside).toBeTruthy();
  expect(metrics.frameInside).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('camp-v8.png'), fullPage: true });
});
