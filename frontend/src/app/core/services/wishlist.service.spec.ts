/**
 * WishlistService - Unit Tests
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { WishlistService } from './wishlist.service';
import { Product } from '../models/product.model';
import { environment } from '@env/environment';

describe('WishlistService', () => {
  let service: WishlistService;
  let httpMock: HttpTestingController;

  const mockProduct: Product = {
    id: 1,
    name: 'Remera',
    slug: 'remera',
    description: 'Test',
    categoryId: 1,
    categoryName: 'Remeras',
    customizable: false,
    variants: [],
    images: [],
    printArea: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [WishlistService],
    });

    service = TestBed.inject(WishlistService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ==========================================================================
  // TESTS DE ESTADO INICIAL
  // ==========================================================================

  describe('Estado Inicial', () => {
    it('debería empezar con wishlist vacía', () => {
      expect(service.wishlistedIds().size).toBe(0);
      expect(service.wishlistCount()).toBe(0);
    });

    it('isWishlisted debería retornar false para productos no wishlisted', () => {
      expect(service.isWishlisted(1)).toBeFalse();
    });
  });

  // ==========================================================================
  // TESTS DE loadWishlistIds()
  // ==========================================================================

  describe('loadWishlistIds()', () => {
    it('debería hacer GET a /wishlist/ids', () => {
      service.loadWishlistIds();

      const req = httpMock.expectOne(`${environment.apiUrl}/wishlist/ids`);
      expect(req.request.method).toBe('GET');
    });

    it('debería actualizar wishlistedIds con los IDs recibidos', () => {
      service.loadWishlistIds();
      const req = httpMock.expectOne(`${environment.apiUrl}/wishlist/ids`);
      req.flush([1, 2, 3]);

      expect(service.wishlistedIds().size).toBe(3);
      expect(service.wishlistedIds().has(1)).toBeTrue();
      expect(service.wishlistedIds().has(2)).toBeTrue();
      expect(service.wishlistedIds().has(3)).toBeTrue();
    });

    it('debería actualizar wishlistCount', () => {
      service.loadWishlistIds();
      const req = httpMock.expectOne(`${environment.apiUrl}/wishlist/ids`);
      req.flush([1, 2]);

      expect(service.wishlistCount()).toBe(2);
    });

    it('debería manejar lista vacía', () => {
      service.loadWishlistIds();
      const req = httpMock.expectOne(`${environment.apiUrl}/wishlist/ids`);
      req.flush([]);

      expect(service.wishlistedIds().size).toBe(0);
      expect(service.wishlistCount()).toBe(0);
    });
  });

  // ==========================================================================
  // TESTS DE getWishlist()
  // ==========================================================================

  describe('getWishlist()', () => {
    it('debería hacer GET a /wishlist', () => {
      service.getWishlist().subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/wishlist`);
      expect(req.request.method).toBe('GET');
    });

    it('debería retornar productos wishlisted', () => {
      service.getWishlist().subscribe(products => {
        expect(products.length).toBe(1);
        expect(products[0].id).toBe(1);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/wishlist`);
      req.flush([mockProduct]);
    });
  });

  // ==========================================================================
  // TESTS DE toggle()
  // ==========================================================================

  describe('toggle()', () => {
    it('debería hacer POST a /wishlist/{id}/toggle', () => {
      service.toggle(1).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/wishlist/1/toggle`);
      expect(req.request.method).toBe('POST');
    });

    it('debería agregar producto si fue wishlisted', () => {
      service.toggle(1).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/wishlist/1/toggle`);
      req.flush({ wishlisted: true });

      expect(service.isWishlisted(1)).toBeTrue();
      expect(service.wishlistCount()).toBe(1);
    });

    it('debería eliminar producto si no fue wishlisted', () => {
      // Primero agregar
      service.toggle(1).subscribe();
      let req = httpMock.expectOne(`${environment.apiUrl}/wishlist/1/toggle`);
      req.flush({ wishlisted: true });
      expect(service.isWishlisted(1)).toBeTrue();

      // Luego quitar
      service.toggle(1).subscribe();
      req = httpMock.expectOne(`${environment.apiUrl}/wishlist/1/toggle`);
      req.flush({ wishlisted: false });

      expect(service.isWishlisted(1)).toBeFalse();
      expect(service.wishlistCount()).toBe(0);
    });
  });
});
