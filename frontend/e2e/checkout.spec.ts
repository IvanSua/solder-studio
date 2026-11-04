import { test, expect } from '@playwright/test';

/**
 * Checkout E2E tests.
 * Checkout is an authenticated, multi-step flow. These tests verify:
 * - Auth guards work correctly
 * - Login page is functional at each step entry point
 * - No crashes on direct navigation or URL manipulation
 * No live backend required.
 */

test.describe('Checkout — auth guard', () => {

  test('unauthenticated access to checkout redirects to login', async ({ page }) => {
    await page.goto('/checkout');

    await expect(page).toHaveURL(/auth\/login|login/);
    await expect(page.locator('app-root')).toBeVisible();
  });

  test('checkout step routes redirect unauthenticated users', async ({ page }) => {
    for (const path of ['/checkout/envio', '/checkout/pago', '/checkout/confirmacion']) {
      await page.goto(path);
      await expect(page).toHaveURL(/auth\/login|login/);
    }
  });
});

test.describe('Checkout — URL resilience', () => {

  test('navigating to /checkout does not crash app shell', async ({ page }) => {
    await page.goto('/checkout');

    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/error|500/);
  });

  test('/checkout with order query params does not crash', async ({ page }) => {
    await page.goto('/checkout?orderId=999&step=pago');

    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/error|500/);
  });
});

test.describe('Checkout — success / failure landing pages', () => {

  test('/checkout/success route resolves without crashing', async ({ page }) => {
    await page.goto('/checkout/success');

    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/error|500/);
    // Either shows success content or redirects — no crash
  });

  test('/checkout/failure route resolves without crashing', async ({ page }) => {
    await page.goto('/checkout/failure');

    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/error|500/);
  });

  test('/checkout/pending route resolves without crashing', async ({ page }) => {
    await page.goto('/checkout/pending');

    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/error|500/);
  });
});
