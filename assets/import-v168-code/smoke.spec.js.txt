import { test, expect } from '@playwright/test';

const hotspot = id => `.hotspot[data-hotspot-id="${id}"]`;

async function waitForScene(page, id) {
  await expect(page.locator('#game')).toHaveAttribute('data-scene', id);
}

async function goToMap(page) {
  await page.locator(hotspot('camp-next')).click();
  await waitForScene(page, 'team');
  await page.locator(hotspot('team-next')).click();
  await waitForScene(page, 'map');
}

test('V168 object pickups, map inspection and reset', async ({ page }) => {
  await page.goto('/?v=168&reset=1');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.inventory-icon')).toHaveCount(0);

  await goToMap(page);
  await expect(page.locator('#scene')).toHaveAttribute('src', /map-table-base-hd\.avif/);
  await expect(page.locator('.scene-prop-compass')).toHaveCount(1);
  await expect(page.locator('.scene-prop-flashlight')).toHaveCount(1);
  await expect(page.locator(hotspot('compass'))).toHaveCount(1);
  await expect(page.locator(hotspot('flashlight'))).toHaveCount(1);

  const stage = await page.locator('.stage').boundingBox();
  if (!stage) throw new Error('Stage has no bounding box');
  await page.mouse.click(stage.x + stage.width * 0.74, stage.y + stage.height * 0.34);
  await waitForScene(page, 'map');

  await page.locator(hotspot('compass')).click();
  await expect(page.locator('.scene-prop-compass')).toHaveCount(0);
  await expect(page.locator(hotspot('compass'))).toHaveCount(0);
  await expect(page.locator('.inventory-icon')).toHaveCount(1);
  await expect(page.locator('.inventory-slot').first()).toHaveAttribute('aria-label', 'Compass');

  await page.reload();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.inventory-icon')).toHaveCount(1);
  await goToMap(page);
  await expect(page.locator('.scene-prop-compass')).toHaveCount(0);
  await expect(page.locator(hotspot('compass'))).toHaveCount(0);
  await expect(page.locator('.scene-prop-flashlight')).toHaveCount(1);
  await expect(page.locator(hotspot('flashlight'))).toHaveCount(1);

  await page.locator(hotspot('flashlight')).click();
  await expect(page.locator('.scene-prop-flashlight')).toHaveCount(0);
  await expect(page.locator(hotspot('flashlight'))).toHaveCount(0);
  await expect(page.locator('.inventory-icon')).toHaveCount(2);

  await page.locator(hotspot('map-paper')).click();
  await waitForScene(page, 'map-detail');
  await expect(page.locator('#scene')).toHaveAttribute('src', /map-detail-hd\.avif/);
  expect(await page.locator('#scene').evaluate(el => el.style.transform)).toBe('none');

  await page.locator(hotspot('route-mark')).click();
  await waitForScene(page, 'entrance');
  await page.locator(hotspot('entrance-next')).click();
  await waitForScene(page, 'lab');
  await page.locator('#back').click();
  await waitForScene(page, 'entrance');

  await page.goto('/?v=168&reset=1');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.inventory-icon')).toHaveCount(0);
  const storage = await page.evaluate(() => ({
    v1: localStorage.getItem('sde-inventory-v1'),
    v2: localStorage.getItem('sde-inventory-v2')
  }));
  expect(storage.v1).toBeNull();
  expect(storage.v2).toBeNull();

  await goToMap(page);
  await expect(page.locator('.scene-prop-compass')).toHaveCount(1);
  await expect(page.locator('.scene-prop-flashlight')).toHaveCount(1);
});
