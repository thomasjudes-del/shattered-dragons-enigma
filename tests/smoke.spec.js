import { test, expect } from '@playwright/test';

const PATH = ['camp', 'map', 'team', 'entrance', 'lab'];

async function waitForBoot(page) {
  await page.goto('/?v=100', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#game')).toHaveAttribute('data-assets-ready', 'true', { timeout: 20_000 });
  await expect(page.locator('#game')).toHaveAttribute('data-sprite-width', '1600');
  await expect(page.locator('#game')).toHaveAttribute('data-sprite-height', '4500');
  await expect(page.locator('#game')).toHaveAttribute('data-satchel-width', /3\d\d/);
  await expect(page.locator('#errorBox')).toBeHidden();
}

async function assertVisibleScene(page, id) {
  await expect(page.locator('#game')).toHaveAttribute('data-scene', id);
  const visiblePixels = await page.locator('#sceneCanvas').evaluate(canvas => {
    const ctx = canvas.getContext('2d');
    const points = [
      [200, 180], [800, 180], [1400, 180],
      [200, 450], [800, 450], [1400, 450],
      [200, 720], [800, 720], [1400, 720]
    ];
    return points.filter(([x, y]) => {
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      return r + g + b > 45;
    }).length;
  });
  expect(visiblePixels).toBeGreaterThanOrEqual(3);
}

test('five distinct HD scenes render and point-and-click navigation works', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await waitForBoot(page);
  await assertVisibleScene(page, 'camp');
  await page.screenshot({ path: `test-results/${testInfo.project.name}-camp.png`, fullPage: true });

  for (const id of PATH.slice(1)) {
    const hotspot = page.locator('.scene-hotspot');
    await expect(hotspot).toBeVisible();
    await hotspot.click();
    await expect(page.locator('#game')).toHaveAttribute('data-scene', id);
    await assertVisibleScene(page, id);
  }

  await page.screenshot({ path: `test-results/${testInfo.project.name}-lab.png`, fullPage: true });

  for (const id of PATH.slice(0, -1).reverse()) {
    const back = page.locator('#backBtn');
    await expect(back).toBeVisible();
    await back.click();
    await expect(page.locator('#game')).toHaveAttribute('data-scene', id);
    await assertVisibleScene(page, id);
  }

  expect(errors).toEqual([]);
});

test('satchel and hint are functional and inventory stays hidden by default', async ({ page }) => {
  await waitForBoot(page);
  const satchel = page.locator('#satchelImage');
  await expect(satchel).toBeVisible();
  const size = await satchel.evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight }));
  expect(size.width).toBeGreaterThanOrEqual(300);
  expect(size.height).toBeGreaterThanOrEqual(300);

  await expect(page.locator('#inventory')).not.toHaveClass(/open/);
  await page.locator('#satchelBtn').click();
  await expect(page.locator('#inventory')).toHaveClass(/open/);
  await page.locator('#satchelBtn').click();
  await expect(page.locator('#inventory')).not.toHaveClass(/open/);

  await page.locator('#hintBtn').click();
  await expect(page.locator('#hintToast')).toHaveClass(/show/);
});

test('Meridian-style navigation has no forward arrow or gameplay header', async ({ page }) => {
  await waitForBoot(page);
  await expect(page.locator('.nav-forward')).toHaveCount(0);
  await expect(page.locator('.topbar')).toHaveCount(0);
  await expect(page.locator('#backBtn')).toBeHidden();
  await expect(page.locator('.scene-hotspot')).toHaveCount(1);
});
