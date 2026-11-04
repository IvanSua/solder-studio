import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';

import { OrdersComponent } from './orders.component';
import { OrderService } from '@core/services/order.service';
import { ReturnService } from '@core/services/return.service';
import { Order } from '@core/models/order.model';

const mockOrder: Order = {
  orderId: 1,
  status: 'PENDING',
  customerEmail: 'ivan@test.com',
  customerName: 'Ivan S',
  items: [],
  amounts: { subtotal: 10000, discount: 0, tax: 0, shipping: 0, total: 10000, currency: 'ARS' },
  shippingAddress: null,
  paymentMethod: 'TRANSFER',
  installments: 1,
  trackingNumber: null,
  trackingUrl: null,
  estimatedDeliveryAt: null,
  adminNotes: null,
  createdAt: '2024-01-01T10:00:00Z',
  updatedAt: '2024-01-01T10:00:00Z',
};

describe('OrdersComponent', () => {
  let component: OrdersComponent;
  let fixture: ComponentFixture<OrdersComponent>;
  let orderServiceSpy: jasmine.SpyObj<OrderService>;
  let returnServiceSpy: jasmine.SpyObj<ReturnService>;

  const mockActivatedRoute = {
    snapshot: {
      queryParamMap: { get: () => null },
    },
  };

  beforeEach(async () => {
    orderServiceSpy = jasmine.createSpyObj('OrderService', ['getOrders', 'cancelOrder', 'downloadInvoice']);
    returnServiceSpy = jasmine.createSpyObj('ReturnService', ['getMyReturns', 'create']);

    // callFake para que cada llamada devuelva un objeto nuevo — evita mutación compartida
    orderServiceSpy.getOrders.and.callFake(() => of({
      content: [{ ...mockOrder }],
      totalElements: 1,
      totalPages: 1,
    }));
    returnServiceSpy.getMyReturns.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [OrdersComponent],
      providers: [
        provideRouter([]),
        { provide: OrderService, useValue: orderServiceSpy },
        { provide: ReturnService, useValue: returnServiceSpy },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ─── ngOnInit ──────────────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('debería cargar los pedidos al iniciar', () => {
      expect(orderServiceSpy.getOrders).toHaveBeenCalledWith(0, jasmine.any(Number));
    });

    it('debería asignar los pedidos retornados', () => {
      expect(component.orders).toEqual([mockOrder]);
    });

    it('debería poner loading en false tras cargar', () => {
      expect(component.loading).toBeFalse();
    });

    it('debería calcular totalPages correctamente', () => {
      expect(component.totalPages).toBe(1);
    });

    it('debería poner loading en false si getOrders falla', () => {
      orderServiceSpy.getOrders.and.returnValue(throwError(() => new Error('Error')));
      component.loadPage(0);
      expect(component.loading).toBeFalse();
    });
  });

  // ─── ngOnInit con query params de MercadoPago ──────────────────────────────

  describe('ngOnInit — payment banner', () => {
    it('debería mostrar banner de éxito si payment=success', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [OrdersComponent],
        providers: [
          provideRouter([]),
          { provide: OrderService, useValue: orderServiceSpy },
          { provide: ReturnService, useValue: returnServiceSpy },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                queryParamMap: { get: (k: string) => k === 'payment' ? 'success' : null },
              },
            },
          },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(OrdersComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.paymentBanner).toBe('success');
    });

    it('debería resaltar el pedido si hay ?order=1', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [OrdersComponent],
        providers: [
          provideRouter([]),
          { provide: OrderService, useValue: orderServiceSpy },
          { provide: ReturnService, useValue: returnServiceSpy },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                queryParamMap: { get: (k: string) => k === 'order' ? '1' : null },
              },
            },
          },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(OrdersComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.highlightedOrderId).toBe(1);
    });
  });

  // ─── loadPage ──────────────────────────────────────────────────────────────

  describe('loadPage()', () => {
    it('debería actualizar currentPage', () => {
      orderServiceSpy.getOrders.and.returnValue(of({ content: [], totalElements: 0, totalPages: 0 }));
      component.loadPage(2);
      expect(component.currentPage).toBe(2);
    });

    it('debería actualizar orders con el contenido de la respuesta', () => {
      const anotherOrder = { ...mockOrder, orderId: 99 };
      orderServiceSpy.getOrders.and.returnValue(of({ content: [anotherOrder], totalElements: 1, totalPages: 1 }));
      component.loadPage(0);
      expect(component.orders[0].orderId).toBe(99);
    });
  });

  // ─── cancelOrder ───────────────────────────────────────────────────────────

  describe('cancelOrder()', () => {
    beforeEach(() => {
      spyOn(window, 'confirm').and.returnValue(true);
    });

    it('debería llamar orderService.cancelOrder con el id del pedido', () => {
      const cancelledOrder = { ...mockOrder, status: 'CANCELLED' };
      orderServiceSpy.cancelOrder.and.returnValue(of(cancelledOrder));

      component.cancelOrder(mockOrder);

      expect(orderServiceSpy.cancelOrder).toHaveBeenCalledWith(1);
    });

    it('debería actualizar el pedido en la lista tras cancelar', () => {
      const freshOrder = { ...mockOrder };
      const cancelledOrder = { ...mockOrder, status: 'CANCELLED' };
      orderServiceSpy.cancelOrder.and.returnValue(of(cancelledOrder));
      component.orders = [freshOrder];

      component.cancelOrder(freshOrder);

      expect(component.orders[0].status).toBe('CANCELLED');
    });

    it('no debería llamar cancelOrder si el usuario cancela el confirm', () => {
      (window.confirm as jasmine.Spy).and.returnValue(false);

      component.cancelOrder(mockOrder);

      expect(orderServiceSpy.cancelOrder).not.toHaveBeenCalled();
    });

    it('debería limpiar cancellingId tras error', () => {
      orderServiceSpy.cancelOrder.and.returnValue(throwError(() => new Error('Error')));

      component.cancelOrder(mockOrder);

      expect(component.cancellingId).toBeNull();
    });
  });

  // ─── canCancel / canDownloadInvoice ────────────────────────────────────────

  describe('canCancel()', () => {
    it('debería devolver true para "pending"', () => {
      expect(component.canCancel('pending')).toBeTrue();
    });

    it('debería devolver true para "awaiting_payment"', () => {
      expect(component.canCancel('awaiting_payment')).toBeTrue();
    });

    it('debería devolver false para "shipped"', () => {
      expect(component.canCancel('shipped')).toBeFalse();
    });

    it('debería devolver false para "delivered"', () => {
      expect(component.canCancel('delivered')).toBeFalse();
    });
  });

  describe('canDownloadInvoice()', () => {
    it('debería devolver true para "paid"', () => {
      expect(component.canDownloadInvoice('paid')).toBeTrue();
    });

    it('debería devolver true para "shipped"', () => {
      expect(component.canDownloadInvoice('shipped')).toBeTrue();
    });

    it('debería devolver false para "pending"', () => {
      expect(component.canDownloadInvoice('pending')).toBeFalse();
    });
  });

  // ─── statusLabel ───────────────────────────────────────────────────────────

  describe('statusLabel()', () => {
    it('debería traducir "pending" a "Pendiente"', () => {
      expect(component.statusLabel('pending')).toBe('Pendiente');
    });

    it('debería traducir "shipped" a "Enviado"', () => {
      expect(component.statusLabel('shipped')).toBe('Enviado');
    });

    it('debería devolver el status original si no tiene traducción', () => {
      expect(component.statusLabel('unknown_status')).toBe('unknown_status');
    });
  });
});
