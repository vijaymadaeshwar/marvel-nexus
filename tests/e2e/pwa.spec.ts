import { test, expect } from '@playwright/test';

test.describe('PWA Features', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('service worker registers', async ({ page }) => {
    await page.waitForTimeout(2000);
    const swReady = await page.evaluate(async () => {
      if (!navigator.serviceWorker) return false;
      const reg = await navigator.serviceWorker.ready;
      return !!reg;
    });
    expect(swReady).toBe(true);
  });

  test('manifest.webmanifest is accessible', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest.name || manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
  });

  test('has theme color meta tag', async ({ page }) => {
    const themeColor = await page.getAttribute('meta[name="theme-color"]', 'content');
    expect(themeColor).toBeTruthy();
  });

  test('has apple touch icon', async ({ page }) => {
    const icon = await page.getAttribute('link[rel="apple-touch-icon"]', 'href');
    expect(icon).toBeTruthy();
  });
});
