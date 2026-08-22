import { test, expect } from '@playwright/test';

async function boot(page) {
  await page.goto('/?v=165', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });
  await expect(page.locator('#errorBox')).toBeHidden();
  await expect(page.locator('#scene')).toBeVisible();
}

async function goToMap(page) {
  await page.locator('[data-hotspot-id="camp-next"]').click();
  await expect(page.locator('#game')).toHaveAttribute('data-scene', 'team');
  await page.locator('[data-hotspot-id="team-next"]').click();
  await expect(page.locator('#game')).toHaveAttribute('data-scene', 'map');
}

test('navigation uses object-specific hotspots on the map table', async ({ page }) => {
  await boot(page);
  await goToMap(page);

  await expect(page.locator('[data-hotspot-id="map-paper"]')).toBeVisible();
  await expect(page.locator('[data-hotspot-id="flashlight"]')).toBeVisible();
  await expect(page.locator('[data-hotspot-id="compass"]')).toBeVisible();

  const stage = page.locator('.stage');
  const box = await stage.boundingBox();
  if (!box) throw new Error('Stage has no bounding box');

  // The cup is above the map hotspot. Clicking it must not navigate.
  await page.mouse.click(box.x + box.width * 0.80, box.y + box.height * 0.35);
  await expect(page.locator('#game')).toHaveAttribute('data-scene', 'map');

  await page.locator('[data-hotspot-id="map-paper"]').click();
  await expect(page.locator('#game')).toHaveAttribute('data-scene', 'map-detail');
  await expect(page.locator('#scene')).toHaveCSS('transform', /matrix/);

  await page.locator('[data-hotspot-id="route-mark"]').click();
  await expect(page.locator('#game')).toHaveAttribute('data-scene', 'entrance');
  await page.locator('[data-hotspot-id="entrance-next"]').click();
  await expect(page.locator('#game')).toHaveAttribute('data-scene', 'lab');
});

test('flashlight and compass are collected into the satchel', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('sde-inventory-v1'));
  await boot(page);
  await goToMap(page);

  await page.locator('[data-hotspot-id="flashlight"]').click();
  await expect(page.locator('#toast')).toContainText('Flashlight added to satchel.');

  await page.locator('[data-hotspot-id="compass"]').click();
  await expect(page.locator('#toast')).toContainText('Compass added to satchel.');

  await page.locator('#satchel').click();
  await expect(page.locator('#inventory')).toHaveClass(/open/);
  await expect(page.locator('#inventory [aria-label="Flashlight"]')).toHaveCount(1);
  await expect(page.locator('#inventory [aria-label="Compass"]')).toHaveCount(1);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sde-inventory-v1') || '[]'));
  expect(saved).toEqual(['flashlight', 'compass']);
});

test('back navigation remains linear through the new map detail scene', async ({ page }) => {
  await boot(page);
  await goToMap(page);
  await page.locator('[data-hotspot-id="map-paper"]').click();
  await expect(page.locator('#game')).toHaveAttribute('data-scene', 'map-detail');

  await page.locator('#back').click();
  await expect(page.locator('#game')).toHaveAttribute('data-scene', 'map');
  await page.locator('#back').click();
  await expect(page.locator('#game')).toHaveAttribute('data-scene', 'team');
});