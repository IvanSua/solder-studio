import {
  HttpInterceptorFn,
  HttpErrorResponse,
  HttpRequest,
  HttpHandlerFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AuthResponse } from '../models/auth.model';

/**
 * Module-level state shared across all interceptor calls.
 *
 * When multiple requests get a 401 simultaneously (e.g. after the access token
 * expires), only ONE refresh call is made. The others queue on `refreshToken$`
 * and retry with the new token once the refresh resolves.
 */
let isRefreshing = false;
const refreshToken$ = new BehaviorSubject<string | null>(null);

/**
 * Intercepts 401 Unauthorized responses and attempts a silent token refresh.
 *
 * Flow:
 *  1. Request returns 401.
 *  2. If a refresh token exists → call POST /auth/refresh.
 *  3. Retry the original request with the new access token.
 *  4. If refresh fails → logout and redirect to /auth.
 *
 * The /auth/refresh endpoint itself is excluded to avoid infinite loops.
 */
export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isRefreshRequest(req)) {
        return handleUnauthorized(req, next, authService, router);
      }
      return throwError(() => error);
    }),
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRefreshRequest(req: HttpRequest<unknown>): boolean {
  return req.url.includes('/auth/refresh');
}

function withBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function handleUnauthorized(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router,
) {
  if (!authService.getRefreshToken()) {
    return forceLogout(authService, router);
  }

  if (isRefreshing) {
    // Another request is already refreshing — wait for it to complete, then retry
    return refreshToken$.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap(token => next(withBearer(req, token))),
    );
  }

  isRefreshing = true;
  refreshToken$.next(null);

  return authService.refreshTokens().pipe(
    switchMap((response: AuthResponse) => {
      isRefreshing = false;
      refreshToken$.next(response.accessToken);
      return next(withBearer(req, response.accessToken));
    }),
    catchError(err => {
      isRefreshing = false;
      return forceLogout(authService, router, err);
    }),
  );
}

function forceLogout(authService: AuthService, router: Router, originalError?: unknown) {
  authService.logout();
  router.navigate(['/auth'], { queryParams: { reason: 'session_expired' } });
  return throwError(() => originalError ?? new Error('Session expired'));
}
