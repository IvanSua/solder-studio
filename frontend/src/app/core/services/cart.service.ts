import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { environment } from '@env/environment';
import { Cart, CartItem, CartItemRequest } from '../models/cart.model';
import { AuthService } from './auth.service';

const GUEST_CART_KEY = 'guest_cart';

/** Minimal cart stored in localStorage for unauthenticated users. */
interface GuestCartItem {
  productVariantId: number;
  quantity: number;
  customDesignId: number | null;
}

interface GuestCart {
  items: GuestCartItem[];
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly apiUrl = `${environment.apiUrl}/cart`;
  private readonly PENDING_KEY = 'pending_cart_item';

  cart = signal<Cart | null>(null);

  loadCart(): Observable<Cart> {
    if (this.auth.isAuthenticated()) {
      return this.http.get<Cart>(this.apiUrl).pipe(
        tap(cart => {
          this.cart.set(cart);
          this.clearGuestCart();
        })
      );
    } else {
      const guest = this.loadGuestFromStorage();
      const cart = this.guestToCart(guest);
      this.cart.set(cart);
      return of(cart);
    }
  }

  addItem(request: CartItemRequest): Observable<Cart> {
    if (this.auth.isAuthenticated()) {
      return this.http.post<Cart>(`${this.apiUrl}/items`, request).pipe(
        tap(cart => {
          this.cart.set(cart);
          this.clearGuestCart();
        })
      );
    } else {
      const guest: GuestCart = this.loadGuestFromStorage();
      const idx = guest.items.findIndex(
        i => i.productVariantId === request.productVariantId &&
             i.customDesignId === (request.customDesignId ?? null)
      );

      if (idx >= 0) {
        guest.items[idx].quantity += request.quantity;
      } else {
        guest.items.push({
          productVariantId: request.productVariantId,
          quantity: request.quantity,
          customDesignId: request.customDesignId ?? null,
        });
      }

      const cart = this.guestToCart(guest);
      this.saveGuest(guest);
      this.cart.set(cart);
      return of(cart);
    }
  }

  updateQuantity(itemId: number, quantity: number): Observable<Cart> {
    if (this.auth.isAuthenticated()) {
      return this.http.patch<Cart>(`${this.apiUrl}/items/${itemId}`, { quantity }).pipe(
        tap(cart => this.cart.set(cart))
      );
    } else {
      const guest: GuestCart = this.loadGuestFromStorage();
      const idx = guest.items.findIndex(i => i.productVariantId === itemId);
      if (idx >= 0) {
        if (quantity <= 0) {
          guest.items.splice(idx, 1);
        } else {
          guest.items[idx].quantity = quantity;
        }
        const cart = this.guestToCart(guest);
        this.saveGuest(guest);
        this.cart.set(cart);
        return of(cart);
      }
      return of(this.cart() ?? this.buildEmptyCart());
    }
  }

  removeItem(itemId: number): Observable<Cart> {
    if (this.auth.isAuthenticated()) {
      return this.http.delete<Cart>(`${this.apiUrl}/items/${itemId}`).pipe(
        tap(cart => this.cart.set(cart))
      );
    } else {
      const guest: GuestCart = this.loadGuestFromStorage();
      guest.items = guest.items.filter(i => i.productVariantId !== itemId);
      const cart = this.guestToCart(guest);
      this.saveGuest(guest);
      this.cart.set(cart);
      return of(cart);
    }
  }

  clearCart(): Observable<void> {
    if (this.auth.isAuthenticated()) {
      return this.http.delete<void>(`${this.apiUrl}`).pipe(
        tap(() => {
          this.cart.set(null);
          this.clearGuestCart();
        })
      );
    } else {
      this.clearGuestCart();
      this.cart.set(this.buildEmptyCart());
      return of(void 0);
    }
  }

  // ── Guest cart helpers ─────────────────────────────────────────────────────────

  private loadGuestFromStorage(): GuestCart {
    if (!isPlatformBrowser(this.platformId)) return { items: [] };
    const data = localStorage.getItem(GUEST_CART_KEY);
    if (!data) return { items: [] };
    try {
      return JSON.parse(data) as GuestCart;
    } catch {
      return { items: [] };
    }
  }

  private guestToCart(guest: GuestCart): Cart {
    const items: CartItem[] = guest.items.map(i => ({
      cartItemId: 0,
      productVariantId: i.productVariantId,
      productName: '',
      productSlug: null,
      imageUrl: null,
      color: '',
      size: '',
      quantity: i.quantity,
      unitPrice: 0,
      currencyCode: 'ARS',
      customDesignId: i.customDesignId,
    }));
    return {
      cartId: 0,
      items,
      totalAmount: 0,
      currencyCode: 'ARS',
    };
  }

  private buildEmptyCart(): Cart {
    return { cartId: 0, items: [], totalAmount: 0, currencyCode: 'ARS' };
  }

  private saveGuest(cart: GuestCart): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  }

  private clearGuestCart(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem(GUEST_CART_KEY);
  }

  // ── Pending item (login redirect) ─────────────────────────────────────────────

  savePendingItem(item: CartItemRequest): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(this.PENDING_KEY, JSON.stringify(item));
  }

  getPendingItem(): CartItemRequest | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const data = localStorage.getItem(this.PENDING_KEY);
    if (!data) return null;
    try { return JSON.parse(data); } catch { return null; }
  }

  clearPendingItem(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem(this.PENDING_KEY);
  }
}
