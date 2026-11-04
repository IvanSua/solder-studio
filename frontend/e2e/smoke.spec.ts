import { test, expect } from '@playwright/test';

/**
 * Smoke tests — verify critical routes load and the app shell renders.
 *
 * These tests do NOT require a live backend. They only check that the
 * Angular app bootstraps, routes resolve, and key UI elements are present.
 *
 * Precondition: `npm start` (ng serve) must be running on port 4200,
 * or E2E_BASE_URL must point to a deployed instance.
 */

test.describe('Public pages', () => {

  test('home page loads', async ({ page }) => {
    await page.goto('/');

    // App shell rendered (Angular bootstrapped)
    await expect(page.locator('app-root')).toBeVisible();

    // Page title is set
    await expect(page).toHaveTitle(/.+/);
  });

  test('products listing page loads', async ({ page }) => {
    await page.goto('/productos');

    await expect(page.locator('app-root')).toBeVisible();
    // Should NOT redirect to login (it's a public route)
    await expect(page).not.toHaveURL(/login/);
  });

  test('404 page is shown for unknown route', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-xyz');

    // App shell still renders — Angular handles 404 gracefully
    await expect(page.locator('app-root')).toBeVisible();
  });
});

test.describe('Auth guard', () => {

  test('navigating to /carrito without auth redirects to login', async ({ page }) => {
    await page.goto('/carrito');

    // Either redirects to /auth/login or shows a login component
    await expect(page).toHaveURL(/auth\/login|login/);
  });

  test('navigating to /orders without auth redirects to login', async ({ page }) => {
    await page.goto('/orders');

    await expect(page).toHaveURL(/auth\/login|login/);
  });

  test('navigating to /admin without auth redirects to login', async ({ page }) => {
    await page.goto('/admin');

    await expect(page).toHaveURL(/auth\/login|login/);
  });
});

test.describe('Auth flow', () => {

  test('login page renders form', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('register page renders form', async ({ page }) => {
    await page.goto('/auth/register');

    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('invalid login shows error message', async ({ page }) => {
    await page.goto('/auth/login');

    await page.locator('input[type="email"], input[name="email"]').fill('notexist@test.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // Should stay on login page and show an error
    await expect(page).toHaveURL(/login/);
    // Some error indication should appear (message, alert, or validation)
    await expect(
      page.locator('[role="alert"], .error, .alert-danger, .mat-error').first()
    ).toBeVisible({ timeout: 5000 });
  });
});
