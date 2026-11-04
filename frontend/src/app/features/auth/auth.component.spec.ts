import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthComponent } from './auth.component';
import { AuthService } from '@core/services/auth.service';
import { AuthResponse, UserInfo } from '@core/models/auth.model';

const mockUser: UserInfo = {
  id: 1, email: 'ivan@test.com', firstName: 'Ivan', lastName: 'S', role: 'USER',
};

const mockAuthResponse = (partial: Partial<AuthResponse> = {}): AuthResponse => ({
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
  expiresIn: 86400,
  user: mockUser,
  ...partial,
});

describe('AuthComponent', () => {
  let component: AuthComponent;
  let fixture: ComponentFixture<AuthComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let router: Router;

  const mockActivatedRoute = {
    snapshot: {
      queryParamMap: {
        get: (_key: string) => null,
      },
      url: [],
    },
  };

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', [
      'login', 'register', 'loginWithGoogle', 'verify2FA', 'forgotPassword', 'resetPassword',
    ]);

    await TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ─── ngOnInit ──────────────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('debería tener view "login" por defecto', () => {
      expect(component.view).toBe('login');
    });
  });

  describe('ngOnInit — session_expired', () => {
    beforeEach(async () => {
      const routeWithExpiry = {
        snapshot: {
          queryParamMap: { get: (k: string) => k === 'reason' ? 'session_expired' : null },
          url: [],
        },
      };

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [AuthComponent],
        providers: [
          provideRouter([]),
          { provide: AuthService, useValue: authServiceSpy },
          { provide: ActivatedRoute, useValue: routeWithExpiry },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(AuthComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('debería detectar session_expired en queryParams', () => {
      expect(component.sessionExpired).toBeTrue();
    });
  });

  describe('ngOnInit — reset token', () => {
    beforeEach(async () => {
      const routeWithToken = {
        snapshot: {
          queryParamMap: { get: (k: string) => k === 'token' ? 'my-reset-token' : null },
          url: [],
        },
      };

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [AuthComponent],
        providers: [
          provideRouter([]),
          { provide: AuthService, useValue: authServiceSpy },
          { provide: ActivatedRoute, useValue: routeWithToken },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(AuthComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('debería cambiar a vista reset si hay token en queryParams', () => {
      expect(component.view).toBe('reset');
      expect(component.resetToken).toBe('my-reset-token');
    });
  });

  // ─── Login ─────────────────────────────────────────────────────────────────

  describe('submit() — login', () => {
    beforeEach(() => {
      component.view = 'login';
      component.email = 'ivan@test.com';
      component.password = 'password123';
    });

    it('debería llamar authService.login con credenciales correctas', () => {
      authServiceSpy.login.and.returnValue(of(mockAuthResponse()));
      spyOn(router, 'navigate');

      component.submit();

      expect(authServiceSpy.login).toHaveBeenCalledWith({
        email: 'ivan@test.com',
        password: 'password123',
      });
    });

    it('debería navegar a "/" tras login exitoso', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(of(mockAuthResponse()));
      spyOn(router, 'navigate');

      component.submit();
      tick();

      expect(router.navigate).toHaveBeenCalledWith(['/']);
    }));

    it('debería activar twoFactorRequired si la respuesta lo indica', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(of(mockAuthResponse({
        requiresTwoFactor: true,
        tempToken: 'temp-abc123',
      })));

      component.submit();
      tick();

      expect(component.twoFactorRequired).toBeTrue();
    }));

    it('debería mostrar errorMessage si login falla', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(throwError(() => ({
        error: { error: 'Credenciales incorrectas' },
      })));

      component.submit();
      tick();

      expect(component.errorMessage).toBe('Credenciales incorrectas');
    }));

    it('debería mostrar mensaje por defecto si error no tiene body', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(throwError(() => ({})));

      component.submit();
      tick();

      expect(component.errorMessage).toBe('Error al iniciar sesión');
    }));

    it('debería estar loading=false tras error', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(throwError(() => ({ error: {} })));

      component.submit();
      tick();

      expect(component.loading).toBeFalse();
    }));
  });

  // ─── Register ──────────────────────────────────────────────────────────────

  describe('submit() — register', () => {
    beforeEach(() => {
      component.view = 'register';
      component.email = 'nuevo@test.com';
      component.password = 'password123';
      component.firstName = 'Ivan';
      component.lastName = 'S';
      component.newsletterOptIn = false;
    });

    it('debería llamar authService.register con todos los datos', () => {
      authServiceSpy.register.and.returnValue(of(mockAuthResponse()));
      spyOn(router, 'navigate');

      component.submit();

      expect(authServiceSpy.register).toHaveBeenCalledWith({
        email: 'nuevo@test.com',
        password: 'password123',
        firstName: 'Ivan',
        lastName: 'S',
        newsletterOptIn: false,
      });
    });

    it('debería navegar a "/" tras registro exitoso', fakeAsync(() => {
      authServiceSpy.register.and.returnValue(of(mockAuthResponse()));
      spyOn(router, 'navigate');

      component.submit();
      tick();

      expect(router.navigate).toHaveBeenCalledWith(['/']);
    }));

    it('debería mostrar errorMessage si registro falla', fakeAsync(() => {
      authServiceSpy.register.and.returnValue(throwError(() => ({
        error: { error: 'El email ya está registrado' },
      })));

      component.submit();
      tick();

      expect(component.errorMessage).toBe('El email ya está registrado');
    }));
  });

  // ─── 2FA ───────────────────────────────────────────────────────────────────

  describe('submit2FA()', () => {
    beforeEach(() => {
      component.twoFactorRequired = true;
      component.twoFactorCode = '123456';
      component['tempToken'] = 'temp-abc123';
    });

    it('debería llamar authService.verify2FA con token y código', () => {
      authServiceSpy.verify2FA.and.returnValue(of(mockAuthResponse()));
      spyOn(router, 'navigate');

      component.submit2FA();

      expect(authServiceSpy.verify2FA).toHaveBeenCalledWith('temp-abc123', '123456');
    });

    it('debería navegar a "/" tras verificación exitosa', fakeAsync(() => {
      authServiceSpy.verify2FA.and.returnValue(of(mockAuthResponse()));
      spyOn(router, 'navigate');

      component.submit2FA();
      tick();

      expect(router.navigate).toHaveBeenCalledWith(['/']);
    }));

    it('debería mostrar error si el código es incorrecto', fakeAsync(() => {
      authServiceSpy.verify2FA.and.returnValue(throwError(() => ({
        error: { error: 'Código incorrecto' },
      })));

      component.submit2FA();
      tick();

      expect(component.errorMessage).toBe('Código incorrecto');
    }));
  });

  describe('cancelTwoFactor()', () => {
    it('debería limpiar el estado 2FA', () => {
      component.twoFactorRequired = true;
      component.twoFactorCode = '123456';
      component.errorMessage = 'Error previo';

      component.cancelTwoFactor();

      expect(component.twoFactorRequired).toBeFalse();
      expect(component.twoFactorCode).toBe('');
      expect(component.errorMessage).toBe('');
    });
  });

  // ─── Forgot password ───────────────────────────────────────────────────────

  describe('submitForgot()', () => {
    beforeEach(() => {
      component.view = 'forgot';
      component.email = 'ivan@test.com';
    });

    it('debería llamar authService.forgotPassword con el email', () => {
      authServiceSpy.forgotPassword.and.returnValue(of({ message: 'Enlace enviado' }));

      component.submitForgot();

      expect(authServiceSpy.forgotPassword).toHaveBeenCalledWith('ivan@test.com');
    });

    it('debería mostrar successMessage tras envío exitoso', fakeAsync(() => {
      authServiceSpy.forgotPassword.and.returnValue(of({ message: 'Enlace enviado a tu email' }));

      component.submitForgot();
      tick();

      expect(component.successMessage).toBe('Enlace enviado a tu email');
    }));

    it('debería mostrar mensaje genérico incluso si falla (evita user enumeration)', fakeAsync(() => {
      authServiceSpy.forgotPassword.and.returnValue(throwError(() => new Error('Error')));

      component.submitForgot();
      tick();

      expect(component.successMessage).toContain('Si el email existe');
    }));
  });

  // ─── Reset password ────────────────────────────────────────────────────────

  describe('submitReset()', () => {
    beforeEach(() => {
      component.view = 'reset';
      component.resetToken = 'valid-token-123';
      component.newPassword = 'newpass123';
      component.confirmPassword = 'newpass123';
    });

    it('debería llamar authService.resetPassword con token y nueva contraseña', () => {
      authServiceSpy.resetPassword.and.returnValue(of({ message: 'Contraseña actualizada' }));

      component.submitReset();

      expect(authServiceSpy.resetPassword).toHaveBeenCalledWith('valid-token-123', 'newpass123');
    });

    it('debería mostrar successMessage tras reset exitoso', fakeAsync(() => {
      authServiceSpy.resetPassword.and.returnValue(of({ message: 'Contraseña actualizada correctamente' }));

      component.submitReset();
      tick();

      expect(component.successMessage).toBe('Contraseña actualizada correctamente');
    }));

    it('debería mostrar error si las contraseñas no coinciden', () => {
      component.confirmPassword = 'diferente456';

      component.submitReset();

      expect(component.errorMessage).toBe('Las contraseñas no coinciden.');
      expect(authServiceSpy.resetPassword).not.toHaveBeenCalled();
    });

    it('debería mostrar error si el token es inválido', fakeAsync(() => {
      authServiceSpy.resetPassword.and.returnValue(throwError(() => ({
        error: { error: 'Token inválido o expirado' },
      })));

      component.submitReset();
      tick();

      expect(component.errorMessage).toBe('Token inválido o expirado');
    }));
  });

  // ─── Google OAuth ──────────────────────────────────────────────────────────

  describe('loginWithGoogle()', () => {
    it('debería llamar authService.loginWithGoogle', () => {
      component.loginWithGoogle();

      expect(authServiceSpy.loginWithGoogle).toHaveBeenCalled();
    });
  });
});
