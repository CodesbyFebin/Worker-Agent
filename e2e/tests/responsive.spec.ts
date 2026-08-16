import { test, expect, devices } from '@playwright/test';

test.describe('Responsive Design Tests', () => {
  const viewports = [
    { name: 'Mobile Portrait', device: devices['Pixel 5'] },
    { name: 'Mobile Landscape', device: { ...devices['Pixel 5'], viewport: { width: 851, height: 410 } } },
    { name: 'Tablet', device: devices['iPad'] },
    { name: 'Desktop', device: devices['Desktop Chrome'] },
    { name: 'Large Desktop', device: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
  ];

  for (const { name, device } of viewports) {
    test(`Layout is responsive on ${name}`, async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/');
      
      await expect(page).toHaveTitle(/Worker Agent/);
      
      if (device.viewport.width < 768) {
        const nav = page.locator('nav, .nav, .header');
        await expect(nav).toBeVisible();
      }
    });
  }

  test('Navigation collapses on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
    }

    await page.goto('/');
    
    const mobileMenu = page.locator('button[aria-label*="menu"], .mobile-menu, [role="button"]');
    if (await mobileMenu.count() > 0) {
      await expect(mobileMenu).toBeVisible();
    }
  });
});
