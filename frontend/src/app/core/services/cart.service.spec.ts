/**
 * CartService - Unit Tests
 * 
 * Tests para el servicio de carrito de compras.
 * 
 * Conceptos:
 * - signal() de Angular para estado reactivo
 * - localStorage para items pendientes (guest checkout)
 * - HttpClient mocking con HttpClientTestingModule
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CartService } from './cart.service';
import { Cart, CartItem, CartItemRequest } from '../models/cart.model';
import { AuthService } from './auth.service';
import { environment } from '@env/environment';
import { signal, Signal } from '@angular/core';
import { UserInfo } from '../models/auth.model';

/** Mock AuthService para tests que esperan comportamiento autenticado (HTTP calls). */
class MockAuthService {
  readonly isAuthenticated: Signal<boolean>;
  readonly isAdmin: Signal<boolean>;
  readonly user: Signal<UserInfo | null>;
  private _isAuth = signal(false);
  private _isAdmin = signal(false);
  private _user = signal<UserInfo | null>(null);

  constructor() {
    this.isAuthenticated = this._isAuth.asReadonly();
    this.isAdmin = this._isAdmin.asReadonly();
    this.user = this._user.asReadonly();
  }

  setAuth(value: boolean) { this._isAuth.set(value); }
  setAdmin(value: boolean) { this._isAdmin.set(value); }
  setUser(user: UserInfo | null) { this._user.set(user); }
  logout() {}
}

describe('CartService', () => {
  let service: CartService;
  let httpMock: HttpTestingController;
  let mockAuth: MockAuthService;

  // Mocks de datos de prueba
  const mockCartItem: CartItem = {
    cartItemId: 1,
    productVariantId: 10,
    productName: 'Remera Negra',
    productSlug: 'remera-negra',
    imageUrl: 'https://example.com/image.jpg',
    color: 'Negro',
    size: 'M',
    quantity: 2,
    unitPrice: 5000,
    currencyCode: 'ARS',
    customDesignId: null,
  };

  const mockCart: Cart = {
    cartId: 1,
    items: [mockCartItem],
    totalAmount: 10000,
    currencyCode: 'ARS',
  };

  const mockCartItemRequest: CartItemRequest = {
    productVariantId: 10,
    quantity: 2,
  };

  beforeEach(() => {
    mockAuth = new MockAuthService();
    // Default: autenticado (tests esperan HTTP calls al backend)
    mockAuth.setAuth(true);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CartService,
        { provide: AuthService, useValue: mockAuth },
      ],
    });

    service = TestBed.inject(CartService);
    httpMock = TestBed.inject(HttpTestingController);

    // Limpiamos localStorage y signal antes de cada test
    localStorage.clear();
    service.cart.set(null);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // ==========================================================================
  // TESTS DE CARGA DE CARRITO
  // ==========================================================================

  describe('loadCart()', () => {
    it('debería obtener el carrito del backend', () => {
      service.loadCart().subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/cart`);
      expect(req.request.method).toBe('GET');
      req.flush(mockCart);
    });

    it('debería actualizar el signal cart con los datos recibidos', () => {
      service.loadCart().subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/cart`);
      req.flush(mockCart);

      expect(service.cart()).toEqual(mockCart);
    });

    it('debería manejar carrito vacío', () => {
      const emptyCart: Cart = {
        cartId: 1,
        items: [],
        totalAmount: 0,
        currencyCode: 'ARS',
      };

      service.loadCart().subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/cart`);
      req.flush(emptyCart);

      expect(service.cart()).toEqual(emptyCart);
      expect(service.cart()!.items.length).toBe(0);
    });
  });

  // ==========================================================================
  // TESTS DE AGREGAR ITEM
  // ==========================================================================

  describe('addItem()', () => {
    it('debería hacer POST a /cart/items', () => {
      service.addItem(mockCartItemRequest).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/cart/items`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockCartItemRequest);
    });

    it('debería actualizar el signal cart después de agregar', () => {
      service.addItem(mockCartItemRequest).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/cart/items`);
      req.flush(mockCart);

      expect(service.cart()).toEqual(mockCart);
    });

    it('debería incluir customDesignId si está presente', () => {
      const requestWithDesign: CartItemRequest = {
        productVariantId: 10,
        quantity: 1,
        customDesignId: 5,
      };

      service.addItem(requestWithDesign).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/cart/items`);
      expect(req.request.body).toEqual(requestWithDesign);
      expect(req.request.body.customDesignId).toBe(5);
    });
  });

  // ==========================================================================
  // TESTS DE ACTUALIZAR CANTIDAD
  // ==========================================================================

  describe('updateQuantity()', () => {
    it('debería hacer PATCH a /cart/items/{id}', () => {
      const itemId = 1;
      const newQuantity = 5;

      service.updateQuantity(itemId, newQuantity).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/cart/items/${itemId}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ quantity: newQuantity });
    });

    it('debería actualizar el signal con el carrito modificado', () => {
      const updatedCart: Cart = {
        ...mockCart,
        items: [{ ...mockCartItem, quantity: 5 }],
        totalAmount: 25000,
      };

      service.updateQuantity(1, 5).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/cart/items/1`);
      req.flush(updatedCart);

      expect(service.cart()!.items[0].quantity).toBe(5);
    });

    it('debería manejar cantidad 0 (eliminar item)', () => {
      const emptyCart: Cart = {
        ...mockCart,
        items: [],
        totalAmount: 0,
      };

      service.updateQuantity(1, 0).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/cart/items/1`);
      req.flush(emptyCart);

      expect(service.cart()!.items.length).toBe(0);
    });
  });

  // ==========================================================================
  // TESTS DE ELIMINAR ITEM
  // ==========================================================================

  describe('removeItem()', () => {
    it('debería hacer DELETE a /cart/items/{id}', () => {
      const itemId = 1;

      service.removeItem(itemId).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/cart/items/${itemId}`);
      expect(req.request.method).toBe('DELETE');
    });

    it('debería actualizar el signal sin el item eliminado', () => {
      const cartWithoutItem: Cart = {
        ...mockCart,
        items: [],
        totalAmount: 0,
      };

      service.removeItem(1).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/cart/items/1`);
      req.flush(cartWithoutItem);

      expect(service.cart()!.items.length).toBe(0);
    });
  });

  // ==========================================================================
  // TESTS DE PENDING ITEM (Guest Checkout)
  // ==========================================================================

  describe('savePendingItem()', () => {
    it('debería guardar item en localStorage', () => {
      service.savePendingItem(mockCartItemRequest);

      const stored = localStorage.getItem('pending_cart_item');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(mockCartItemRequest);
    });

    it('debería sobrescribir item pendiente anterior', () => {
      const firstItem: CartItemRequest = { productVariantId: 1, quantity: 1 };
      const secondItem: CartItemRequest = { productVariantId: 2, quantity: 3 };

      service.savePendingItem(firstItem);
      service.savePendingItem(secondItem);

      const stored = JSON.parse(localStorage.getItem('pending_cart_item')!);
      expect(stored.productVariantId).toBe(2);
      expect(stored.quantity).toBe(3);
    });
  });

  describe('getPendingItem()', () => {
    it('debería retornar null si no hay item pendiente', () => {
      expect(service.getPendingItem()).toBeNull();
    });

    it('debería retornar el item guardado', () => {
      service.savePendingItem(mockCartItemRequest);
      const pending = service.getPendingItem();

      expect(pending).toEqual(mockCartItemRequest);
    });

    it('debería manejar JSON inválido en localStorage', () => {
      localStorage.setItem('pending_cart_item', 'not-valid-json');
      const pending = service.getPendingItem();

      expect(pending).toBeNull();
    });
  });

  describe('clearPendingItem()', () => {
    it('debería eliminar el item pendiente', () => {
      service.savePendingItem(mockCartItemRequest);
      expect(service.getPendingItem()).not.toBeNull();

      service.clearPendingItem();

      expect(service.getPendingItem()).toBeNull();
      expect(localStorage.getItem('pending_cart_item')).toBeNull();
    });

    it('debería funcionar aunque no haya item pendiente', () => {
      // No debería tirar error
      expect(() => service.clearPendingItem()).not.toThrow();
    });
  });

  // ==========================================================================
  // TESTS DE INTEGRACIÓN (Pendiente + Auth)
  // ==========================================================================

  describe('Flujo Guest to Auth', () => {
    it('debería permitir guardar item, hacer login, y recuperar item pendiente', () => {
      // Arrange: Usuario guest agrega item
      service.savePendingItem(mockCartItemRequest);

      // Act: Usuario hace login (simulado)
      const pending = service.getPendingItem();

      // Assert: Item pendiente está disponible
      expect(pending).toEqual(mockCartItemRequest);
      expect(pending!.productVariantId).toBe(10);
      expect(pending!.quantity).toBe(2);

      // Cleanup
      service.clearPendingItem();
    });
  });
});
