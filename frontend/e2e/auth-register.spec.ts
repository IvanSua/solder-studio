import { test, expect } from '@playwright/test';

/**
 * Auth — registration E2E tests.
 *
 * Tests form validation, field behaviour, and the full registration flow.
 * For the actual account creation test we use a unique timestamped email
 * to avoid conflicts with previous runs.
 */

test.describe('Register — form structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForSelector('form', { timeout: 8_000 });
  });

  test('register form renders all required fields', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('submit with empty fields stays on register page', async ({ page }) => {
    await page.locator('button[type="submit"]').click();

    // Should stay on register / show validation
    await expect(page).toHaveURL(/auth/, { timeout: 5_000 });
  });

  test('submit with invalid email format shows error or stays on page', async ({ page }) => {
    await page.locator('#email').fill('not-an-email');
    await page.locator('#password').fill('SomePass123!');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/auth/, { timeout: 5_000 });
  });

  test('submit with short password shows error or stays on page', async ({ page }) => {
    await page.locator('#email').fill('test@test.com');
    await page.locator('#password').fill('123');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/auth/, { timeout: 5_000 });
  });

  test('password field masks input', async ({ page }) => {
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});

test.describe('Register — form interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForSelector('form', { timeout: 8_000 });
  });

  test('can switch to login from register', async ({ page }) => {
    const loginLink = page.locator('.toggle a');
    await expect(loginLink).toBeVisible();
    await loginLink.click();

    await expect(page).toHaveURL(/auth/, { timeout: 5_000 });
    // Should now show login form
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('newsletter checkbox is present and toggleable', async ({ page }) => {
    const checkbox = page.locator('#newsletterOptIn');
    if (await checkbox.isVisible()) {
      const initial = await checkbox.isChecked();
      await checkbox.click();
      expect(await checkbox.isChecked()).toBe(!initial);
    }
  });

  test('first name and last name fields accept text if present', async ({ page }) => {
    const firstName = page.locator('#firstName');
    const lastName = page.locator('#lastName');

    if (await firstName.isVisible()) {
      await firstName.fill('Juan');
      await expect(firstName).toHaveValue('Juan');
    }

    if (await lastName.isVisible()) {
      await lastName.fill('Pérez');
      await expect(lastName).toHaveValue('Pérez');
    }
  });
});

test.describe('Register — full flow', () => {
  test('registering with a unique email redirects or shows confirmation', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForSelector('form', { timeout: 8_000 });

    // Use timestamp to guarantee a unique email each run
    const uniqueEmail = `e2e.test.${Date.now()}@example.com`;

    const firstName = page.locator('#firstName');
    if (await firstName.isVisible()) await firstName.fill('E2E');

    const lastName = page.locator('#lastName');
    if (await lastName.isVisible()) await lastName.fill('Test');

    await page.locator('#email').fill(uniqueEmail);
    await page.locator('#password').fill('Test1234!');

    await page.locator('button[type="submit"]').click();

    // After successful registration the app should either:
    // (a) redirect away from /auth/register
    // (b) show a success/confirmation message
    // (c) redirect to /auth/login with a success notice
    await page.waitForTimeout(3_000);

    const currentUrl = page.url();
    const leftRegister = !currentUrl.includes('register');
    const successVisible = await page
      .locator('.success-box, [role="alert"], .info-banner')
      .isVisible()
      .catch(() => false);

    expect(leftRegister || successVisible).toBe(true);
  });

  test('registering with an existing email shows a duplicate error', async ({ page }) => {
    // This test requires TEST_USER_EMAIL to be a pre-existing account
    const existingEmail = process.env['TEST_USER_EMAIL'];
    if (!existingEmail) {
      test.skip(true, 'Skipped: TEST_USER_EMAIL not set');
      return;
    }

    await page.goto('/auth/register');
    await page.waitForSelector('form', { timeout: 8_000 });

    const firstName = page.locator('#firstName');
    if (await firstName.isVisible()) await firstName.fill('E2E');

    const lastName = page.locator('#lastName');
    if (await lastName.isVisible()) await lastName.fill('Duplicate');

    await page.locator('#email').fill(existingEmail);
    await page.locator('#password').fill('Test1234!');

    await page.locator('button[type="submit"]').click();

    // Should stay on the page and show an error
    await expect(page).toHaveURL(/auth/, { timeout: 8_000 });
    await expect(
      page.locator('.error, [role="alert"], .alert-danger').first(),
    ).toBeVisible({ timeout: 8_000 });
  });
});
