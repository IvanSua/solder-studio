import { Page } from '@playwright/test';

/**
 * Credentials for tests that require an authenticated user.
 * Set TEST_USER_EMAIL and TEST_USER_PASSWORD in your environment.
 *
 * Example .env.e2e:
 *   TEST_USER_EMAIL=test@tienda.com
 *   TEST_USER_PASSWORD=Test1234!
 */
export const TEST_EMAIL = process.env['TEST_USER_EMAIL'] ?? '';
export const TEST_PASSWORD = process.env['TEST_USER_PASSWORD'] ?? '';

/**
 * Returns true when test credentials are provided.
 * Use to skip auth-dependent tests when running without a backend.
 */
export function hasTestCredentials(): boolean {
  return TEST_EMAIL.length > 0 && TEST_PASSWORD.length > 0;
}

/**
 * Logs in as the configured test user and waits for redirect away from login.
 * Throws if credentials are not set in the environment.
 */
export async function loginAs(
  page: Page,
  email = TEST_EMAIL,
  password = TEST_PASSWORD,
): Promise<void> {
  if (!email || !password) {
    throw new Error(
      'Missing TEST_USER_EMAIL or TEST_USER_PASSWORD environment variables. ' +
        'Set them to run authenticated E2E tests.',
    );
  }

  await page.goto('/auth/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();

  // Wait until we leave the login page (redirect to home or wherever)
  await page.waitForURL((url) => !url.toString().includes('login'), {
    timeout: 15_000,
  });
}

/**
 * Clears the cart via the UI — navigates to /carrito and removes all items.
 * Use in afterEach to leave a clean state.
 */
export async function clearCart(page: Page): Promise<void> {
  await page.goto('/carrito');

  // If redirected to login the cart is already empty for this session
  if (page.url().includes('login')) return;

  const removeButtons = page.locator('.remove-btn');
  let count = await removeButtons.count();

  while (count > 0) {
    await removeButtons.first().click();
    await page.waitForTimeout(400); // brief pause for UI to update
    count = await removeButtons.count();
  }
}
