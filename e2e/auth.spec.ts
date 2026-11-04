import { test, expect } from '@playwright/test';

/**
 * E2E — Flujo de autenticación
 *
 * Prerequisitos:
 * - Backend corriendo en http://localhost:8080
 * - Frontend corriendo en http://localhost:4200
 *
 * Para el test de login exitoso, configurar las variables:
 *   TEST_USER_EMAIL y TEST_USER_PASSWORD (usuario existente en la DB)
 *   Ej: set TEST_USER_EMAIL=test@test.com && set TEST_USER_PASSWORD=test12345
 */

const TEST_EMAIL = process.env['TEST_USER_EMAIL'] || '';
const TEST_PASSWORD = process.env['TEST_USER_PASSWORD'] || '';

test.describe('Autenticación', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('h2')).toContainText('Iniciar Sesión');
  });

  // ─── UI básica ─────────────────────────────────────────────────────────────

  test('debería mostrar el formulario de login por defecto', async ({ page }) => {
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
    await expect(page.getByRole('button', { name: /Ingresar/i })).toBeVisible();
  });

  test('debería cambiar a vista de registro al clickear el link', async ({ page }) => {
    await page.getByText('Registrate').click();

    await expect(page.locator('h2')).toContainText('Crear cuenta');
    await expect(page.getByLabel('Nombre')).toBeVisible();
    await expect(page.getByLabel('Apellido')).toBeVisible();
  });

  test('debería mostrar formulario de recuperar contraseña', async ({ page }) => {
    await page.getByText('¿Olvidaste tu contraseña?').click();

    await expect(page.locator('h2')).toContainText('Recuperar contraseña');
    await expect(page.getByRole('button', { name: /Enviar enlace/i })).toBeVisible();
  });

  test('debería volver al login desde recuperar contraseña', async ({ page }) => {
    await page.getByText('¿Olvidaste tu contraseña?').click();
    await page.getByText('← Volver al inicio de sesión').click();

    await expect(page.locator('h2')).toContainText('Iniciar Sesión');
  });

  // ─── Login con credenciales inválidas ─────────────────────────────────────

  test('debería mostrar error con credenciales inválidas', async ({ page }) => {
    await page.getByLabel('Email').fill('noexiste@test.com');
    await page.getByLabel('Contraseña').fill('wrongpassword');
    await page.getByRole('button', { name: /Ingresar/i }).click();

    // Esperar respuesta del backend
    await expect(page.locator('.error')).toBeVisible({ timeout: 5000 });
  });

  test('el botón de submit debería deshabilitarse durante la carga', async ({ page }) => {
    await page.getByLabel('Email').fill('test@test.com');
    await page.getByLabel('Contraseña').fill('somepassword');

    const submitBtn = page.getByRole('button', { name: /Ingresar/i });

    // Interceptar la request para que tarde en responder
    await page.route('**/api/auth/login', async route => {
      await new Promise(r => setTimeout(r, 500));
      await route.abort();
    });

    await submitBtn.click();
    await expect(submitBtn).toBeDisabled();
  });

  // ─── Login exitoso (requiere usuario de prueba en DB) ─────────────────────

  test('debería navegar a "/" tras login exitoso', async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'TEST_USER_EMAIL y TEST_USER_PASSWORD no configurados');

    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByLabel('Contraseña').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /Ingresar/i }).click();

    await expect(page).toHaveURL('/', { timeout: 5000 });
  });

  // ─── Forgot password ───────────────────────────────────────────────────────

  test('debería mostrar mensaje de éxito tras enviar forgot password', async ({ page }) => {
    await page.getByText('¿Olvidaste tu contraseña?').click();
    await page.getByLabel('Tu email').fill('alguien@test.com');
    await page.getByRole('button', { name: /Enviar enlace/i }).click();

    // Backend siempre responde con éxito (evita user enumeration)
    await expect(page.locator('.success-box, text=Si el email existe')).toBeVisible({ timeout: 5000 });
  });
});
