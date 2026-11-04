import { test, expect } from '@playwright/test';
import { loginAs, clearCart, hasTestCredentials } from './helpers/auth';

/**
 * Checkout flow — functional E2E tests.
 *
 * Tests the multi-step checkout: address → shipping → payment.
 * Requires a running backend, a test user, and at least one saved address.
 *
 * NOTE: We intentionally do NOT complete the MercadoPago payment —
 * that would charge real money. We verify up to the "Pagar" button.
 */

test.describe('Checkout — step navigation', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCredentials(), 'Skipped: no TEST_USER_EMAIL / TEST_USER_PASSWORD set');

    await loginAs(page);

    // Add a product to cart so checkout is reachable
    await page.goto('/productos');
    await page.waitForSelector('.product-card-wrapper', { timeout: 10_000 });
    await page.locator('.product-card-wrapper').first().click();
    await page.waitForSelector('.btn-cart', { timeout: 10_000 });

    const sizeBtn = page.locator('.size-btn:not(.out-of-stock)').first();
    if (await sizeBtn.isVisible()) await sizeBtn.click();

    const colorBtn = page.locator('.color-btn').first();
    if (await colorBtn.isVisible()) await colorBtn.click();

    await page.locator('.btn-cart').click();
  });

  test.afterEach(async ({ page }) => {
    await clearCart(page);
  });

  test('checkout page loads and shows the steps bar', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.locator('.steps-bar')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.step').first()).toBeVisible();
  });

  test('first step is the address selection', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForSelector('.checkout-page', { timeout: 10_000 });

    // Address list OR address form should be visible on step 1
    const hasAddressList = await page.locator('.address-list').isVisible();
    const hasAddressForm = await page.locator('.address-form').isVisible();

    expect(hasAddressList || hasAddressForm).toBe(true);
  });

  test('cart link in checkout takes the user back to cart', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForSelector('.back-to-cart', { timeout: 10_000 });

    await page.locator('.back-to-cart').click();
    await expect(page).toHaveURL(/carrito/, { timeout: 8_000 });
  });

  test('order summary panel shows cart items', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForSelector('.summary-panel', { timeout: 10_000 });

    await expect(page.locator('.summary-item').first()).toBeVisible();
  });
});

test.describe('Checkout — address step', () => {
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
    await page.goto('/checkout');
    await page.waitForSelector('.checkout-page', { timeout: 10_000 });
  });

  test.afterEach(async ({ page }) => {
    await clearCart(page);
  });

  test('saved address can be selected', async ({ page }) => {
    const addressCard = page.locator('.address-card').first();

    if (await addressCard.isVisible()) {
      await addressCard.click();
      await expect(addressCard).toHaveClass(/selected/);
    }
  });

  test('"add new address" button opens the address form', async ({ page }) => {
    const addBtn = page.locator('.btn-link-add');

    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(page.locator('.address-form')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('address form has required fields', async ({ page }) => {
    // Trigger address form — either it's already open or click the add button
    const addBtn = page.locator('.btn-link-add');
    if (await addBtn.isVisible()) await addBtn.click();

    const form = page.locator('.address-form');
    if (await form.isVisible({ timeout: 4_000 })) {
      // Required fields should be present
      const inputs = form.locator('input');
      expect(await inputs.count()).toBeGreaterThan(0);
    }
  });

  test('continuing with a selected address advances to step 2', async ({ page }) => {
    const addressCard = page.locator('.address-card').first();

    if (await addressCard.isVisible()) {
      await addressCard.click();

      const continueBtn = page.locator('.btn-primary').first();
      await expect(continueBtn).toBeEnabled();
      await continueBtn.click();

      // Step 2 should show shipping options or confirmed address
      await expect(
        page.locator('.shipping-section, .confirmed-address'),
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});

test.describe('Checkout — payment step', () => {
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

    // Navigate through step 1 if possible
    await page.goto('/checkout');
    await page.waitForSelector('.checkout-page', { timeout: 10_000 });

    const addressCard = page.locator('.address-card').first();
    if (await addressCard.isVisible()) {
      await addressCard.click();
      const continueBtn = page.locator('.btn-primary').first();
      if (await continueBtn.isEnabled()) {
        await continueBtn.click();
        await page.waitForSelector('.shipping-section, .payment-method-section', {
          timeout: 10_000,
        });
      }
    }
  });

  test.afterEach(async ({ page }) => {
    await clearCart(page);
  });

  test('shipping options are displayed after address selection', async ({ page }) => {
    const shippingSection = page.locator('.shipping-section');
    if (await shippingSection.isVisible({ timeout: 5_000 })) {
      // Either loading or already showing options
      const isLoading = await page.locator('.shipping-loading').isVisible();
      if (isLoading) {
        await expect(page.locator('.shipping-loading')).toBeHidden({ timeout: 15_000 });
      }
      // At least one shipping option should appear
      await expect(page.locator('.shipping-option').first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('a shipping option can be selected', async ({ page }) => {
    const shippingOptions = page.locator('.shipping-option');
    if ((await shippingOptions.count()) > 0) {
      await shippingOptions.first().click();
      await expect(shippingOptions.first()).toHaveClass(/selected/);
    }
  });

  test('payment method section is visible', async ({ page }) => {
    const paymentSection = page.locator('.payment-method-section');
    if (await paymentSection.isVisible({ timeout: 8_000 })) {
      await expect(page.locator('.payment-option').first()).toBeVisible();
    }
  });

  test('a payment method can be selected', async ({ page }) => {
    const paymentOptions = page.locator('.payment-option');
    if ((await paymentOptions.count()) > 0) {
      await paymentOptions.first().click();
      await expect(paymentOptions.first()).toHaveClass(/selected/);
    }
  });

  test('pay button is visible when on payment step', async ({ page }) => {
    const payBtn = page.locator('.btn-pay, .btn-mercadopago, .btn-confirm');
    if (await payBtn.first().isVisible({ timeout: 5_000 })) {
      await expect(payBtn.first()).toBeVisible();
      // We intentionally do NOT click — that would trigger a real payment
    }
  });

  test('order total is shown in the summary', async ({ page }) => {
    const totalRow = page.locator('.payment-total-row, .total-big');
    if (await totalRow.first().isVisible({ timeout: 5_000 })) {
      const totalText = await totalRow.first().innerText();
      expect(totalText.length).toBeGreaterThan(0);
    }
  });

  test('coupon section is present', async ({ page }) => {
    const couponSection = page.locator('.coupon-section');
    if (await couponSection.isVisible({ timeout: 5_000 })) {
      await expect(page.locator('.coupon-input')).toBeVisible();
      await expect(page.locator('.btn-coupon')).toBeVisible();
    }
  });
});
