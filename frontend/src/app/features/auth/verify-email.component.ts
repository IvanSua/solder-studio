import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

type VerifyState = 'loading' | 'success' | 'error';

/**
 * Handles the email-verification link clicked from the inbox.
 *
 * URL pattern:  /verificar-email?token=<hex64>
 *
 * States:
 *  - loading  — calling the backend
 *  - success  — email confirmed, button to go to /auth
 *  - error    — token expired / not found
 */
@Component({
  selector: 'app-verify-email',
  standalone: true,
  template: `
    <div class="verify-container">
      <div class="verify-card">

        @if (state === 'loading') {
          <div class="spinner"></div>
          <p class="msg">Verificando tu email…</p>
        }

        @if (state === 'success') {
          <div class="icon-wrap success-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="12" fill="var(--success-bg)"/>
              <path d="M7 12.5l3.5 3.5 6.5-7" stroke="var(--success)"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2>¡Email verificado!</h2>
          <p class="msg">Tu dirección de email fue confirmada exitosamente. Ya podés iniciar sesión.</p>
          <button class="btn-primary" (click)="goToLogin()">Iniciar sesión</button>
        }

        @if (state === 'error') {
          <div class="icon-wrap error-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="12" fill="var(--danger-bg)"/>
              <path d="M8 8l8 8M16 8l-8 8" stroke="var(--danger)"
                    stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <h2>Enlace inválido o expirado</h2>
          <p class="msg">{{ errorMessage }}</p>
          <button class="btn-secondary" (click)="goToLogin()">Volver al inicio de sesión</button>
        }

      </div>
    </div>
  `,
  styles: [`
    .verify-container {
      display: flex; justify-content: center; align-items: center;
      min-height: 80vh; padding: 1.5rem;
    }
    .verify-card {
      width: 100%; max-width: 420px; padding: 2.5rem 2rem;
      border: 1px solid var(--border); border-radius: var(--radius);
      background: var(--bg-card); text-align: center;
    }
    .spinner {
      width: 44px; height: 44px; margin: 0 auto 1.25rem;
      border: 3px solid var(--border); border-top-color: var(--primary);
      border-radius: 50%; animation: spin 0.75s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .icon-wrap { margin: 0 auto 1.25rem; width: fit-content; }
    h2 { margin: 0 0 0.75rem; font-size: 1.35rem; color: var(--text); }
    .msg { color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; margin: 0 0 1.5rem; }
    .btn-primary {
      width: 100%; padding: 0.75rem;
      background: var(--primary); color: white; border: none;
      border-radius: var(--radius); font-weight: 600; font-size: 0.95rem;
      cursor: pointer; transition: opacity 0.15s;
    }
    .btn-primary:hover { opacity: 0.9; }
    .btn-secondary {
      width: 100%; padding: 0.75rem;
      background: var(--bg-card); color: var(--primary);
      border: 1.5px solid var(--primary);
      border-radius: var(--radius); font-weight: 600; font-size: 0.95rem;
      cursor: pointer; transition: background 0.15s;
    }
    .btn-secondary:hover { background: var(--bg-secondary); }
  `],
})
export class VerifyEmailComponent implements OnInit {
  private authService = inject(AuthService);
  private router      = inject(Router);
  private route       = inject(ActivatedRoute);

  state: VerifyState = 'loading';
  errorMessage = 'El enlace de verificación expiró o ya fue usado. Podés solicitar uno nuevo desde tu perfil.';

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.state = 'error';
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: () => { this.state = 'success'; },
      error: (err) => {
        this.state = 'error';
        if (err.error?.error) {
          this.errorMessage = err.error.error;
        }
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/auth']);
  }
}
