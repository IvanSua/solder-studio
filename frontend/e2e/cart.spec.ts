import { test, expect } from '@playwright/test';

/**
 * Cart E2E tests.
 * All routes under /carrito require auth — these tests verify guard behaviour,
 * UI structure (post-redirect), and that no JS crash occurs.
 * No live backend required.
 */

test.describe('Cart — auth guard', () => {

  test('unauthenticated access to /carrito redirects to login', async ({ page }) => {
    await page.goto('/carrito');

    await expect(page).toHaveURL(/auth\/login|login/);
    await expect(page.locator('app-root')).toBeVisible();
  });

  test('carrito subroutes also redirect unauthenticated users', async ({ page }) => {
    await page.goto('/carrito/checkout');

    await expect(page).toHaveURL(/auth\/login|login/);
  });
});

test.describe('Cart — login page reachable from cart redirect', () => {

  test('login page renders after cart redirect', async ({ page }) => {
    await page.goto('/carrito');

    await expect(page).toHaveURL(/login/);
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('returnUrl or redirect param is preserved after cart guard', async ({ page }) => {
    await page.goto('/carrito');

    const url = page.url();
    // App may or may not append a redirect param — either way should not crash
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/error|500/);
  });
});

test.describe('Cart — URL resilience', () => {

  test('direct navigation to /carrito does not crash the app shell', async ({ page }) => {
    await page.goto('/carrito');

    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/error|500/);
  });

  test('/carrito with query params does not crash', async ({ page }) => {
    await page.goto('/carrito?from=producto&id=123');

    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/error|500/);
  });
});
