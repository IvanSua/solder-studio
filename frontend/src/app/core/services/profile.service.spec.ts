/**
 * ProfileService - Unit Tests
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProfileService, UpdateProfileRequest, LoyaltyProfile, SavedSize, PointTransaction } from './profile.service';
import { UserInfo } from '../models/auth.model';
import { environment } from '@env/environment';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;

  const mockUser: UserInfo = {
    id: 1,
    email: 'test@test.com',
    firstName: 'Juan',
    lastName: 'Pérez',
    role: 'USER',
    enabled: true,
  };

  const mockLoyalty: LoyaltyProfile = {
    points: 1500,
    level: 'SILVER',
    levelLabel: 'Socio Silver',
    nextLevelPoints: 3000,
    pointsToNextLevel: 1500,
    levelProgress: 50,
    referralCode: 'JUAN123',
    referralCount: 3,
    savedSizes: [{ categoryName: 'Remeras', size: 'M' }],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ProfileService],
    });

    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ==========================================================================
  // TESTS DE getProfile()
  // ==========================================================================

  describe('getProfile()', () => {
    it('debería hacer GET a /profile', () => {
      service.getProfile().subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/profile`);
      expect(req.request.method).toBe('GET');
    });

    it('debería retornar datos del usuario', () => {
      service.getProfile().subscribe(user => {
        expect(user.id).toBe(1);
        expect(user.firstName).toBe('Juan');
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/profile`);
      req.flush(mockUser);
    });
  });

  // ==========================================================================
  // TESTS DE updateProfile()
  // ==========================================================================

  describe('updateProfile()', () => {
    it('debería hacer PUT a /profile', () => {
      const update: UpdateProfileRequest = { firstName: 'Carlos', lastName: 'García' };

      service.updateProfile(update).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/profile`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(update);
    });

    it('debería retornar usuario actualizado', () => {
      const update: UpdateProfileRequest = { firstName: 'Carlos', lastName: 'García' };

      service.updateProfile(update).subscribe(user => {
        expect(user.firstName).toBe('Carlos');
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/profile`);
      req.flush({ ...mockUser, firstName: 'Carlos' });
    });
  });

  // ==========================================================================
  // TESTS DE changePassword()
  // ==========================================================================

  describe('changePassword()', () => {
    it('debería hacer PUT a /profile/password', () => {
      service.changePassword({ currentPassword: 'old', newPassword: 'new' }).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/profile/password`);
      expect(req.request.method).toBe('PUT');
    });
  });

  // ==========================================================================
  // TESTS DE getLoyalty()
  // ==========================================================================

  describe('getLoyalty()', () => {
    it('debería hacer GET a /profile/loyalty', () => {
      service.getLoyalty().subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/profile/loyalty`);
      expect(req.request.method).toBe('GET');
    });

    it('debería retornar perfil de fidelidad', () => {
      service.getLoyalty().subscribe(loyalty => {
        expect(loyalty.level).toBe('SILVER');
        expect(loyalty.points).toBe(1500);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/profile/loyalty`);
      req.flush(mockLoyalty);
    });
  });

  // ==========================================================================
  // TESTS DE getPointsHistory()
  // ==========================================================================

  describe('getPointsHistory()', () => {
    it('debería hacer GET a /profile/points-history con paginación', () => {
      service.getPointsHistory(0, 10).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/profile/points-history?page=0&size=10`);
      expect(req.request.method).toBe('GET');
    });

    it('debería usar valores por defecto', () => {
      service.getPointsHistory().subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/profile/points-history?page=0&size=10`);
      expect(req.request.method).toBe('GET');
      req.flush({ content: [], totalElements: 0 });
    });

    it('debería retornar transacciones de puntos', () => {
      const mockTransaction: PointTransaction = {
        id: 1,
        amount: 100,
        reason: 'Compra',
        referenceId: 123,
        createdAt: '2024-01-01T10:00:00Z',
      };

      service.getPointsHistory().subscribe(result => {
        expect(result.content.length).toBe(1);
        expect(result.totalElements).toBe(1);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/profile/points-history?page=0&size=10`);
      req.flush({ content: [mockTransaction], totalElements: 1 });
    });
  });

  // ==========================================================================
  // TESTS DE saveSizes()
  // ==========================================================================

  describe('saveSizes()', () => {
    it('debería hacer PUT a /profile/sizes', () => {
      const sizes: SavedSize[] = [{ categoryName: 'Remeras', size: 'L' }];

      service.saveSizes(sizes).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/profile/sizes`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ sizes });
    });

    it('debería retornar tallas guardadas', () => {
      const sizes: SavedSize[] = [{ categoryName: 'Remeras', size: 'L' }];

      service.saveSizes(sizes).subscribe(result => {
        expect(result[0].size).toBe('L');
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/profile/sizes`);
      req.flush(sizes);
    });
  });
});
