import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '@core/services/cart.service';
import { ToastService } from '@core/services/toast.service';
import { Cart, CartItem } from '@core/models/cart.model';
import { PricePipe } from '@shared/pipes/price.pipe';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, PricePipe],
  template: `
    <div class="cart-page">
      <div class="cart-header">
        <a routerLink="/" class="back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Seguir comprando
        </a>
        <h1>Mi carrito
          @if (cart && cart.items.length > 0) {
            <span class="item-count">({{ cart.items.length }} {{ cart.items.length === 1 ? 'producto' : 'productos' }})</span>
          }
        </h1>
      </div>

      @if (loading()) {
        <div class="loading-state">
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-item">
              <div class="skeleton-thumb"></div>
              <div class="skeleton-info">
                <div class="skeleton-line w-60"></div>
                <div class="skeleton-line w-40"></div>
                <div class="skeleton-line w-30"></div>
              </div>
            </div>
          }
        </div>
      } @else if (cart && cart.items.length > 0) {
        <div class="cart-layout">
          <!-- Items list -->
          <div class="cart-items-section">
            @for (item of cart.items; track item.cartItemId) {
              <div class="cart-item" [class.updating]="updatingItem() === item.cartItemId">
                <!-- Thumbnail -->
                <a [routerLink]="item.productSlug ? ['/product', item.productSlug] : null" class="item-thumb-link">
                  @if (item.imageUrl) {
                    <img [src]="item.imageUrl" [alt]="item.productName" class="item-thumb" loading="lazy" />
                  } @else {
                    <div class="item-thumb-placeholder">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </div>
                  }
                </a>

                <!-- Info -->
                <div class="item-details">
                  <a [routerLink]="item.productSlug ? ['/product', item.productSlug] : null" class="item-name">
                    {{ item.productName }}
                  </a>
                  <div class="item-variants">
                    <span class="variant-chip">
                      <span class="color-dot" [style.background]="colorHex(item.color)"></span>
                      {{ item.color }}
                    </span>
                    <span class="variant-chip">Talle {{ item.size }}</span>
                    @if (item.customDesignId) {
                      <span class="variant-chip custom">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        Personalizado
                      </span>
                    }
                  </div>
                  <div class="item-price-mobile">
                    {{ item.unitPrice * item.quantity | price: item.currencyCode }}
                  </div>
                </div>

                <!-- Quantity controls -->
                <div class="quantity-controls">
                  <button
                    class="qty-btn"
                    (click)="changeQuantity(item, item.quantity - 1)"
                    [disabled]="updatingItem() === item.cartItemId"
                    aria-label="Disminuir cantidad">
                    @if (item.quantity === 1) {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    } @else {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    }
                  </button>
                  <span class="qty-display">{{ item.quantity }}</span>
                  <button
                    class="qty-btn"
                    (click)="changeQuantity(item, item.quantity + 1)"
                    [disabled]="updatingItem() === item.cartItemId"
                    aria-label="Aumentar cantidad">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>

                <!-- Subtotal -->
                <div class="item-subtotal">
                  {{ item.unitPrice * item.quantity | price: item.currencyCode }}
                </div>

                <!-- Remove -->
                <button
                  class="remove-btn"
                  (click)="removeItem(item.cartItemId)"
                  [disabled]="updatingItem() === item.cartItemId"
                  aria-label="Eliminar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            }
          </div>

          <!-- Order summary sidebar -->
          <aside class="order-summary">
            <h2 class="summary-title">Resumen del pedido</h2>

            <div class="summary-rows">
              <div class="summary-row">
                <span>Subtotal ({{ cart.items.length }} productos)</span>
                <span>{{ cart.totalAmount | price: cart.currencyCode }}</span>
              </div>
              <div class="summary-row">
                <span>Envío</span>
                <span class="shipping-info">
                  @if (cart.totalAmount >= FREE_SHIPPING_THRESHOLD) {
                    <span class="free-shipping">¡Gratis!</span>
                  } @else {
                    <span class="shipping-pending">A calcular en checkout</span>
                  }
                </span>
              </div>
              @if (cart.totalAmount < FREE_SHIPPING_THRESHOLD) {
                <div class="free-shipping-nudge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Agregá {{ (FREE_SHIPPING_THRESHOLD - cart.totalAmount) | price: cart.currencyCode }} más para envío gratis
                </div>
              }
            </div>

            <div class="summary-total">
              <span>Total</span>
              <span class="total-amount">{{ cart.totalAmount | price: cart.currencyCode }}</span>
            </div>

            <a routerLink="/checkout" class="checkout-btn">
              Ir al checkout
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </a>

            <p class="security-note">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Pago 100% seguro
            </p>
          </aside>
        </div>
      } @else {
        <!-- Empty cart -->
        <div class="empty-cart">
          <div class="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          </div>
          <h2>Tu carrito está vacío</h2>
          <p>Explorá nuestros productos y encontrá algo que te guste.</p>
          <a routerLink="/" class="btn-primary">Ver productos</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .cart-page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    /* Header */
    .cart-header { margin-bottom: 2rem; }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
      transition: color 0.15s;
    }
    .back-link:hover { color: var(--primary); }
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }
    .item-count { font-size: 1rem; font-weight: 400; color: var(--text-muted); }

    /* Layout */
    .cart-layout {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 2rem;
      align-items: start;
    }

    /* Cart items */
    .cart-items-section {
      display: flex;
      flex-direction: column;
      gap: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }

    .cart-item {
      display: grid;
      grid-template-columns: 80px 1fr auto auto auto;
      gap: 1rem;
      align-items: center;
      padding: 1.25rem;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      transition: background 0.15s;
    }
    .cart-item:last-child { border-bottom: none; }
    .cart-item.updating { opacity: 0.6; pointer-events: none; }

    /* Thumbnail */
    .item-thumb-link { display: block; border-radius: 8px; overflow: hidden; flex-shrink: 0; }
    .item-thumb {
      width: 80px;
      height: 80px;
      object-fit: cover;
      display: block;
    }
    .item-thumb-placeholder {
      width: 80px;
      height: 80px;
      background: var(--bg-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
    }

    /* Details */
    .item-details { min-width: 0; }
    .item-name {
      font-weight: 600;
      color: var(--text);
      text-decoration: none;
      font-size: 0.9375rem;
      display: block;
      margin-bottom: 0.4rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .item-name:hover { color: var(--primary); }
    .item-variants {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .variant-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      background: var(--bg-secondary);
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .variant-chip.custom {
      background: rgba(var(--primary-rgb, 99,102,241), 0.1);
      color: var(--primary);
    }
    .color-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 1px solid rgba(0,0,0,0.15);
      flex-shrink: 0;
    }
    .item-price-mobile { display: none; }

    /* Quantity */
    .quantity-controls {
      display: flex;
      align-items: center;
      gap: 0;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    .qty-btn {
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface);
      border: none;
      cursor: pointer;
      color: var(--text);
      transition: background 0.15s, color 0.15s;
    }
    .qty-btn:hover:not(:disabled) { background: var(--bg-secondary); }
    .qty-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .qty-display {
      min-width: 36px;
      text-align: center;
      font-weight: 600;
      font-size: 0.875rem;
      border-left: 1px solid var(--border);
      border-right: 1px solid var(--border);
      height: 34px;
      line-height: 34px;
    }

    /* Subtotal */
    .item-subtotal {
      font-weight: 700;
      font-size: 0.9375rem;
      color: var(--text);
      text-align: right;
      min-width: 90px;
    }

    /* Remove */
    .remove-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-muted);
      padding: 4px;
      border-radius: 4px;
      transition: color 0.15s, background 0.15s;
    }
    .remove-btn:hover:not(:disabled) {
      color: var(--danger);
      background: var(--danger-bg);
    }
    .remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Summary */
    .order-summary {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.5rem;
      position: sticky;
      top: 1.5rem;
    }
    .summary-title {
      font-size: 1.125rem;
      font-weight: 700;
      margin-bottom: 1.25rem;
    }
    .summary-rows { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      font-size: 0.875rem;
      color: var(--text-muted);
    }
    .free-shipping { color: var(--success-text); font-weight: 600; }
    .shipping-pending { font-style: italic; }
    .free-shipping-nudge {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      color: var(--warning-text);
      background: var(--warning-bg);
      border: 1px solid var(--warning-border);
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      margin-top: 0.25rem;
    }
    .summary-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 0;
      border-top: 1px solid var(--border);
      font-weight: 700;
      font-size: 1.0625rem;
      margin-bottom: 1.25rem;
    }
    .total-amount { font-size: 1.25rem; }
    .checkout-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      width: 100%;
      padding: 0.875rem;
      background: var(--primary);
      color: white;
      border-radius: var(--radius);
      font-weight: 600;
      font-size: 1rem;
      text-decoration: none;
      transition: opacity 0.15s;
    }
    .checkout-btn:hover { opacity: 0.9; }
    .security-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.875rem;
    }

    /* Empty state */
    .empty-cart {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 5rem 2rem;
      text-align: center;
    }
    .empty-icon {
      color: var(--text-muted);
      margin-bottom: 1.5rem;
      opacity: 0.5;
    }
    .empty-cart h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
    .empty-cart p { color: var(--text-muted); margin-bottom: 1.5rem; }
    .btn-primary {
      padding: 0.75rem 2rem;
      background: var(--primary);
      color: white;
      border-radius: var(--radius);
      font-weight: 600;
      text-decoration: none;
      transition: opacity 0.15s;
    }
    .btn-primary:hover { opacity: 0.9; }

    /* Skeleton */
    .loading-state { display: flex; flex-direction: column; gap: 1px; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .skeleton-item {
      display: flex;
      gap: 1rem;
      padding: 1.25rem;
      background: var(--surface);
    }
    .skeleton-thumb {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      background: linear-gradient(90deg, var(--border) 25%, var(--bg-secondary) 50%, var(--border) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      flex-shrink: 0;
    }
    .skeleton-info { flex: 1; display: flex; flex-direction: column; gap: 0.5rem; justify-content: center; }
    .skeleton-line {
      height: 12px;
      border-radius: 4px;
      background: linear-gradient(90deg, var(--border) 25%, var(--bg-secondary) 50%, var(--border) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    .w-60 { width: 60%; }
    .w-40 { width: 40%; }
    .w-30 { width: 30%; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Responsive */
    @media (max-width: 768px) {
      .cart-layout { grid-template-columns: 1fr; }
      .cart-item { grid-template-columns: 72px 1fr auto; grid-template-rows: auto auto; gap: 0.75rem; }
      .item-thumb, .item-thumb-placeholder { width: 72px; height: 72px; }
      .item-subtotal { display: none; }
      .item-price-mobile {
        display: block;
        font-weight: 700;
        font-size: 0.875rem;
        color: var(--text);
        margin-top: 0.35rem;
      }
      .remove-btn { grid-column: 3; grid-row: 1; align-self: start; }
      .quantity-controls { grid-column: 2 / 4; }
      .order-summary { position: static; }
    }
  `],
})
export class CartComponent implements OnInit {
  private cartService = inject(CartService);
  private toast = inject(ToastService);

  cart: Cart | null = null;
  loading = signal(true);
  updatingItem = signal<number | null>(null);

  readonly FREE_SHIPPING_THRESHOLD = 50000;

  ngOnInit(): void {
    this.cartService.loadCart().subscribe({
      next: cart => {
        this.cart = cart;
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  changeQuantity(item: CartItem, newQty: number): void {
    if (newQty === item.quantity) return;
    this.updatingItem.set(item.cartItemId);

    if (newQty <= 0) {
      this.cartService.removeItem(item.cartItemId).subscribe({
        next: cart => { this.cart = cart; this.updatingItem.set(null); },
        error: () => this.updatingItem.set(null),
      });
    } else {
      this.cartService.updateQuantity(item.cartItemId, newQty).subscribe({
        next: cart => { this.cart = cart; this.updatingItem.set(null); },
        error: () => this.updatingItem.set(null),
      });
    }
  }

  removeItem(itemId: number): void {
    this.updatingItem.set(itemId);
    this.cartService.removeItem(itemId).subscribe({
      next: cart => {
        this.cart = cart;
        this.updatingItem.set(null);
        this.toast.info('Producto eliminado del carrito');
      },
      error: () => {
        this.updatingItem.set(null);
        this.toast.error('No se pudo eliminar el producto');
      },
    });
  }

  /** Maps common Spanish color names to CSS hex values for the color dot. */
  colorHex(colorName: string): string {
    const map: Record<string, string> = {
      negro: '#111827', blanco: '#f9fafb',
      rojo: '#ef4444', azul: '#e020c8', verde: '#22c55e',
      amarillo: '#eab308', naranja: '#f97316', rosa: '#ec4899',
      violeta: '#8b5cf6', gris: '#9ca3af', marron: '#92400e',
      beige: '#d4a574', celeste: '#7dd3fc',
      white: '#f9fafb', black: '#111827', red: '#ef4444',
      blue: '#e020c8', green: '#22c55e',
    };
    return map[colorName.toLowerCase()] ?? '#9ca3af';
  }
}
