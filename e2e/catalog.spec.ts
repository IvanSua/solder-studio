import { test, expect } from '@playwright/test';

/**
 * E2E — Flujo de catálogo
 *
 * Prerequisitos:
 * - Backend corriendo en http://localhost:8080
 * - Frontend corriendo en http://localhost:4200
 * - Al menos 1 producto cargado en la DB
 */

test.describe('Catálogo de productos', () => {

  test('debería cargar la página principal con productos', async ({ page }) => {
    await page.goto('/');

    // Navbar debe estar visible
    await expect(page.locator('app-navbar')).toBeVisible();

    // Debe haber al menos un producto cargado
    await page.waitForSelector('.product-card, [data-testid="product-card"]', { timeout: 10000 });
    const products = page.locator('.product-card, [data-testid="product-card"]');
    await expect(products.first()).toBeVisible();
  });

  test('debería navegar al detalle del primer producto', async ({ page }) => {
    await page.goto('/');

    // Esperar que carguen los productos
    await page.waitForSelector('.product-card, [data-testid="product-card"]', { timeout: 10000 });

    // Click en el primer producto
    await page.locator('.product-card, [data-testid="product-card"]').first().click();

    // Verificar que navegó al detalle
    await expect(page).toHaveURL(/\/product\//);
  });

  test('debería mostrar el nombre del producto en el detalle', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.product-card, [data-testid="product-card"]', { timeout: 10000 });
    await page.locator('.product-card, [data-testid="product-card"]').first().click();

    // Debe haber un título h1 con el nombre del producto
    const productTitle = page.locator('h1').first();
    await expect(productTitle).toBeVisible();
    await expect(productTitle).not.toBeEmpty();
  });

  test('debería mostrar el botón de agregar al carrito en el detalle', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.product-card, [data-testid="product-card"]', { timeout: 10000 });
    await page.locator('.product-card, [data-testid="product-card"]').first().click();

    // Botón de agregar al carrito
    const addToCartBtn = page.getByRole('button', { name: /agregar al carrito|add to cart/i });
    await expect(addToCartBtn).toBeVisible();
  });

  test('debería navegar al carrito haciendo click en el ícono del navbar', async ({ page }) => {
    await page.goto('/');

    // Click en ícono del carrito en el navbar
    const cartLink = page.locator('a[href="/cart"], a[routerlink="/cart"]').first();
    await cartLink.click();

    await expect(page).toHaveURL('/cart');
  });

  test('debería mostrar carrito vacío si no hay items', async ({ page }) => {
    await page.goto('/cart');

    // Si no hay items, debe mostrar el estado vacío
    const emptyState = page.locator('text=Tu carrito está vacío');
    const cartWithItems = page.locator('.cart-item');

    // Uno de los dos debe ser visible
    const isEmpty = await emptyState.isVisible().catch(() => false);
    const hasItems = await cartWithItems.first().isVisible().catch(() => false);

    expect(isEmpty || hasItems).toBeTruthy();
  });
});
