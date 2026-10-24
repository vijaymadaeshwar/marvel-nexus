import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('no duplicate IDs', async ({ page }) => {
    const ids = await page.evaluate(() => {
      const elements = document.querySelectorAll('[id]');
      const seen = new Set<string>();
      const dupes: string[] = [];
      elements.forEach(el => {
        if (seen.has(el.id)) dupes.push(el.id);
        seen.add(el.id);
      });
      return dupes;
    });
    expect(ids).toEqual([]);
  });

  test('images have alt text', async ({ page }) => {
    await page.waitForFunction(() => document.querySelectorAll('img').length > 0, { timeout: 5000 });
    const missing = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .filter(img => !img.alt && !img.getAttribute('aria-hidden'))
        .map(img => img.src);
    });
    expect(missing).toEqual([]);
  });

  test('interactive elements are keyboard accessible', async ({ page }) => {
    const issues = await page.evaluate(() => {
      const interactive = document.querySelectorAll('button, a, input, select, [role="button"], [tabindex]');
      const problems: string[] = [];
      interactive.forEach(el => {
        const tabindex = el.getAttribute('tabindex');
        if (tabindex && parseInt(tabindex) < 0 && el.tagName !== 'INPUT') {
          problems.push(`${el.tagName}#${el.id || el.className} has tabindex="${tabindex}"`);
        }
      });
      return problems;
    });
    expect(issues).toEqual([]);
  });

  test('color contrast: text is not invisible', async ({ page }) => {
    const lowContrast = await page.evaluate(() => {
      const elements = document.querySelectorAll('p, span, a, button, h1, h2, h3, h4, h5, h6, label');
      const issues: string[] = [];
      elements.forEach(el => {
        const style = getComputedStyle(el);
        const color = style.color;
        const bg = style.backgroundColor;
        if (color === bg && color !== 'rgba(0, 0, 0, 0)') {
          issues.push(`${el.tagName}: color=${color} bg=${bg}`);
        }
      });
      return issues;
    });
    expect(lowContrast).toEqual([]);
  });

  test('skip links or landmarks exist', async ({ page }) => {
    const hasLandmarks = await page.evaluate(() => {
      return document.querySelectorAll('main, [role="main"], nav, [role="navigation"], header, [role="banner"]').length > 0;
    });
    expect(hasLandmarks).toBe(true);
  });

  test('no horizontal scroll on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHScroll).toBe(false);
  });
});
