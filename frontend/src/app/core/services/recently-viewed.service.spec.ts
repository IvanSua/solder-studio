/**
 * RecentlyViewedService - Unit Tests
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RecentlyViewedService } from './recently-viewed.service';
import { Product } from '../models/product.model';
import { environment } from '@env/environment';

describe('RecentlyViewedService', () => {
  let service: RecentlyViewedService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [RecentlyViewedService],
    });
    service = TestBed.inject(RecentlyViewedService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('record()', () => {
    it('debería hacer POST a /recently-viewed/{productId}', () => {
      service.record(1);
      const req = httpMock.expectOne(`${environment.apiUrl}/recently-viewed/1`);
      expect(req.request.method).toBe('POST');
      req.flush({});
    });
  });

  describe('getRecentlyViewed()', () => {
    it('debería hacer GET a /recently-viewed', () => {
      service.getRecentlyViewed().subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/recently-viewed`);
      expect(req.request.method).toBe('GET');
    });

    it('debería incluir excludeProductId si se pasa', () => {
      service.getRecentlyViewed(5).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/recently-viewed?excludeProductId=5`);
      expect(req.request.params.get('excludeProductId')).toBe('5');
    });

    it('debería retornar array de productos', () => {
      const mockProduct: Product = { id: 1, name: 'Test', slug: 'test', description: '', categoryId: null, categoryName: null, customizable: false, variants: [], images: [], printArea: null };
      service.getRecentlyViewed().subscribe(products => {
        expect(products.length).toBe(1);
      });
      const req = httpMock.expectOne(`${environment.apiUrl}/recently-viewed`);
      req.flush([mockProduct]);
    });
  });
});
