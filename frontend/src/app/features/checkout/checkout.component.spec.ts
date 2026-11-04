import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';

import { CheckoutComponent } from './checkout.component';
import { CartService } from '@core/services/cart.service';
import { OrderService } from '@core/services/order.service';
import { AddressService } from '@core/services/address.service';
import { Cart } from '@core/models/cart.model';
import { Address } from '@core/models/address.model';
import { CheckoutResponse } from '@core/models/order.model';

describe('CheckoutComponent', () => {
  let component: CheckoutComponent;
  let fixture: ComponentFixture<CheckoutComponent>;
  let cartServiceSpy: jasmine.SpyObj<CartService>;
  let orderServiceSpy: jasmine.SpyObj<OrderService>;
  let addressServiceSpy: jasmine.SpyObj<AddressService>;
  let httpMock: HttpTestingController;

  const mockCart: Cart = {
    cartId: 1,
    items: [
      {
        cartItemId: 1,
        productVariantId: 10,
        productName: 'Remera Negra',
        productSlug: 'remera-negra',
        imageUrl: null,
        color: 'Negro',
        size: 'M',
        quantity: 2,
        unitPrice: 5000,
        currencyCode: 'ARS',
        customDesignId: null,
      },
    ],
    totalAmount: 10000,
    currencyCode: 'ARS',
  };

  const mockAddresses: Address[] = [
    {
      id: 1,
      street: 'Av. Corrientes 1234',
      apartment: '',
      city: 'CABA',
      province: 'Buenos Aires',
      postalCode: '1043',
      notes: '',
      defaultAddress: true,
    },
  ];

  beforeEach(async () => {
    cartServiceSpy = jasmine.createSpyObj('CartService', ['loadCart'], {
      cart: { set: jasmine.createSpy('set') },
    });
    orderServiceSpy = jasmine.createSpyObj('OrderService', ['checkout']);
    addressServiceSpy = jasmine.createSpyObj('AddressService', ['getAddresses', 'createAddress']);

    cartServiceSpy.loadCart.and.returnValue(of(mockCart));
    addressServiceSpy.getAddresses.and.returnValue(of(mockAddresses));

    await TestBed.configureTestingModule({
      imports: [CheckoutComponent, HttpClientTestingModule],
      providers: [
        provideRouter([]),
        { provide: CartService, useValue: cartServiceSpy },
        { provide: OrderService, useValue: orderServiceSpy },
        { provide: AddressService, useValue: addressServiceSpy },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CheckoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // Flush any HTTP requests fired during ngOnInit (e.g. loyalty-preview, shipping)
    httpMock.match(() => true).forEach(req => req.flush(null));
  });

  afterEach(() => {
    fixture.destroy();
    httpMock.verify();
    // The idempotency key lives in sessionStorage (survives page reloads by
    // design) — clear it between specs so tests don't leak state into each other.
    sessionStorage.removeItem('checkout_idempotency_key');
  });

  // ─── ngOnInit ──────────────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('debería cargar el carrito al iniciar', () => {
      expect(cartServiceSpy.loadCart).toHaveBeenCalled();
      expect(component.cart()).toEqual(mockCart);
    });

    it('debería cargar las direcciones al iniciar', () => {
      expect(addressServiceSpy.getAddresses).toHaveBeenCalled();
      expect(component.addresses()).toEqual(mockAddresses);
    });

    it('debería preseleccionar la dirección por defecto', () => {
      expect(component.selectedAddressId()).toBe(1);
    });

    it('debería poner loading en false tras cargar', () => {
      expect(component.loading()).toBeFalse();
    });

    it('debería poner loading en false si las direcciones fallan', fakeAsync(() => {
      addressServiceSpy.getAddresses.and.returnValue(throwError(() => new Error('Error')));

      component.ngOnInit();
      tick();
      // ngOnInit also fires loadLoyaltyPreview() via HTTP — flush it to avoid afterEach verify() failure
      httpMock.match(() => true).forEach(req => req.flush(null));

      expect(component.loading()).toBeFalse();
    }));

    it('debería iniciar en el paso "address"', () => {
      expect(component.step()).toBe('address');
    });
  });

  // ─── isAddressFormValid ────────────────────────────────────────────────────

  describe('isAddressFormValid()', () => {
    it('debería devolver false si el formulario está vacío', () => {
      expect(component.isAddressFormValid()).toBeFalse();
    });

    it('debería devolver true con todos los campos requeridos', () => {
      component.newAddress = {
        street: 'Calle Falsa 123',
        apartment: '',
        city: 'Córdoba',
        province: 'Córdoba',
        postalCode: '5000',
        notes: '',
        defaultAddress: false,
      };

      expect(component.isAddressFormValid()).toBeTrue();
    });

    it('debería devolver false si falta la ciudad', () => {
      component.newAddress = {
        street: 'Calle Falsa 123',
        apartment: '',
        city: '',
        province: 'Córdoba',
        postalCode: '5000',
        notes: '',
        defaultAddress: false,
      };

      expect(component.isAddressFormValid()).toBeFalse();
    });

    it('debería tratar campos con solo espacios como inválidos', () => {
      component.newAddress = {
        street: '   ',
        apartment: '',
        city: 'Córdoba',
        province: 'Córdoba',
        postalCode: '5000',
        notes: '',
        defaultAddress: false,
      };

      expect(component.isAddressFormValid()).toBeFalse();
    });
  });

  // ─── goToPayment ───────────────────────────────────────────────────────────

  describe('goToPayment()', () => {
    it('debería cambiar el step a "payment" si hay dirección seleccionada', () => {
      component.selectedAddressId.set(1);

      component.goToPayment();
      // goToPayment() fires a shipping/calculate HTTP request — flush it before afterEach verify()
      httpMock.match(() => true).forEach(req => req.flush(null));

      expect(component.step()).toBe('payment');
    });

    it('no debería cambiar el step si no hay dirección seleccionada', () => {
      component.selectedAddressId.set(null);

      component.goToPayment();

      expect(component.step()).toBe('address');
    });
  });

  // ─── effectiveTotal ────────────────────────────────────────────────────────

  describe('effectiveTotal()', () => {
    it('debería devolver el total del carrito sin descuento', () => {
      component.cart.set(mockCart);
      component.couponApplied.set(null);

      expect(component.effectiveTotal()).toBe(10000);
    });

    it('debería devolver el total menos el descuento del cupón', () => {
      component.cart.set(mockCart);
      component.couponApplied.set({ valid: true, message: 'OK', discountAmount: 1000, promotionName: 'Test' });

      expect(component.effectiveTotal()).toBe(9000);
    });

    it('no debería devolver valores negativos si el descuento supera el total', () => {
      component.cart.set(mockCart);
      component.couponApplied.set({ valid: true, message: 'OK', discountAmount: 99999, promotionName: 'Test' });

      expect(component.effectiveTotal()).toBe(0);
    });

    it('debería devolver 0 si el carrito es null', () => {
      component.cart.set(null);

      expect(component.effectiveTotal()).toBe(0);
    });
  });

  // ─── removeCoupon ─────────────────────────────────────────────────────────

  describe('removeCoupon()', () => {
    it('debería limpiar el cupón aplicado', () => {
      component.couponApplied.set({ valid: true, message: 'OK', discountAmount: 1000, promotionName: 'Test' });
      component.couponCode = 'PROMO10';

      component.removeCoupon();

      expect(component.couponApplied()).toBeNull();
      expect(component.couponCode).toBe('');
      expect(component.couponError()).toBe('');
    });
  });

  // ─── startCheckout ────────────────────────────────────────────────────────

  describe('startCheckout()', () => {
    beforeEach(() => {
      component.selectedAddressId.set(1);
      component.paymentMethod.set('TRANSFER');
    });

    it('no debería hacer nada si no hay carrito', () => {
      component.cart.set(null);

      component.startCheckout();

      expect(orderServiceSpy.checkout).not.toHaveBeenCalled();
    });

    it('no debería hacer nada si no hay dirección seleccionada', () => {
      component.selectedAddressId.set(null);

      component.startCheckout();

      expect(orderServiceSpy.checkout).not.toHaveBeenCalled();
    });

    it('debería llamar orderService.checkout con los datos correctos', () => {
      // Usamos un Subject que nunca emite para que window.location.href nunca se ejecute.
      // checkout() es llamado sincrónicamente antes de que el observable emita.
      const pending$ = new Subject<CheckoutResponse>();
      orderServiceSpy.checkout.and.returnValue(pending$.asObservable());

      component.startCheckout();

      expect(orderServiceSpy.checkout).toHaveBeenCalledWith(jasmine.objectContaining({
        cartId: 1,
        shippingAddressId: 1,
        paymentMethod: 'TRANSFER',
        installments: 1,
      }));
    });

    it('debería mostrar errorMessage si startCheckout falla', fakeAsync(() => {
      orderServiceSpy.checkout.and.returnValue(throwError(() => ({
        error: { error: 'Reserva de stock expirada' },
      })));

      component.startCheckout();
      tick();

      expect(component.errorMessage()).toBe('Reserva de stock expirada');
      expect(component.processing()).toBeFalse();
    }));

    it('debería mostrar mensaje por defecto si el error no tiene body', fakeAsync(() => {
      orderServiceSpy.checkout.and.returnValue(throwError(() => ({})));

      component.startCheckout();
      tick();

      expect(component.errorMessage()).toBe('Error al procesar el checkout');
    }));

    it('debería enviar un idempotencyKey en el request', () => {
      orderServiceSpy.checkout.and.returnValue(new Subject<CheckoutResponse>().asObservable());

      component.startCheckout();

      const sent = orderServiceSpy.checkout.calls.mostRecent().args[0];
      expect(sent.idempotencyKey).toBeTruthy();
    });

    it('debería reusar el mismo idempotencyKey si se reintenta tras un error de red', fakeAsync(() => {
      orderServiceSpy.checkout.and.returnValue(throwError(() => ({ error: { error: 'Network error' } })));

      component.startCheckout();
      tick();
      const firstKey = orderServiceSpy.checkout.calls.first().args[0].idempotencyKey;

      component.startCheckout();
      tick();
      const secondKey = orderServiceSpy.checkout.calls.mostRecent().args[0].idempotencyKey;

      // Misma clave en ambos intentos: si el primer pedido en realidad sí se
      // creó en el servidor (y solo se perdió la respuesta), el backend debe
      // poder reconocer el reintento y no crear un segundo pedido.
      expect(secondKey).toBe(firstKey);
    }));

    it('debería limpiar el idempotencyKey tras un checkout exitoso', () => {
      const response: CheckoutResponse = {
        orderId: 1,
        reservationExpiresAt: new Date().toISOString(),
        paymentSession: { provider: 'TRANSFER', checkoutUrl: null },
        amounts: { subtotal: 10000, discount: 0, tax: 0, shipping: 0, total: 10000, currency: 'ARS' },
        couponApplied: null,
        giftCardApplied: null,
        giftCardDiscount: 0,
        loyaltyTierApplied: null,
        loyaltyPointsRedeemed: 0,
      };
      orderServiceSpy.checkout.and.returnValue(of(response));
      spyOnProperty(window, 'location').and.returnValue({ href: '' } as Location);

      component.startCheckout();

      expect(sessionStorage.getItem('checkout_idempotency_key')).toBeNull();
    });
  });

  // ─── cancelAddressForm ────────────────────────────────────────────────────

  describe('cancelAddressForm()', () => {
    it('debería ocultar el formulario de dirección', () => {
      component.showAddressForm.set(true);

      component.cancelAddressForm();

      expect(component.showAddressForm()).toBeFalse();
      expect(component.submitted()).toBeFalse();
    });
  });
});
