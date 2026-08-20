import { test, expect } from '@playwright/test';

const PATH = ['camp', 'trail', 'anomaly', 'entrance', 'lab'];

async function assertScene(page, id) {
  await expect(page.locator('#game')).toHaveAttribute('data-scene', id);
  await expect(page.locator('#errorBox')).toBeHidden();
  const image = page.locator('#sceneImage');
  await expect(image).toBeVisible();
  const dimensions = await expect.poll(async () => image.evaluate(img => ({
    complete: img.complete,
    width: img.naturalWidth,
    height: img.naturalHeight
  }))).not.toEqual({ complete: false, width: 0, height: 0 });
  const actual = await image.evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight }));
  expect(actual.width).toBeGreaterThanOrEqual(1100);
  expect(actual.height).toBeGreaterThanOrEqual(688);
}

test('five distinct scenes load and point-and-click navigation works', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto('/', { waitUntil: 'networkidle' });
  await assertScene(page, 'camp');

  for (const id of PATH.slice(1)) {
    const hotspot = page.locator('.scene-hotspot');
    await expect(hotspot).toBeVisible();
    await hotspot.click();
    await assertScene(page, id);
  }

  for (const id of PATH.slice(0, -1).reverse()) {
    const back = page.locator('#backBtn');
    await expect(back).toBeVisible();
    await back.click();
    await assertScene(page, id);
  }

  expect(errors).toEqual([]);
});

test('satchel and hint are usable without permanent inventory clutter', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await assertScene(page, 'camp');
  await expect(page.locator('#inventory')).not.toHaveClass(/open/);
  await page.locator('#satchelBtn').click();
  await expect(page.locator('#inventory')).toHaveClass(/open/);
  await page.locator('#satchelBtn').click();
  await expect(page.locator('#inventory')).not.toHaveClass(/open/);
  await page.locator('#hintBtn').click();
  await expect(page.locator('#hintToast')).toHaveClass(/show/);
});

test('no forward arrow or gameplay header is present', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.nav-forward')).toHaveCount(0);
  await expect(page.locator('.topbar')).toHaveCount(0);
  await expect(page.locator('#backBtn')).toBeHidden();
});
