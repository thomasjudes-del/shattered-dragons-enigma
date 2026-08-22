import { test, expect } from '@playwright/test';

async function boot(page) {
  await page.goto('?v=167', { waitUntil: 'domcontentloaded' });
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

test('map table has precise semantic hotspots and a dedicated frontal map scene', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('sde-inventory-v1'));
  await boot(page);
  await goToMap(page);

  await expect(page.locator('#scene')).toHaveAttribute('src', /map-table-base-hd\.avif/);
  await expect(page.locator('[data-hotspot-id="map-paper"]')).toBeVisible();
  await expect(page.locator('[data-hotspot-id="flashlight"] .scene-item-flashlight')).toBeVisible();
  await expect(page.locator('[data-hotspot-id="compass"] .scene-item-compass')).toBeVisible();

  const stage = page.locator('.stage');
  const box = await stage.boundingBox();
  if (!box) throw new Error('Stage has no bounding box');
  await page.mouse.click(box.x + box.width * 0.80, box.y + box.height * 0.35);
  await expect(page.locator('#game')).toHaveAttribute('data-scene', 'map');

  await page.locator('[data-hotspot-id="map-paper"]').click();
  await expect(page.locator('#game')).toHaveAttribute('data-scene', 'map-detail');
  await expect(page.locator('#scene')).toHaveAttribute('src', /map-detail-hd\.avif/);
  await expect(page.locator('#scene')).toHaveCSS('transform', 'none');

  await page.locator('[data-hotspot-id="route-mark"]').click();
  await expect(page.locator('#game')).toHaveAttribute('data-scene', 'entrance');
  await page.locator('[data-hotspot-id="entrance-next"]').click();
  await expect(page.locator('#game')).toHaveAttribute('data-scene', 'lab');
});

test('pickups disappear from the table and reuse their real images in the satchel', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('sde-inventory-v1'));
  await boot(page);
  await goToMap(page);

  await page.locator('[data-hotspot-id="flashlight"]').click();
  await expect(page.locator('[data-hotspot-id="flashlight"]')).toHaveCount(0);
  await expect(page.locator('[data-hotspot-id="compass"]')).toHaveCount(1);

  await page.locator('[data-hotspot-id="compass"]').click();
  await expect(page.locator('[data-hotspot-id="compass"]')).toHaveCount(0);
  await expect(page.locator('[data-hotspot-id="flashlight"]')).toHaveCount(0);

  await page.locator('#satchel').click();
  const flashlight = page.locator('#inventory [aria-label="Flashlight"] img');
  const compass = page.locator('#inventory [aria-label="Compass"] img');
  await expect(flashlight).toHaveAttribute('src', /flashlight\.webp/);
  await expect(compass).toHaveAttribute('src', /compass\.webp/);
  await expect(flashlight).toBeVisible();
  await expect(compass).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sde-inventory-v1') || '[]'));
  expect(saved).toEqual(['flashlight', 'compass']);
});

test('pickup state persists and collected objects stay absent after reload and back navigation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sde-inventory-v1', JSON.stringify(['compass'])));
  await boot(page);
  await goToMap(page);
  await expect(page.locator('[data-hotspot-id="compass"]')).toHaveCount(0);
  await expect(page.locator('[data-hotspot-id="flashlight"]')).toHaveCount(1);

  await page.locator('[data-hotspot-id="map-paper"]').click();
  await page.locator('#back').click();
  await expect(page.locator('#game')).toHaveAttribute('data-scene', 'map');
  await expect(page.locator('[data-hotspot-id="compass"]')).toHaveCount(0);
  await expect(page.locator('[data-hotspot-id="flashlight"]')).toHaveCount(1);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });
  await goToMap(page);
  await expect(page.locator('[data-hotspot-id="compass"]')).toHaveCount(0);
});