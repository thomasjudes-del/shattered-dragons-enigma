import { test, expect } from '@playwright/test';

const PATH = ['camp', 'trail', 'anomaly', 'entrance', 'lab'];

async function assertScene(page, id) {
  await expect(page.locator('#game')).toHaveAttribute('data-scene', id);
  await expect(page.locator('#errorBox')).toBeHidden();
  const image = page.locator('#sceneImage');
  await expect(image).toBeVisible();
  await expect.poll(async () => image.evaluate(img => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0)).toBe(true);
}

test('five scenes decode and point-and-click navigation works', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto('/', { waitUntil: 'networkidle' });
  await assertScene(page, 'camp');

  for (const id of PATH.slice(1)) {
    const hotspot = page.locator('.advance-hotspot');
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

test('inventory and hint controls are usable', async ({ page }) => {
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

test('UI uses point-and-click forward navigation and one back control', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.nav-forward')).toHaveCount(0);
  await expect(page.locator('.topbar')).toHaveCount(0);
  await expect(page.locator('#backBtn')).toBeHidden();
  await expect(page.locator('#satchelBtn')).toContainText('KIT');
});