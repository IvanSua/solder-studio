import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  importProvidersFrom,
  isDevMode,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateModule } from '@ngx-translate/core';
import * as Sentry from '@sentry/angular';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { authErrorInterceptor } from './core/interceptors/auth-error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideClientHydration(withEventReplay()),
    provideRouter(routes),
    // withFetch() is required for HttpClient to work in SSR (uses native fetch instead of XMLHttpRequest)
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, authErrorInterceptor])),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // i18n (ngx-translate v17)
    provideTranslateHttpLoader({
      prefix: '/assets/i18n/',
      suffix: '.json',
    }),
    importProvidersFrom(TranslateModule.forRoot()),
    // Sentry: replaces Angular's default ErrorHandler to capture all unhandled errors
    { provide: ErrorHandler, useValue: Sentry.createErrorHandler() },
    // Sentry: instruments Angular Router navigation events for performance tracing
    { provide: Sentry.TraceService, deps: [Router] },
    // Force TraceService to instantiate eagerly (Angular DI is lazy by default)
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [Sentry.TraceService],
      multi: true,
    },
    // Register the push notification service worker (separate from ngsw-worker.js)
    // so we can handle push events independently of the Angular caching SW.
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {
        if ('serviceWorker' in navigator && typeof window !== 'undefined') {
          navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
            .catch(err => console.warn('[PushSW] Registration failed:', err));
        }
      },
      multi: true,
    },
  ],
};
