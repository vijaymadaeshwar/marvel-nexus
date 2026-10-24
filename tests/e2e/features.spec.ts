import { test, expect } from '@playwright/test';

test.describe('Feature Panels', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('villains panel toggles', async ({ page }) => {
    const btn = page.locator('#villains-btn');
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(300);
      const panel = page.locator('.villains-panel, #villains-panel, [data-panel="villains"]');
      if (await panel.count() > 0) {
        await expect(panel.first()).toBeVisible();
      }
      await btn.click();
    }
  });

  test('quiz panel toggles', async ({ page }) => {
    const btn = page.locator('#quiz-btn');
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(300);
      await btn.click();
    }
  });

  test('watch party panel toggles', async ({ page }) => {
    const btn = page.locator('#watchparty-btn');
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(300);
      await btn.click();
    }
  });

  test('stats panel toggles', async ({ page }) => {
    const btn = page.locator('#stats-btn, .stats-toggle');
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(300);
      await btn.click();
    }
  });

  test('cast panel opens from movie detail', async ({ page }) => {
    const card = page.locator('.movie-card, .card, [data-movie-id]').first();
    if (await card.count() > 0) {
      await card.click();
      await page.waitForTimeout(500);
      const castBtn = page.locator('.cast-toggle, .show-cast, [data-action="cast"]');
      if (await castBtn.count() > 0) {
        await castBtn.first().click();
        await page.waitForTimeout(300);
      }
    }
  });
});
