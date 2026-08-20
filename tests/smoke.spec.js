import { test, expect } from '@playwright/test';

const forward = ['trail', 'anomaly', 'entrance', 'lab'];
const backward = ['entrance', 'anomaly', 'trail', 'camp'];

test('five-scene loop, images, controls and satchel work', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto('/?test=1', { waitUntil: 'networkidle' });
  await expect(page.locator('#game')).toHaveAttribute('data-scene', 'camp');

  const assertImage = async () => {
    const size = await page.locator('#sceneImage').evaluate(img => [img.naturalWidth, img.naturalHeight, img.complete]);
    expect(size[2]).toBe(true);
    expect(size[0]).toBeGreaterThanOrEqual(1000);
    expect(size[1]).toBeGreaterThanOrEqual(600);
  };

  await assertImage();
  for (const scene of forward) {
    await page.locator('.arrow-forward').click();
    await expect(page.locator('#game')).toHaveAttribute('data-scene', scene);
    await assertImage();
  }

  for (const scene of backward) {
    await page.locator('.arrow-back').click();
    await expect(page.locator('#game')).toHaveAttribute('data-scene', scene);
    await assertImage();
  }

  await page.locator('#satchelButton').click();
  await expect(page.locator('#satchel')).toHaveClass(/open/);
  await page.locator('#satchelClose').click();
  await expect(page.locator('#satchel')).not.toHaveClass(/open/);

  await page.locator('#hintButton').click();
  await expect(page.locator('#toast')).toHaveClass(/show/);

  const targets = await page.locator('.arrow, .hud-button').evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect();
    return [r.width, r.height];
  }));
  for (const [width, height] of targets) {
    expect(width).toBeGreaterThanOrEqual(42);
    expect(height).toBeGreaterThanOrEqual(42);
  }

  expect(errors, errors.join('\n')).toEqual([]);
});
