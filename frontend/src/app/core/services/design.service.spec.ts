/**
 * DesignService - Unit Tests
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DesignService } from './design.service';
import { CustomDesign, CustomDesignRequest, UpdateSceneRequest } from '../models/design.model';
import { environment } from '@env/environment';

describe('DesignService', () => {
  let service: DesignService;
  let httpMock: HttpTestingController;

  const mockDesign: CustomDesign = {
    designId: 1,
    status: 'DRAFT',
    previewUrl: null,
    productionRenderUrl: null,
    variantId: 1,
    variantColor: 'Negro',
    variantSize: 'M',
    productId: 1,
    productName: 'Remera',
    productSlug: 'remera',
    productImageUrl: 'https://example.com/image.jpg',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DesignService],
    });
    service = TestBed.inject(DesignService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('create()', () => {
    it('debería hacer POST a /custom-designs', () => {
      const request: CustomDesignRequest = { productVariantId: 1, assets: [] };
      service.create(request).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/custom-designs`);
      expect(req.request.method).toBe('POST');
    });

    it('debería retornar el diseño creado', () => {
      const request: CustomDesignRequest = { productVariantId: 1, assets: [] };
      service.create(request).subscribe(design => {
        expect(design.designId).toBe(1);
        expect(design.status).toBe('DRAFT');
      });
      const req = httpMock.expectOne(`${environment.apiUrl}/custom-designs`);
      req.flush(mockDesign);
    });
  });

  describe('uploadAsset()', () => {
    it('debería hacer POST con FormData a /custom-designs/{id}/assets', () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      service.uploadAsset(1, mockFile).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/custom-designs/1/assets`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBeTrue();
    });
  });

  describe('updateScene()', () => {
    it('debería hacer PATCH a /custom-designs/{id}/scene', () => {
      const sceneRequest: UpdateSceneRequest = {
        assets: [{ assetId: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, zIndex: 0 }],
        textLayers: [],
      };
      service.updateScene(1, sceneRequest).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/custom-designs/1/scene`);
      expect(req.request.method).toBe('PATCH');
    });
  });

  describe('list()', () => {
    it('debería hacer GET a /custom-designs', () => {
      service.list().subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/custom-designs`);
      expect(req.request.method).toBe('GET');
    });

    it('debería retornar array de diseños', () => {
      service.list().subscribe(designs => {
        expect(designs.length).toBe(1);
      });
      const req = httpMock.expectOne(`${environment.apiUrl}/custom-designs`);
      req.flush([mockDesign]);
    });
  });

  describe('delete()', () => {
    it('debería hacer DELETE a /custom-designs/{id}', () => {
      service.delete(1).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/custom-designs/1`);
      expect(req.request.method).toBe('DELETE');
    });
  });
});
