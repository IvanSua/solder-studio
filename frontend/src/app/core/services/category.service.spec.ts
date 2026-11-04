/**
 * CategoryService - Unit Tests
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CategoryService, Category } from './category.service';
import { environment } from '@env/environment';

describe('CategoryService', () => {
  let service: CategoryService;
  let httpMock: HttpTestingController;

  const mockChild: Category = {
    id: 2,
    name: 'Remeras',
    slug: 'remeras',
    description: 'Remeras de algodón',
    imageUrl: 'https://example.com/remeras.jpg',
    children: [],
  };

  const mockCategory: Category = {
    id: 1,
    name: 'Ropa',
    slug: 'ropa',
    description: 'Toda la ropa',
    imageUrl: 'https://example.com/ropa.jpg',
    children: [mockChild],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CategoryService],
    });

    service = TestBed.inject(CategoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('listRoots()', () => {
    it('debería hacer GET a /categories', () => {
      service.listRoots().subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/categories`);
      expect(req.request.method).toBe('GET');
    });

    it('debería retornar array de categorías raíz', () => {
      service.listRoots().subscribe(categories => {
        expect(categories.length).toBe(1);
        expect(categories[0].name).toBe('Ropa');
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/categories`);
      req.flush([mockCategory]);
    });

    it('debería incluir categorías anidadas', () => {
      service.listRoots().subscribe(categories => {
        expect(categories[0].children.length).toBe(1);
        expect(categories[0].children[0].name).toBe('Remeras');
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/categories`);
      req.flush([mockCategory]);
    });

    it('debería manejar categorías sin hijos', () => {
      const categoryWithoutChildren: Category = {
        ...mockCategory,
        children: [],
      };

      service.listRoots().subscribe(categories => {
        expect(categories[0].children.length).toBe(0);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/categories`);
      req.flush([categoryWithoutChildren]);
    });
  });
});
