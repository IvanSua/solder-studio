import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';
import * as Sentry from '@sentry/angular';

// Initialize Sentry BEFORE bootstrapping Angular so all errors are captured,
// including those thrown during app initialization.
// Uses @sentry/angular for Angular Router instrumentation (TraceService).
if (environment.production && environment.sentryDsn) {
  Sentry.init({
    dsn: environment.sentryDsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.1,          // 10% of transactions
    replaysSessionSampleRate: 0.1,  // 10% of sessions
    replaysOnErrorSampleRate: 1.0,  // 100% of sessions with errors
    environment: 'production',
  });
}

bootstrapApplication(AppComponent, appConfig).catch((err) => {
  console.error('Bootstrap error:', err);
  if (environment.production) {
    Sentry.captureException(err);
  }
  throw err;
});
