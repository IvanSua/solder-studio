import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

/**
 * Handles the redirect from Google OAuth2.
 *
 * The backend's OAuth2AuthenticationSuccessHandler redirects here with:
 *   /oauth-callback?code=<uuid>   (30-second one-time code, never the raw JWT)
 *
 * This component exchanges the code for real JWT tokens via
 * POST /api/v1/auth/oauth-exchange, stores them, then navigates home.
 * If no code is present it goes to /auth.
 */
@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  template: `
    <div class="callback-container">
      <div class="spinner"></div>
      <p>Iniciando sesión con Google…</p>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; min-height: 80vh; gap: 1.25rem;
      color: var(--text-secondary); font-size: 0.95rem;
    }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class OAuthCallbackComponent implements OnInit {
  private authService = inject(AuthService);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');

    if (!code) {
      this.router.navigate(['/auth']);
      return;
    }

    // Remove the code from the browser history so it's not visible in the URL bar.
    history.replaceState({}, '', '/oauth-callback');

    this.authService.exchangeOAuthCode(code).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.router.navigate(['/auth']),
    });
  }
}
