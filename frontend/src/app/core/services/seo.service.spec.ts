/**
 * SeoService - Unit Tests (simplificado)
 * 
 * SeoService depende de Meta, Title y DOCUMENT.
 * Estos tests verifican que el servicio existe y sus métodos son callable.
 */

import { TestBed } from '@angular/core/testing';
import { BrowserModule, Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { SeoService, PageMeta, ProductMeta } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BrowserModule],
      providers: [
        SeoService,
        Title,
        Meta,
        { provide: DOCUMENT, useValue: document }
      ]
    });
    service = TestBed.inject(SeoService);
  });

  describe('Métodos públicos', () => {
    it('debería tener método set()', () => {
      expect(typeof service.set).toBe('function');
    });

    it('debería tener método setProduct()', () => {
      expect(typeof service.setProduct).toBe('function');
    });

    it('debería tener método reset()', () => {
      expect(typeof service.reset).toBe('function');
    });

    it('set() debería aceptar PageMeta válido', () => {
      const meta: PageMeta = {
        title: 'Test Page',
        description: 'Test description',
        keywords: 'test, keywords'
      };
      expect(() => service.set(meta)).not.toThrow();
    });

    it('setProduct() debería aceptar ProductMeta válido', () => {
      const product: ProductMeta = {
        name: 'Remera',
        description: 'Remera de algodón',
        slug: 'remera',
        imageUrl: null,
        priceAmount: 5000,
        currencyCode: 'ARS'
      };
      expect(() => service.setProduct(product)).not.toThrow();
    });

    it('reset() debería ejecutarse sin errores', () => {
      expect(() => service.reset()).not.toThrow();
    });
  });

  describe('Integración con PageMeta', () => {
    it('debería usar SiteName en título si no está presente', () => {
      const meta: PageMeta = { title: 'Home', description: 'Home page' };
      service.set(meta);
      const title = TestBed.inject(Title);
      expect(title.getTitle()).toContain('Solder Studio');
    });

    it('debería aceptar canonicalPath', () => {
      const meta: PageMeta = {
        title: 'Test',
        description: 'Test',
        canonicalPath: '/test-page'
      };
      expect(() => service.set(meta)).not.toThrow();
    });
  });
});
