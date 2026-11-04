import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ProfileComponent } from './profile.component';
import { ProfileService } from '@core/services/profile.service';
import { AuthService } from '@core/services/auth.service';
import { AddressService } from '@core/services/address.service';
import { ToastService } from '@core/services/toast.service';
import { WebPushService } from '@core/services/web-push.service';
import { UserInfo } from '@core/models/auth.model';
import { Address } from '@core/models/address.model';

const mockUser: UserInfo = {
  id: 1,
  email: 'ivan@test.com',
  firstName: 'Ivan',
  lastName: 'Suarez',
  role: 'CUSTOMER',
};

const mockAddress: Address = {
  id: 1,
  street: 'Av. Corrientes 1234',
  apartment: null,
  city: 'CABA',
  province: 'Buenos Aires',
  postalCode: '1043',
  notes: null,
  defaultAddress: true,
};

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let profileServiceSpy: jasmine.SpyObj<ProfileService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let addressServiceSpy: jasmine.SpyObj<AddressService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;
  let webPushServiceSpy: jasmine.SpyObj<WebPushService>;

  beforeEach(async () => {
    profileServiceSpy = jasmine.createSpyObj('ProfileService', [
      'getProfile', 'updateProfile', 'changePassword', 'getLoyalty', 'getPointsHistory',
    ]);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['logout']);
    addressServiceSpy = jasmine.createSpyObj('AddressService', [
      'getAddresses', 'createAddress', 'updateAddress', 'deleteAddress', 'setDefault',
    ]);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info']);
    webPushServiceSpy = jasmine.createSpyObj('WebPushService',
      ['subscribe', 'unsubscribe', 'isSubscribed'],
      { isSupported: false, permission: 'default' as NotificationPermission }
    );
    webPushServiceSpy.isSubscribed.and.returnValue(Promise.resolve(false));

    profileServiceSpy.getProfile.and.returnValue(of(mockUser));
    addressServiceSpy.getAddresses.and.returnValue(of([mockAddress]));

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: ProfileService, useValue: profileServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: AddressService, useValue: addressServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: WebPushService, useValue: webPushServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ─── ngOnInit ──────────────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('debería cargar el perfil al iniciar', () => {
      expect(profileServiceSpy.getProfile).toHaveBeenCalled();
    });

    it('debería asignar el usuario retornado', () => {
      expect(component.user()).toEqual(mockUser);
    });

    it('debería poner loading en false tras cargar', () => {
      expect(component.loading()).toBeFalse();
    });

    it('debería poner loading en false si getProfile falla', () => {
      profileServiceSpy.getProfile.and.returnValue(throwError(() => new Error('Error')));
      component.ngOnInit();
      expect(component.loading()).toBeFalse();
    });

    it('debería iniciar en el tab "info"', () => {
      expect(component.activeTab()).toBe('info');
    });
  });

  // ─── Computed ──────────────────────────────────────────────────────────────

  describe('computed properties', () => {
    it('fullName debería combinar firstName y lastName', () => {
      expect(component.fullName()).toBe('Ivan Suarez');
    });

    it('initials debería tomar la primera letra de cada nombre', () => {
      expect(component.initials()).toBe('IS');
    });

    it('roleLabel debería devolver la etiqueta en español', () => {
      expect(component.roleLabel()).toBe('Cliente');
    });

    it('fullName debería devolver vacío si no hay usuario', () => {
      component.user.set(null);
      expect(component.fullName()).toBe('');
    });

    it('initials debería devolver "?" si no hay usuario', () => {
      component.user.set(null);
      expect(component.initials()).toBe('?');
    });
  });

  // ─── setTab ────────────────────────────────────────────────────────────────

  describe('setTab()', () => {
    it('debería cambiar el tab activo', () => {
      component.setTab('password');
      expect(component.activeTab()).toBe('password');
    });

    it('debería resetear submitted al cambiar de tab', () => {
      component.submitted.set(true);
      component.setTab('addresses');
      expect(component.submitted()).toBeFalse();
    });

    it('debería resetear pwError al cambiar de tab', () => {
      component.pwError.set('Error previo');
      component.setTab('info');
      expect(component.pwError()).toBeNull();
    });

    it('debería cargar direcciones al abrir el tab "addresses" por primera vez', () => {
      addressServiceSpy.getAddresses.and.returnValue(of([]));
      component.addresses.set([]);
      component.setTab('addresses');
      expect(addressServiceSpy.getAddresses).toHaveBeenCalled();
    });
  });

  // ─── saveProfile ───────────────────────────────────────────────────────────

  describe('saveProfile()', () => {
    beforeEach(() => {
      component.profileData = {
        firstName: 'Ivan',
        lastName: 'Suarez',
        phone: '',
        cuit: '',
      };
    });

    it('debería llamar profileService.updateProfile con los datos del form', () => {
      profileServiceSpy.updateProfile.and.returnValue(of(mockUser));
      component.saveProfile();
      expect(profileServiceSpy.updateProfile).toHaveBeenCalledWith(
        jasmine.objectContaining({ firstName: 'Ivan', lastName: 'Suarez' })
      );
    });

    it('debería actualizar el signal user tras guardar', () => {
      const updatedUser = { ...mockUser, firstName: 'Pedro' };
      profileServiceSpy.updateProfile.and.returnValue(of(updatedUser));
      component.saveProfile();
      expect(component.user()?.firstName).toBe('Pedro');
    });

    it('debería mostrar toast de éxito', () => {
      profileServiceSpy.updateProfile.and.returnValue(of(mockUser));
      component.saveProfile();
      expect(toastServiceSpy.success).toHaveBeenCalled();
    });

    it('debería poner saving en false tras guardar', () => {
      profileServiceSpy.updateProfile.and.returnValue(of(mockUser));
      component.saveProfile();
      expect(component.saving()).toBeFalse();
    });

    it('no debería llamar updateProfile si falta el firstName', () => {
      component.profileData.firstName = '';
      component.saveProfile();
      expect(profileServiceSpy.updateProfile).not.toHaveBeenCalled();
    });

    it('debería mostrar toast de error si updateProfile falla', () => {
      profileServiceSpy.updateProfile.and.returnValue(throwError(() => new Error('Error')));
      component.saveProfile();
      expect(toastServiceSpy.error).toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
    });
  });

  // ─── changePassword ────────────────────────────────────────────────────────

  describe('changePassword()', () => {
    beforeEach(() => {
      component.passwordData = {
        currentPassword: 'oldpass123',
        newPassword: 'newpass123',
        confirmPassword: 'newpass123',
      };
    });

    it('debería llamar profileService.changePassword con las contraseñas', () => {
      profileServiceSpy.changePassword.and.returnValue(of(undefined));
      component.changePassword();
      expect(profileServiceSpy.changePassword).toHaveBeenCalledWith({
        currentPassword: 'oldpass123',
        newPassword: 'newpass123',
      });
    });

    it('debería mostrar toast de éxito', () => {
      profileServiceSpy.changePassword.and.returnValue(of(undefined));
      component.changePassword();
      expect(toastServiceSpy.success).toHaveBeenCalled();
    });

    it('debería poner pwSaving en false tras cambiar', () => {
      profileServiceSpy.changePassword.and.returnValue(of(undefined));
      component.changePassword();
      expect(component.pwSaving()).toBeFalse();
    });

    it('no debería llamar changePassword si las contraseñas no coinciden', () => {
      component.passwordData.confirmPassword = 'diferente456';
      component.changePassword();
      expect(profileServiceSpy.changePassword).not.toHaveBeenCalled();
    });

    it('no debería llamar changePassword si la contraseña nueva es muy corta', () => {
      component.passwordData.newPassword = '123';
      component.passwordData.confirmPassword = '123';
      component.changePassword();
      expect(profileServiceSpy.changePassword).not.toHaveBeenCalled();
    });

    it('debería mostrar pwError si changePassword falla', () => {
      profileServiceSpy.changePassword.and.returnValue(
        throwError(() => ({ error: { message: 'Contraseña incorrecta' } }))
      );
      component.changePassword();
      expect(component.pwError()).toBe('Contraseña incorrecta');
    });
  });
});
