import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CartComponent } from './cart.component';
import { CartService } from '@core/services/cart.service';
import { ToastService } from '@core/services/toast.service';
import { Cart, CartItem } from '@core/models/cart.model';

describe('CartComponent', () => {
  let component: CartComponent;
  let fixture: ComponentFixture<CartComponent>;
  let cartServiceSpy: jasmine.SpyObj<CartService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  const mockItem: CartItem = {
    cartItemId: 1,
    productVariantId: 10,
    productName: 'Remera Negra',
    productSlug: 'remera-negra',
    imageUrl: 'https://example.com/img.jpg',
    color: 'Negro',
    size: 'M',
    quantity: 2,
    unitPrice: 5000,
    currencyCode: 'ARS',
    customDesignId: null,
  };

  const mockCart: Cart = {
    cartId: 1,
    items: [mockItem],
    totalAmount: 10000,
    currencyCode: 'ARS',
  };

  const emptyCart: Cart = {
    cartId: 1,
    items: [],
    totalAmount: 0,
    currencyCode: 'ARS',
  };

  beforeEach(async () => {
    cartServiceSpy = jasmine.createSpyObj('CartService', ['loadCart', 'removeItem', 'updateQuantity']);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['info', 'error']);

    cartServiceSpy.loadCart.and.returnValue(of(mockCart));

    await TestBed.configureTestingModule({
      imports: [CartComponent],
      providers: [
        provideRouter([]),
        { provide: CartService, useValue: cartServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ─── Initialization ────────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('debería llamar loadCart', () => {
      expect(cartServiceSpy.loadCart).toHaveBeenCalled();
    });

    it('debería asignar cart con los datos recibidos', () => {
      expect(component.cart).toEqual(mockCart);
    });

    it('debería poner loading en false tras cargar', () => {
      expect(component.loading()).toBeFalse();
    });

    it('debería poner loading en false incluso si hay error', fakeAsync(() => {
      cartServiceSpy.loadCart.and.returnValue(throwError(() => new Error('Network error')));

      component.ngOnInit();
      tick();

      expect(component.loading()).toBeFalse();
    }));

    it('debería mostrar estado vacío si el carrito está vacío', fakeAsync(() => {
      cartServiceSpy.loadCart.and.returnValue(of(emptyCart));

      component.ngOnInit();
      tick();
      fixture.detectChanges();

      expect(component.cart?.items.length).toBe(0);
    }));
  });

  // ─── removeItem ────────────────────────────────────────────────────────────

  describe('removeItem()', () => {
    it('debería llamar cartService.removeItem con el itemId correcto', () => {
      cartServiceSpy.removeItem.and.returnValue(of(emptyCart));

      component.removeItem(1);

      expect(cartServiceSpy.removeItem).toHaveBeenCalledWith(1);
    });

    it('debería actualizar el cart tras eliminar el item', fakeAsync(() => {
      cartServiceSpy.removeItem.and.returnValue(of(emptyCart));

      component.removeItem(1);
      tick();

      expect(component.cart).toEqual(emptyCart);
    }));

    it('debería mostrar toast info tras eliminar exitosamente', fakeAsync(() => {
      cartServiceSpy.removeItem.and.returnValue(of(emptyCart));

      component.removeItem(1);
      tick();

      expect(toastServiceSpy.info).toHaveBeenCalledWith('Producto eliminado del carrito');
    }));

    it('debería mostrar toast error si falla la eliminación', fakeAsync(() => {
      cartServiceSpy.removeItem.and.returnValue(throwError(() => new Error('Error')));

      component.removeItem(1);
      tick();

      expect(toastServiceSpy.error).toHaveBeenCalledWith('No se pudo eliminar el producto');
    }));

    it('debería limpiar updatingItem tras eliminar (éxito)', fakeAsync(() => {
      cartServiceSpy.removeItem.and.returnValue(of(emptyCart));

      component.removeItem(1);
      tick();

      expect(component.updatingItem()).toBeNull();
    }));

    it('debería limpiar updatingItem tras eliminar (error)', fakeAsync(() => {
      cartServiceSpy.removeItem.and.returnValue(throwError(() => new Error('Error')));

      component.removeItem(1);
      tick();

      expect(component.updatingItem()).toBeNull();
    }));
  });

  // ─── changeQuantity ────────────────────────────────────────────────────────

  describe('changeQuantity()', () => {
    it('no debería hacer nada si la cantidad no cambia', () => {
      component.changeQuantity(mockItem, mockItem.quantity);

      expect(cartServiceSpy.removeItem).not.toHaveBeenCalled();
      expect(cartServiceSpy.updateQuantity).not.toHaveBeenCalled();
    });

    it('debería llamar removeItem si la nueva qty es 0', () => {
      cartServiceSpy.removeItem.and.returnValue(of(emptyCart));

      component.changeQuantity(mockItem, 0);

      expect(cartServiceSpy.removeItem).toHaveBeenCalledWith(mockItem.cartItemId);
    });

    it('debería llamar removeItem si la nueva qty es negativa', () => {
      cartServiceSpy.removeItem.and.returnValue(of(emptyCart));

      component.changeQuantity(mockItem, -1);

      expect(cartServiceSpy.removeItem).toHaveBeenCalledWith(mockItem.cartItemId);
    });

    it('debería llamar updateQuantity con la nueva cantidad', () => {
      const updatedCart = { ...mockCart, items: [{ ...mockItem, quantity: 5 }], totalAmount: 25000 };
      cartServiceSpy.updateQuantity.and.returnValue(of(updatedCart));

      component.changeQuantity(mockItem, 5);

      expect(cartServiceSpy.updateQuantity).toHaveBeenCalledWith(mockItem.cartItemId, 5);
    });

    it('debería actualizar cart tras cambiar cantidad exitosamente', fakeAsync(() => {
      const updatedCart = { ...mockCart, items: [{ ...mockItem, quantity: 3 }], totalAmount: 15000 };
      cartServiceSpy.updateQuantity.and.returnValue(of(updatedCart));

      component.changeQuantity(mockItem, 3);
      tick();

      expect(component.cart).toEqual(updatedCart);
      expect(component.updatingItem()).toBeNull();
    }));

    it('debería limpiar updatingItem si updateQuantity falla', fakeAsync(() => {
      cartServiceSpy.updateQuantity.and.returnValue(throwError(() => new Error('Error')));

      component.changeQuantity(mockItem, 3);
      tick();

      expect(component.updatingItem()).toBeNull();
    }));
  });

  // ─── colorHex ──────────────────────────────────────────────────────────────

  describe('colorHex()', () => {
    it('debería mapear "negro" a #111827', () => {
      expect(component.colorHex('negro')).toBe('#111827');
    });

    it('debería mapear "blanco" a #f9fafb', () => {
      expect(component.colorHex('blanco')).toBe('#f9fafb');
    });

    it('debería mapear "rojo" a #ef4444', () => {
      expect(component.colorHex('rojo')).toBe('#ef4444');
    });

    it('debería ser case-insensitive', () => {
      expect(component.colorHex('NEGRO')).toBe('#111827');
      expect(component.colorHex('Negro')).toBe('#111827');
    });

    it('debería devolver gris por defecto para colores desconocidos', () => {
      expect(component.colorHex('transparente')).toBe('#9ca3af');
    });
  });

  // ─── FREE_SHIPPING threshold ───────────────────────────────────────────────

  describe('FREE_SHIPPING_THRESHOLD', () => {
    it('debería estar definido en 50000', () => {
      expect(component.FREE_SHIPPING_THRESHOLD).toBe(50000);
    });
  });
});
