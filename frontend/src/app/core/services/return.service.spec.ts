/**
 * ReturnService - Unit Tests
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReturnService } from './return.service';
import { ReturnRequest, CreateReturnRequest } from '../models/return.model';
import { environment } from '@env/environment';

describe('ReturnService', () => {
  let service: ReturnService;
  let httpMock: HttpTestingController;

  const mockReturn: ReturnRequest = {
    id: 1,
    orderId: 123,
    reason: 'DEFECTIVE',
    description: 'El producto llegó dañado',
    resolution: 'REFUND',
    status: 'PENDING',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  };

  const mockCreateRequest: CreateReturnRequest = {
    orderId: 123,
    reason: 'DEFECTIVE',
    description: 'Dañado',
    resolution: 'REFUND',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ReturnService],
    });
    service = TestBed.inject(ReturnService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getMyReturns()', () => {
    it('debería hacer GET a /returns', () => {
      service.getMyReturns().subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/returns`);
      expect(req.request.method).toBe('GET');
    });

    it('debería retornar array de devoluciones', () => {
      service.getMyReturns().subscribe(returns => {
        expect(returns.length).toBe(1);
        expect(returns[0].orderId).toBe(123);
      });
      const req = httpMock.expectOne(`${environment.apiUrl}/returns`);
      req.flush([mockReturn]);
    });
  });

  describe('create()', () => {
    it('debería hacer POST a /returns', () => {
      service.create(mockCreateRequest).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/returns`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockCreateRequest);
    });

    it('debería retornar la devolución creada', () => {
      service.create(mockCreateRequest).subscribe(returnReq => {
        expect(returnReq.status).toBe('PENDING');
        expect(returnReq.resolution).toBe('REFUND');
      });
      const req = httpMock.expectOne(`${environment.apiUrl}/returns`);
      req.flush(mockReturn);
    });
  });
});
