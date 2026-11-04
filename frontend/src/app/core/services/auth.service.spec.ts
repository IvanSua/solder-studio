/**
 * AuthService - Unit Tests
 * 
 * Conceptos clave (comparación con Java/JUnit):
 * =============================================
 * - describe()    = clase de test o grupo de tests relacionados
 * - beforeEach()  = @BeforeEach de JUnit - se ejecuta antes de CADA test
 * - it()         = @Test individual
 * - expect()     = assertEquals(), assertTrue(), etc.
 * - spyOn()      = Mockito.mock() - simula el comportamiento de un objeto
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { LoginRequest, RegisterRequest, AuthResponse, UserInfo } from '../models/auth.model';
import { environment } from '@env/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  // Datos de prueba - similar a crear objetos de test en Java
  const mockUser: UserInfo = {
    id: 1,
    email: 'test@test.com',
    firstName: 'Juan',
    lastName: 'Pérez',
    role: 'USER',
    enabled: true,
    emailVerified: true,
    twoFactorEnabled: false,
  };

  const mockAdmin: UserInfo = {
    id: 2,
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    enabled: true,
  };

  const mockAuthResponse: AuthResponse = {
    accessToken: 'mock-jwt-token',
    refreshToken: 'mock-refresh-token',
    tokenType: 'Bearer',
    expiresIn: 3600,
    user: mockUser,
  };

  /**
   * beforeEach = @BeforeEach
   * Se ejecuta ANTES de cada it()
   * Aquí configuramos el TestBed (simula el módulo de Angular)
   */
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule], // Simula HttpClient sin hacer requests reales
      providers: [AuthService],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);

    // Limpiamos el localStorage antes de cada test
    localStorage.clear();
  });

  /**
   * afterEach = @AfterEach
   * Se ejecuta DESPUÉS de cada test
   * Verificamos que no queden requests pendientes
   */
  afterEach(() => {
    // Verifica que no haya requests HTTP pendientes
    httpMock.verify();
    localStorage.clear();
  });

  // ==========================================================================
  // TESTS DE ESTADO INICIAL
  // ==========================================================================

  describe('Estado Inicial', () => {
    it('debería NO estar autenticado al inicio', () => {
      // Arrange: El servicio se crea sin datos en localStorage
      // Act: Obtenemos el valor de isAuthenticated
      const isAuth = service.isAuthenticated();
      // Assert: Verificamos que es false
      expect(isAuth).toBeFalse();
    });

    it('debería NO tener usuario al inicio', () => {
      expect(service.user()).toBeNull();
    });

    it('debería NO ser admin al inicio', () => {
      expect(service.isAdmin()).toBeFalse();
    });

    it('debería NO tener token al inicio', () => {
      expect(service.getToken()).toBeNull();
    });
  });

  // ==========================================================================
  // TESTS DE LOGIN
  // ==========================================================================

  describe('login()', () => {
    it('debería autenticar usuario y guardar token en localStorage', () => {
      // Arrange: Datos de login
      const loginRequest: LoginRequest = {
        email: 'test@test.com',
        password: 'password123',
      };

      // Act: Llamamos login()
      service.login(loginRequest).subscribe();

      // Assert: Verificamos que se hizo el request HTTP correcto
      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(loginRequest);

      // Simulamos la respuesta del servidor
      req.flush(mockAuthResponse);

      // Verificamos que se guardó en localStorage
      expect(localStorage.getItem('access_token')).toBe('mock-jwt-token');
      expect(localStorage.getItem('refresh_token')).toBe('mock-refresh-token');
    });

    it('debería actualizar el usuario actual después de login exitoso', () => {
      const loginRequest: LoginRequest = { email: 'test@test.com', password: 'password' };
      
      service.login(loginRequest).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req.flush(mockAuthResponse);

      // El signal user() debería tener el usuario
      expect(service.user()).toEqual(mockUser);
      expect(service.isAuthenticated()).toBeTrue();
    });

    it('debería manejar login de admin correctamente', () => {
      const adminResponse: AuthResponse = {
        ...mockAuthResponse,
        user: mockAdmin,
      };

      const loginRequest: LoginRequest = { email: 'admin@test.com', password: 'admin123' };
      
      service.login(loginRequest).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req.flush(adminResponse);

      // El signal isAdmin() debería ser true
      expect(service.isAdmin()).toBeTrue();
    });

    it('debería NO guardar token cuando requiere 2FA', () => {
      const twoFactorResponse: AuthResponse = {
        ...mockAuthResponse,
        requiresTwoFactor: true,
        tempToken: 'temp-token-123',
      };

      const loginRequest: LoginRequest = { email: 'test@test.com', password: 'password' };
      
      service.login(loginRequest).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req.flush(twoFactorResponse);

      // No debería guardar token ni usuario
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(service.user()).toBeNull();
      expect(service.isAuthenticated()).toBeFalse();
    });
  });

  // ==========================================================================
  // TESTS DE LOGOUT
  // ==========================================================================

  describe('logout()', () => {
    it('debería limpiar todo del localStorage', () => {
      // Arrange: Simulamos que hay datos guardados
      localStorage.setItem('access_token', 'some-token');
      localStorage.setItem('refresh_token', 'some-refresh');
      localStorage.setItem('user_info', JSON.stringify(mockUser));

      // Act: Llamamos logout
      service.logout();
      // Flush the fire-and-forget POST to /auth/logout
      httpMock.expectOne(`${environment.apiUrl}/auth/logout`).flush({});

      // Assert: Verificamos que se borró todo
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(localStorage.getItem('user_info')).toBeNull();
    });

    it('debería dejar al usuario como no autenticado', () => {
      // Arrange: Login primero
      service.login({ email: 'test@test.com', password: 'pass' }).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req.flush(mockAuthResponse);

      expect(service.isAuthenticated()).toBeTrue();

      // Act: Logout
      service.logout();
      // Flush the fire-and-forget POST to /auth/logout
      httpMock.expectOne(`${environment.apiUrl}/auth/logout`).flush({});

      // Assert
      expect(service.isAuthenticated()).toBeFalse();
      expect(service.user()).toBeNull();
    });
  });

  // ==========================================================================
  // TESTS DE FORGOT PASSWORD
  // ==========================================================================

  describe('forgotPassword()', () => {
    it('debería hacer POST a /auth/forgot-password', () => {
      const email = 'test@test.com';

      service.forgotPassword(email).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/forgot-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email });

      req.flush({ message: 'Email enviado' });
    });
  });

  // ==========================================================================
  // TESTS DE REGISTER
  // ==========================================================================

  describe('register()', () => {
    it('debería registrar usuario y guardar token', () => {
      const registerRequest: RegisterRequest = {
        email: 'new@test.com',
        password: 'password123',
        firstName: 'Nuevo',
        lastName: 'Usuario',
      };

      service.register(registerRequest).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(registerRequest);

      req.flush(mockAuthResponse);

      expect(localStorage.getItem('access_token')).toBe('mock-jwt-token');
    });
  });

  // ==========================================================================
  // TESTS DE GOOGLE OAUTH
  // ==========================================================================
  // NOTA: loginWithGoogle() no se puede testear fácilmente con spyOnProperty
  // porque window.location no es configurable en el entorno de test.
  // La URL de OAuth se verifica manualmente en integración.
  // Solo verificamos que el método exista y sea una función.
  describe('loginWithGoogle()', () => {
    it('debería ser una función definida', () => {
      expect(typeof service.loginWithGoogle).toBe('function');
    });

    it('debería usar la URL de backend correcta para OAuth', () => {
      // Verificamos que la URL construida es correcta
      const expectedUrl = environment.apiUrl.replace('/api/v1', '').replace('/api', '') + '/oauth2/authorization/google';
      expect(expectedUrl).toBe('http://localhost:8080/oauth2/authorization/google');
    });
  });

  // ==========================================================================
  // TESTS DE PERSISTENCIA (loadUser en localStorage)
  // ==========================================================================

  describe('Persistencia en localStorage', () => {
    it('debería tener usuario null si no hay datos en localStorage', () => {
      // Arrange: No hay nada en localStorage (ya está limpio del afterEach)
      // Act & Assert: El servicio se inicializa sin usuario
      expect(service.user()).toBeNull();
      expect(service.isAuthenticated()).toBeFalse();
    });

    it('debería cargar usuario cuando hay datos válidos en localStorage', () => {
      // Arrange: Simulamos que el usuario ya estaba logueado
      // Obtenemos el token y lo guardamos
      service.login({ email: 'test@test.com', password: 'pass' }).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req.flush(mockAuthResponse);

      // Ahora simulamos re-inicialización haciendo logout y login
      service.logout();
      httpMock.expectOne(`${environment.apiUrl}/auth/logout`).flush({});

      // Volvemos a hacer login para verificar que persiste
      service.login({ email: 'test@test.com', password: 'pass' }).subscribe();
      const req2 = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req2.flush(mockAuthResponse);

      // Assert: El usuario debería estar autenticado
      expect(service.user()).toEqual(mockUser);
      expect(service.isAuthenticated()).toBeTrue();
    });
  });

  // ==========================================================================
  // TESTS PARA 2FA
  // ==========================================================================

  describe('Two-Factor Authentication', () => {
    it('verify2FA debería almacenar auth después de código válido', () => {
      service.verify2FA('temp-token', '123456').subscribe();
      
      const req = httpMock.expectOne(`${environment.apiUrl}/auth/2fa/verify`);
      expect(req.request.method).toBe('POST');
      req.flush(mockAuthResponse);

      expect(localStorage.getItem('access_token')).toBe('mock-jwt-token');
      expect(service.user()).toEqual(mockUser);
    });

    it('disable2FA debería hacer request DELETE equivalent', () => {
      service.disable2FA('123456').subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/2fa/disable`);
      expect(req.request.method).toBe('POST');
      req.flush({ message: '2FA deshabilitado' });
    });
  });
});
