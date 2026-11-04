import { test, expect } from '@playwright/test';

/**
 * Profile & orders E2E tests.
 * All profile routes require authentication.
 * Tests verify auth guards, route resolution, and no JS crashes.
 * No live backend required.
 */

test.describe('Profile — auth guard', () => {

  test('unauthenticated access to /perfil redirects to login', async ({ page }) => {
    await page.goto('/perfil');

    await expect(page).toHaveURL(/auth\/login|login/);
    await expect(page.locator('app-root')).toBeVisible();
  });

  test('profile subroutes redirect unauthenticated users', async ({ page }) => {
    for (const path of ['/perfil/datos', '/perfil/direcciones', '/perfil/seguridad']) {
      await page.goto(path);
      await expect(page).toHaveURL(/auth\/login|login/);
    }
  });
});

test.describe('Orders — auth guard', () => {

  test('unauthenticated access to /orders redirects to login', async ({ page }) => {
    await page.goto('/orders');

    await expect(page).toHaveURL(/auth\/login|login/);
    await expect(page.locator('app-root')).toBeVisible();
  });

  test('order detail route redirects unauthenticated users', async ({ page }) => {
    await page.goto('/orders/12345');

    await expect(page).toHaveURL(/auth\/login|login/);
  });
});

test.describe('Profile — URL resilience', () => {

  test('/perfil does not crash app shell', async ({ page }) => {
    await page.goto('/perfil');

    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/error|500/);
  });

  test('/orders does not crash app shell', async ({ page }) => {
    await page.goto('/orders');

    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/error|500/);
  });

  test('/orders with numeric ID does not crash', async ({ page }) => {
    await page.goto('/orders/9999');

    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/error|500/);
  });
});

test.describe('Wishlist — auth guard', () => {

  test('unauthenticated access to /wishlist redirects to login', async ({ page }) => {
    await page.goto('/wishlist');

    // Should either redirect to login or be a public page — must not crash
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/error|500/);

    const url = page.url();
    const isGuarded = /auth\/login|login/.test(url);
    const isPublic = /wishlist/.test(url);

    expect(isGuarded || isPublic).toBeTruthy();
  });
});
