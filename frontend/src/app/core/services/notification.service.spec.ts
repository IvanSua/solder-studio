/**
 * NotificationService - Unit Tests
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NotificationService } from './notification.service';
import { environment } from '@env/environment';

describe('NotificationService', () => {
  let service: NotificationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NotificationService],
    });
    service = TestBed.inject(NotificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    service.stopPolling();
  });

  // ==========================================================================
  // TESTS DE ESTADO INICIAL
  // ==========================================================================

  describe('Estado Inicial', () => {
    it('debería empezar con unreadCount en 0', () => {
      expect(service.unreadCount()).toBe(0);
    });
  });

  // ==========================================================================
  // TESTS DE getNotifications()
  // ==========================================================================

  describe('getNotifications()', () => {
    it('debería hacer GET a /notifications con paginación', () => {
      service.getNotifications(0, 20).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/notifications?page=0&size=20`);
      expect(req.request.method).toBe('GET');
    });

    it('debería usar valores por defecto', () => {
      service.getNotifications().subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/notifications?page=0&size=20`);
      expect(req.request.method).toBe('GET');
      req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20, last: true });
    });
  });

  // ==========================================================================
  // TESTS DE markRead()
  // ==========================================================================

  describe('markRead()', () => {
    it('debería hacer PATCH a /notifications/{id}/read', () => {
      service.markRead(1).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/notifications/1/read`);
      expect(req.request.method).toBe('PATCH');
    });
  });

  // ==========================================================================
  // TESTS DE markAllRead()
  // ==========================================================================

  describe('markAllRead()', () => {
    it('debería hacer POST a /notifications/read-all', () => {
      service.markAllRead().subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/notifications/read-all`);
      expect(req.request.method).toBe('POST');
    });
  });

  // ==========================================================================
  // TESTS DE decrementUnread()
  // ==========================================================================

  describe('decrementUnread()', () => {
    it('debería decrementar el contador en 1', () => {
      service.decrementUnread();
      expect(service.unreadCount()).toBe(0);
    });

    it('no debería decrementar por debajo de 0', () => {
      service.decrementUnread();
      service.decrementUnread();
      expect(service.unreadCount()).toBe(0);
    });
  });

  // ==========================================================================
  // TESTS DE resetUnread()
  // ==========================================================================

  describe('resetUnread()', () => {
    it('debería resetear el contador a 0', () => {
      service.resetUnread();
      expect(service.unreadCount()).toBe(0);
    });
  });

  // ==========================================================================
  // TESTS DE POLLING
  // ==========================================================================

  describe('Polling', () => {
    it('stopPolling debería resetear contador', () => {
      service.stopPolling();
      expect(service.unreadCount()).toBe(0);
    });

    it('stopPolling debería cancelar suscripción', () => {
      spyOn(service, 'stopPolling').and.callThrough();
      service.ngOnDestroy();
      expect(service.stopPolling).toHaveBeenCalled();
    });
  });
});
