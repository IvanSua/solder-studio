/**
 * ProductService - Unit Tests (simplificado)
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ProductService, FilterOptions } from './product.service';
import { Product, ProductPage, ProductVariant, ProductImage } from '../models/product.model';
import { environment } from '@env/environment';

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;

  const mockImage: ProductImage = { id: 1, imageUrl: 'https://example.com/image.jpg', altText: 'Remera', primary: true };
  const mockVariant: ProductVariant = { id: 1, color: 'Negro', size: 'M', priceAmount: 5000, currencyCode: 'ARS', stockAvailable: 10, sku: 'SKU1' };
  const mockProduct: Product = {
    id: 1, name: 'Remera', slug: 'remera', description: 'Test', categoryId: 1, categoryName: 'Remeras',
    customizable: true, variants: [mockVariant], images: [mockImage], printArea: null
  };
  const mockPage: ProductPage = { content: [mockProduct], totalElements: 1, totalPages: 1, size: 12, number: 0 };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [ProductService] });
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { httpMock.verify(); });

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  function expectRequest(url: string): TestRequest {
    return httpMock.expectOne(req => req.url === url);
  }

  // ==========================================================================
  // TESTS
  // ==========================================================================

  describe('list()', () => {
    it('debería hacer GET a /products', (done) => {
      service.list().subscribe(page => {
        expect(page.totalElements).toBe(1);
        done();
      });
      expectRequest(`${environment.apiUrl}/products`).flush(mockPage);
    });

    it('debería usar parámetros de paginación', (done) => {
      service.list(2, 24).subscribe(() => done());
      const req = expectRequest(`${environment.apiUrl}/products`);
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('size')).toBe('24');
      req.flush(mockPage);
    });
  });

  describe('listFiltered()', () => {
    it('debería agregar query param q', (done) => {
      service.listFiltered({ q: 'remera' }).subscribe(() => done());
      const req = expectRequest(`${environment.apiUrl}/products`);
      expect(req.request.params.get('q')).toBe('remera');
      req.flush(mockPage);
    });

    it('debería agregar categoryId', (done) => {
      service.listFiltered({ categoryId: 5 }).subscribe(() => done());
      const req = expectRequest(`${environment.apiUrl}/products`);
      expect(req.request.params.get('categoryId')).toBe('5');
      req.flush(mockPage);
    });

    it('debería agregar sort', (done) => {
      service.listFiltered({ sort: 'price_asc' }).subscribe(() => done());
      const req = expectRequest(`${environment.apiUrl}/products`);
      expect(req.request.params.get('sort')).toBe('price_asc');
      req.flush(mockPage);
    });

    it('debería ignorar query vacía', (done) => {
      service.listFiltered({ q: '   ' }).subscribe(() => done());
      const req = expectRequest(`${environment.apiUrl}/products`);
      expect(req.request.params.has('q')).toBeFalse();
      req.flush(mockPage);
    });
  });

  describe('search()', () => {
    it('debería hacer GET a /products/search', (done) => {
      service.search('remera', 0, 12).subscribe(() => done());
      const req = expectRequest(`${environment.apiUrl}/products/search`);
      expect(req.request.params.get('q')).toBe('remera');
      req.flush(mockPage);
    });
  });

  describe('getById()', () => {
    it('debería hacer GET a /products/{id}', (done) => {
      service.getById(1).subscribe(p => { expect(p.id).toBe(1); done(); });
      expectRequest(`${environment.apiUrl}/products/1`).flush(mockProduct);
    });
  });

  describe('getBySlug()', () => {
    it('debería hacer GET a /products/slug/{slug}', (done) => {
      service.getBySlug('remera').subscribe(p => { expect(p.slug).toBe('remera'); done(); });
      expectRequest(`${environment.apiUrl}/products/slug/remera`).flush(mockProduct);
    });
  });

  describe('getByCategory()', () => {
    it('debería hacer GET a /products/category/{id}', (done) => {
      service.getByCategory(1).subscribe(() => done());
      const req = expectRequest(`${environment.apiUrl}/products/category/1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockPage);
    });
  });

  describe('autocomplete()', () => {
    it('debería hacer GET a /products/autocomplete', (done) => {
      service.autocomplete('rem').subscribe(items => { expect(items.length).toBe(1); done(); });
      const req = expectRequest(`${environment.apiUrl}/products/autocomplete`);
      req.flush([{ productId: 1, name: 'Remera', slug: 'remera', imageUrl: null, minPriceAmount: 5000, currencyCode: 'ARS' }]);
    });
  });

  describe('getVariantDetail()', () => {
    it('debería hacer GET a /products/variants/{id}', (done) => {
      service.getVariantDetail(1).subscribe(() => done());
      const req = expectRequest(`${environment.apiUrl}/products/variants/1`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('listAdvanced()', () => {
    it('debería construir params para filtros múltiples', (done) => {
      service.listAdvanced({ q: 'remera', sizes: ['S', 'M'], colors: ['Negro'], sort: 'price_asc' }).subscribe(() => done());
      const req = expectRequest(`${environment.apiUrl}/products`);
      expect(req.request.params.get('q')).toBe('remera');
      expect(req.request.params.getAll('sizes')).toEqual(['S', 'M']);
      req.flush(mockPage);
    });
  });

  describe('getFilterOptions()', () => {
    it('debería hacer GET a /products/filter-options', (done) => {
      service.getFilterOptions(1).subscribe(opts => { expect(opts.sizes).toBeDefined(); done(); });
      const mockOpts: FilterOptions = { sizes: ['S', 'M'], colors: ['Negro'], minPrice: 1000, maxPrice: 10000 };
      expectRequest(`${environment.apiUrl}/products/filter-options`).flush(mockOpts);
    });
  });

  describe('getRecommendations()', () => {
    it('debería hacer GET a /products/{id}/recommendations', (done) => {
      service.getRecommendations(1).subscribe(() => done());
      const req = expectRequest(`${environment.apiUrl}/products/1/recommendations`);
      expect(req.request.method).toBe('GET');
      req.flush([mockProduct]);
    });
  });
});
