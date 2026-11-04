import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, tap } from 'rxjs';
import { environment } from '@env/environment';
import { AuthResponse, LoginRequest, RegisterRequest, UserInfo } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly TOKEN_KEY = 'access_token';
  private readonly REFRESH_KEY = 'refresh_token';
  private readonly USER_KEY = 'user_info';

  /** The backend root URL (without /api) — used for OAuth2 redirects */
  private readonly backendUrl = environment.apiUrl.replace('/api/v1', '').replace('/api', '');

  private currentUser = signal<UserInfo | null>(this.loadUser());

  user = this.currentUser.asReadonly();
  isAuthenticated = computed(() => this.currentUser() !== null);
  isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');

  constructor(private http: HttpClient) {
    // Note: field initializers run before constructor; loadUser() is SSR-safe because
    // it uses isPlatformBrowser check. See loadUser() below.
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/reset-password`, { token, newPassword });
  }

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http.get<{ message: string }>(`${this.apiUrl}/verify-email`, { params: { token } });
  }

  resendVerification(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/resend-verification`, { email });
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, request).pipe(
      tap(response => { if (!response.requiresTwoFactor) this.storeAuth(response); })
    );
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request).pipe(
      tap(response => { if (!response.requiresTwoFactor) this.storeAuth(response); })
    );
  }

  /** Completes login when 2FA is required */
  verify2FA(tempToken: string, code: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/2fa/verify`, { tempToken, code }).pipe(
      tap(response => this.storeAuth(response))
    );
  }

  /** Sets up 2FA — returns { secret, otpauthUri } */
  setup2FA(): Observable<{ secret: string; otpauthUri: string }> {
    return this.http.post<{ secret: string; otpauthUri: string }>(`${this.apiUrl}/2fa/setup`, {});
  }

  /** Activates 2FA after confirming first code */
  enable2FA(code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/2fa/enable`, { code });
  }

  /** Disables 2FA */
  disable2FA(code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/2fa/disable`, { code });
  }

  /** Initiates Google OAuth2 — browser navigates to Google consent screen */
  loginWithGoogle(): void {
    window.location.href = `${this.backendUrl}/oauth2/authorization/google`;
  }

  /** Initiates Facebook OAuth2 — browser navigates to Facebook consent screen */
  loginWithFacebook(): void {
    window.location.href = `${this.backendUrl}/oauth2/authorization/facebook`;
  }

  /**
   * Exchanges the short-lived OAuth2 one-time code (30s TTL, single-use)
   * for real JWT tokens. Called by OAuthCallbackComponent.
   */
  exchangeOAuthCode(code: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/oauth-exchange`, { code }).pipe(
      tap(response => this.storeAuth(response))
    );
  }

  logout(): void {
    const token = this.getToken();
    if (token) {
      // Fire-and-forget: revoke the token on the backend.
      // We clear local state immediately regardless of the response so the
      // user experience is instant even if the request fails.
      this.http.post(`${this.apiUrl}/logout`, {}).subscribe({ error: () => {} });
    }
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(this.REFRESH_KEY);
  }

  /**
   * Calls POST /auth/refresh with the stored refresh token.
   * On success the new tokens are persisted automatically.
   * The interceptor uses this to silently renew sessions on 401.
   */
  refreshTokens(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }
    return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, { refreshToken }).pipe(
      tap(response => {
        if (response.accessToken) {
          localStorage.setItem(this.TOKEN_KEY, response.accessToken);
        }
        if (response.refreshToken) {
          localStorage.setItem(this.REFRESH_KEY, response.refreshToken);
        }
      }),
    );
  }

  private storeAuth(response: AuthResponse): void {
    if (response.accessToken) {
      localStorage.setItem(this.TOKEN_KEY, response.accessToken);
    }
    if (response.refreshToken) {
      localStorage.setItem(this.REFRESH_KEY, response.refreshToken);
    }
    if (response.user) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
      this.currentUser.set(response.user);
    }
  }

  private loadUser(): UserInfo | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const data = localStorage.getItem(this.USER_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}
