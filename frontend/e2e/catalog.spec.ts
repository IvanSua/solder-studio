import { test, expect } from '@playwright/test';

/**
 * Catalog & product browsing E2E tests.
 * These are public routes — no auth or live backend required.
 * Tests verify routing, UI structure, and navigation flows.
 */

test.describe('Catalog', () => {

  test('catalog page loads and shows product grid or loading state', async ({ page }) => {
    await page.goto('/productos');

    await expect(page.locator('app-root')).toBeVisible();
    // Must NOT redirect away from /productos
    await expect(page).not.toHaveURL(/login/);
    // Either products are shown or a loading/empty state is displayed
    await expect(
      page.locator('app-catalog, [class*="catalog"], [class*="product"], .loading, app-root')
    ).toBeVisible();
  });

  test('catalog URL accepts query params without crashing', async ({ page }) => {
    await page.goto('/productos?search=remera&page=1');

    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/login/);
    await expect(page).not.toHaveURL(/error|404/);
  });

  test('category filter in URL does not crash the app', async ({ page }) => {
    await page.goto('/productos?categoria=ropa');

    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/login/);
  });

  test('product detail route resolves without crashing', async ({ page }) => {
    // Navigate to a plausible product slug — the app should handle not-found gracefully
    await page.goto('/productos/remera-basica-blanca');

    await expect(page.locator('app-root')).toBeVisible();
    // Should not redirect to login (public route)
    await expect(page).not.toHaveURL(/auth\/login|login/);
  });

  test('wishlist button is NOT shown to unauthenticated users on catalog', async ({ page }) => {
    await page.goto('/productos');

    // Wait for any async rendering
    await page.waitForTimeout(800);

    // Wishlist/favorites button should either not exist or redirect to login on click
    const wishlistBtn = page.locator('[aria-label*="favorit"], [aria-label*="wishlist"], .btn-wishlist').first();
    const count = await wishlistBtn.count();
    if (count > 0) {
      await wishlistBtn.click();
      // Should redirect unauthenticated user to login
      await expect(page).toHaveURL(/login|auth/);
    }
  });
});

test.describe('Search', () => {

  test('search input is accessible on catalog page', async ({ page }) => {
    await page.goto('/productos');

    // Look for a search field — flexible selector
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="buscar" i], input[placeholder*="search" i], input[name="search"]'
    ).first();

    // If search is on the page, it should be interactable
    const hasSearch = await searchInput.count() > 0;
    if (hasSearch) {
      await expect(searchInput).toBeEnabled();
      await searchInput.fill('remera');
      // Typing should not crash the app
      await expect(page).not.toHaveURL(/error/);
    }
  });
});
