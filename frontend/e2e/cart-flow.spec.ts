import { test, expect } from '@playwright/test';
import { loginAs, clearCart, hasTestCredentials } from './helpers/auth';

/**
 * Cart flow — functional E2E tests.
 *
 * Tests the real cart operations: add, update quantity, remove.
 * Requires a running backend and valid TEST_USER_EMAIL / TEST_USER_PASSWORD.
 *
 * Each test logs in fresh. afterEach clears the cart to avoid state leakage.
 */

test.describe('Cart — add to cart', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCredentials(), 'Skipped: no TEST_USER_EMAIL / TEST_USER_PASSWORD set');
    await loginAs(page);
  });

  test.afterEach(async ({ page }) => {
    await clearCart(page);
  });

  test('adding a product puts it in the cart', async ({ page }) => {
    // Navigate to catalog and open the first product
    await page.goto('/productos');
    await page.waitForSelector('.product-card-wrapper', { timeout: 10_000 });

    const firstProduct = page.locator('.product-card-wrapper').first();
    await firstProduct.click();

    // Wait for product detail page
    await page.waitForSelector('.btn-cart', { timeout: 10_000 });

    // Select a size if size buttons are visible
    const sizeBtn = page.locator('.size-btn:not(.out-of-stock)').first();
    if (await sizeBtn.isVisible()) {
      await sizeBtn.click();
    }

    // Select a color if color buttons are visible
    const colorBtn = page.locator('.color-btn').first();
    if (await colorBtn.isVisible()) {
      await colorBtn.click();
    }

    // Add to cart
    const addBtn = page.locator('.btn-cart');
    await expect(addBtn).toBeEnabled();
    await addBtn.click();

    // Navigate to cart and verify item appeared
    await page.goto('/carrito');
    await expect(page.locator('.cart-item').first()).toBeVisible({ timeout: 10_000 });
  });

  test('cart shows correct item count after adding', async ({ page }) => {
    await page.goto('/productos');
    await page.waitForSelector('.product-card-wrapper', { timeout: 10_000 });
    await page.locator('.product-card-wrapper').first().click();
    await page.waitForSelector('.btn-cart', { timeout: 10_000 });

    const sizeBtn = page.locator('.size-btn:not(.out-of-stock)').first();
    if (await sizeBtn.isVisible()) await sizeBtn.click();

    const colorBtn = page.locator('.color-btn').first();
    if (await colorBtn.isVisible()) await colorBtn.click();

    await page.locator('.btn-cart').click();

    await page.goto('/carrito');

    // Item count text should reflect 1 product
    const itemCount = page.locator('.item-count');
    await expect(itemCount).toBeVisible({ timeout: 8_000 });
    await expect(itemCount).toContainText('1');
  });
});

test.describe('Cart — quantity management', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCredentials(), 'Skipped: no TEST_USER_EMAIL / TEST_USER_PASSWORD set');
    await loginAs(page);

    // Add a product to have something to work with
    await page.goto('/productos');
    await page.waitForSelector('.product-card-wrapper', { timeout: 10_000 });
    await page.locator('.product-card-wrapper').first().click();
    await page.waitForSelector('.btn-cart', { timeout: 10_000 });

    const sizeBtn = page.locator('.size-btn:not(.out-of-stock)').first();
    if (await sizeBtn.isVisible()) await sizeBtn.click();

    const colorBtn = page.locator('.color-btn').first();
    if (await colorBtn.isVisible()) await colorBtn.click();

    await page.locator('.btn-cart').click();
    await page.goto('/carrito');
    await page.waitForSelector('.cart-item', { timeout: 10_000 });
  });

  test.afterEach(async ({ page }) => {
    await clearCart(page);
  });

  test('increasing quantity updates the displayed count', async ({ page }) => {
    const qtyDisplay = page.locator('.qty-display').first();
    const initialQty = parseInt(await qtyDisplay.innerText(), 10);

    // Click the + button (second .qty-btn in the controls — first is minus)
    const qtyBtns = page.locator('.cart-item').first().locator('.qty-btn');
    await qtyBtns.last().click(); // last = plus (+)

    // Wait for update
    await expect(qtyDisplay).not.toHaveText(String(initialQty), { timeout: 8_000 });
    const newQty = parseInt(await qtyDisplay.innerText(), 10);
    expect(newQty).toBe(initialQty + 1);
  });

  test('decreasing quantity when qty > 1 decrements count', async ({ page }) => {
    const qtyBtns = page.locator('.cart-item').first().locator('.qty-btn');
    const qtyDisplay = page.locator('.qty-display').first();

    // First increase to 2 so we can safely decrease
    await qtyBtns.last().click();
    await expect(qtyDisplay).toHaveText('2', { timeout: 8_000 });

    // Now decrease
    await qtyBtns.first().click();
    await expect(qtyDisplay).toHaveText('1', { timeout: 8_000 });
  });
});

test.describe('Cart — remove items', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCredentials(), 'Skipped: no TEST_USER_EMAIL / TEST_USER_PASSWORD set');
    await loginAs(page);

    await page.goto('/productos');
    await page.waitForSelector('.product-card-wrapper', { timeout: 10_000 });
    await page.locator('.product-card-wrapper').first().click();
    await page.waitForSelector('.btn-cart', { timeout: 10_000 });

    const sizeBtn = page.locator('.size-btn:not(.out-of-stock)').first();
    if (await sizeBtn.isVisible()) await sizeBtn.click();

    const colorBtn = page.locator('.color-btn').first();
    if (await colorBtn.isVisible()) await colorBtn.click();

    await page.locator('.btn-cart').click();
    await page.goto('/carrito');
    await page.waitForSelector('.cart-item', { timeout: 10_000 });
  });

  test('removing the only item shows the empty cart state', async ({ page }) => {
    await page.locator('.remove-btn').first().click();

    await expect(page.locator('.empty-cart')).toBeVisible({ timeout: 10_000 });
  });

  test('checkout button is present when cart has items', async ({ page }) => {
    await expect(page.locator('.checkout-btn')).toBeVisible();
  });

  test('order summary shows total amount', async ({ page }) => {
    await expect(page.locator('.total-amount')).toBeVisible();
    const total = await page.locator('.total-amount').innerText();
    expect(total.length).toBeGreaterThan(0);
  });
});
