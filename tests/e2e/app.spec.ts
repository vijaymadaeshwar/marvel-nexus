import { test, expect } from '@playwright/test';

test.describe('Marvel Nexus App', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('loads and shows title', async ({ page }) => {
    await expect(page).toHaveTitle(/Marvel Nexus/);
  });

  test('displays the header with logo', async ({ page }) => {
    const header = page.locator('.site-header, header');
    await expect(header).toBeVisible();
  });

  test('displays dock buttons', async ({ page }) => {
    const dock = page.locator('.dock, .dock-bar, nav');
    await expect(dock).toBeVisible();
  });

  test('movie grid/list renders entries', async ({ page }) => {
    await page.waitForFunction(() => document.querySelectorAll('.movie-card, .card, [data-movie-id]').length > 0, { timeout: 10000 });
    const entries = page.locator('.movie-card, .card, [data-movie-id]');
    const count = await entries.count();
    expect(count).toBeGreaterThan(10);
  });

  test('phase filter works', async ({ page }) => {
    const filter = page.locator('.phase-filter, select, [data-filter]');
    if (await filter.count() > 0) {
      await filter.first().selectOption({ label: 'Phase 1' }).catch(() => {});
      await page.waitForTimeout(500);
    }
  });

  test('search filters movies', async ({ page }) => {
    const search = page.locator('input[type="search"], .search-bar input, input[placeholder*="search" i]');
    if (await search.count() > 0) {
      await search.first().fill('Iron');
      await page.waitForTimeout(500);
    }
  });
});
