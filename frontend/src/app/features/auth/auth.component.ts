import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

type AuthView = 'login' | 'register' | 'forgot' | 'reset';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-container">
      <div class="auth-card">

        <!-- ── Branding ─────────────────────────────────────── -->
        <div class="auth-brand">
          <img src="assets/icon.png" alt="Solder Studio" class="brand-logo" />
          <span class="brand-name">Solder Studio</span>
        </div>

        <!-- ── LOGIN / REGISTER ─────────────────────────────── -->
        @if (view === 'login' || view === 'register') {
          <h2>{{ view === 'login' ? 'Iniciar Sesión' : 'Crear cuenta' }}</h2>

          @if (sessionExpired) {
            <div class="info-banner">Tu sesión expiró. Ingresá de nuevo para continuar.</div>
          }
          @if (errorMessage) {
            <div class="error">{{ errorMessage }}</div>
          }

          <form (ngSubmit)="submit()">
            @if (view === 'register') {
              <label for="firstName">Nombre</label>
              <input id="firstName" type="text" [(ngModel)]="firstName" name="firstName"
                     placeholder="Tu nombre" required />
              <label for="lastName">Apellido</label>
              <input id="lastName" type="text" [(ngModel)]="lastName" name="lastName"
                     placeholder="Tu apellido" required />
            }
            <label for="email">Email</label>
            <input id="email" type="email" [(ngModel)]="email" name="email"
                   placeholder="tu@email.com" required autocomplete="email" />
            <label for="password">Contraseña</label>
            <input id="password" type="password" [(ngModel)]="password" name="password"
                   placeholder="Tu contraseña" required minlength="8" autocomplete="current-password" />

            @if (view === 'login') {
              <div class="forgot-link">
                <a (click)="view = 'forgot'">¿Olvidaste tu contraseña?</a>
              </div>
            }

            @if (view === 'register') {
              <label class="newsletter-label">
                <input id="newsletterOptIn" type="checkbox" [(ngModel)]="newsletterOptIn" name="newsletterOptIn" />
                <span for="newsletterOptIn">Quiero recibir novedades, descuentos y lanzamientos de Solder Studio</span>
              </label>
            }

            <button type="submit" [disabled]="loading" class="btn-primary">
              {{ loading ? 'Cargando...' : (view === 'login' ? 'Ingresar' : 'Crear cuenta') }}
            </button>
          </form>

          <!-- Google OAuth button -->
          <div class="divider"><span>o</span></div>
          <button type="button" class="btn-google" (click)="loginWithGoogle()">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continuar con Google
          </button>

          <!-- Facebook OAuth button -->
          <button type="button" class="btn-facebook" (click)="loginWithFacebook()">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 3.656 10.959 8.546 12.054v-8.519H7.9v-3.535h2.646V9.793c0-2.612 1.569-4.064 3.968-4.064 1.152 0 2.327.205 2.327.205v2.557h1.317c1.296 0 1.7.807 1.7 1.953v2.218l2.427.838c.001-.006.002-.012.002-.018C22.174 16.133 24 14.311 24 12.073z"/><path fill="#fff" d="M16.946 19.612v-3.535h2.646l.394-3.535h-3.04v-1.788c0-1.093.281-1.682 1.791-1.682h1.252v-2.557h-1.69c-2.49 0-3.39 1.33-3.39 3.39v2.087h-2.021v3.535h2.021v8.519c.56.089 1.129.135 1.709.135.566 0 1.12-.045 1.659-.127v-3.535h-1.669z"/></svg>
            Continuar con Facebook
          </button>

          <p class="toggle">
            {{ view === 'login' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?' }}
            <a (click)="view = view === 'login' ? 'register' : 'login'">
              {{ view === 'login' ? 'Registrate' : 'Ingresá' }}
            </a>
          </p>
        }

        <!-- ── 2FA MODAL ─────────────────────────────────────── -->
        @if (twoFactorRequired) {
          <div class="tfa-overlay">
            <h2>Verificación en dos pasos</h2>
            <p class="subtitle">Ingresá el código de 6 dígitos de tu app de autenticación.</p>

            @if (errorMessage) {
              <div class="error">{{ errorMessage }}</div>
            }

            <form (ngSubmit)="submit2FA()">
              <label for="twoFactorCode" class="sr-only">Código de verificación</label>
              <input
                id="twoFactorCode"
                type="text"
                [(ngModel)]="twoFactorCode"
                name="twoFactorCode"
                placeholder="000000"
                maxlength="6"
                pattern="[0-9]{6}"
                autocomplete="one-time-code"
                style="letter-spacing: 0.3em; text-align: center; font-size: 1.5rem; font-weight: 700;"
              />
              <button type="submit" [disabled]="loading" class="btn-primary">
                {{ loading ? 'Verificando...' : 'Verificar' }}
              </button>
            </form>

            <p class="toggle">
              <a (click)="cancelTwoFactor()">← Volver al inicio de sesión</a>
            </p>
          </div>
        }

        <!-- ── FORGOT PASSWORD ──────────────────────────────── -->
        @if (view === 'forgot') {
          <h2>Recuperar contraseña</h2>

          @if (successMessage) {
            <div class="success-box">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink:0">
                <circle cx="10" cy="10" r="10" fill="#d1fae5"/>
                <path d="M6 10l3 3 5-6" stroke="#059669" stroke-width="1.8"
                      stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>{{ successMessage }}</span>
            </div>
            <p class="toggle">
              <a (click)="view = 'login'">← Volver al inicio de sesión</a>
            </p>
          } @else {
            <p class="subtitle">
              Ingresá tu email y te enviaremos un enlace para restablecer tu contraseña.
            </p>

            @if (errorMessage) {
              <div class="error">{{ errorMessage }}</div>
            }

            <form (ngSubmit)="submitForgot()">
              <label for="forgotEmail">Tu email</label>
              <input id="forgotEmail" type="email" [(ngModel)]="email" name="email"
                     placeholder="tu@email.com" required autocomplete="email" />
              <button type="submit" [disabled]="loading" class="btn-primary">
                {{ loading ? 'Enviando...' : 'Enviar enlace' }}
              </button>
            </form>

            <p class="toggle">
              <a (click)="view = 'login'">← Volver al inicio de sesión</a>
            </p>
          }
        }

        <!-- ── RESET PASSWORD ───────────────────────────────── -->
        @if (view === 'reset') {
          <h2>Nueva contraseña</h2>

          @if (successMessage) {
            <div class="success-box">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink:0">
                <circle cx="10" cy="10" r="10" fill="#d1fae5"/>
                <path d="M6 10l3 3 5-6" stroke="#059669" stroke-width="1.8"
                      stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>{{ successMessage }}</span>
            </div>
            <p class="toggle">
              <a (click)="view = 'login'">Iniciar sesión →</a>
            </p>
          } @else {
            <p class="subtitle">Ingresá tu nueva contraseña (mínimo 8 caracteres).</p>

            @if (errorMessage) {
              <div class="error">{{ errorMessage }}</div>
            }

            <form (ngSubmit)="submitReset()">
              <label for="newPassword">Nueva contraseña</label>
              <input id="newPassword" type="password" [(ngModel)]="newPassword" name="newPassword"
                     placeholder="Mínimo 8 caracteres" required minlength="8" autocomplete="new-password" />
              <label for="confirmPassword">Confirmar contraseña</label>
              <input id="confirmPassword" type="password" [(ngModel)]="confirmPassword" name="confirmPassword"
                     placeholder="Repetí tu contraseña" required minlength="8" autocomplete="new-password" />
              <button type="submit" [disabled]="loading" class="btn-primary">
                {{ loading ? 'Guardando...' : 'Guardar contraseña' }}
              </button>
            </form>
          }
        }

      </div>
    </div>
  `,
  styles: [`
    /* ── HOST ──────────────────────────────────────────────────── */
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      width: 100%;
      min-height: 100vh;
    }

    /* ── FONDO METALIZADO ───────────────────────────────────────── */
    .auth-container {
      flex: 1;
      width: 100%;
      min-height: 100vh;
      display: flex; justify-content: center; align-items: center;
      padding: 2rem 1.5rem;
      box-sizing: border-box;
      position: relative; overflow: hidden;

      /* Capas de gradiente que crean la profundidad metalizada */
      background:
        radial-gradient(ellipse 80% 60% at 50% -10%, rgba(224,32,200,0.45) 0%, transparent 65%),
        radial-gradient(ellipse 60% 50% at 100% 100%, rgba(160,0,140,0.25) 0%, transparent 55%),
        radial-gradient(ellipse 50% 60% at 0% 85%,   rgba(80,0,60,0.3)   0%, transparent 55%),
        linear-gradient(160deg, #080006 0%, #110010 35%, #0a000d 65%, #050004 100%);
    }

    /* Logo como marca de agua en el fondo */
    .auth-container::before {
      content: '';
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 700px; height: 700px;
      background: url('/assets/icon.png') center / contain no-repeat;
      opacity: 0.045;
      filter: blur(3px) saturate(0.5);
      pointer-events: none;
    }

    /* Barrido de luz metálico animado */
    .auth-container::after {
      content: '';
      position: absolute; top: 0; left: -100%;
      width: 50%; height: 100%;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255,160,240,0.04) 40%,
        rgba(224,32,200,0.07) 50%,
        rgba(255,160,240,0.04) 60%,
        transparent 100%
      );
      animation: metalShimmer 10s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes metalShimmer {
      0%   { left: -60%; }
      100% { left: 160%; }
    }

    /* ── CARD (glassmorphism) ────────────────────────────────────── */
    .auth-card {
      width: 100%; max-width: 420px;
      background: rgba(255,255,255,0.06);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      border: 1px solid rgba(224,32,200,0.22);
      border-radius: 22px;
      padding: 2.5rem 2.25rem;
      position: relative; z-index: 1;
      box-shadow:
        0 8px 40px rgba(0,0,0,0.55),
        0 0 0 1px rgba(255,255,255,0.04),
        0 0 80px rgba(224,32,200,0.12);
      animation: cardIn 0.4s ease;
    }
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── BRANDING ────────────────────────────────────────────────── */
    .auth-brand {
      display: flex; flex-direction: column; align-items: center;
      gap: 0.6rem; margin-bottom: 2rem;
    }
    .brand-logo {
      width: 72px; height: 72px; object-fit: contain;
      filter: drop-shadow(0 0 14px rgba(224,32,200,0.7));
    }
    .brand-name {
      font-size: 1.45rem; font-weight: 800; letter-spacing: -0.02em;
      background: linear-gradient(135deg, #f8c0f0 0%, #e020c8 40%, #c018a8 70%, #f0a0e0 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* ── TIPOGRAFÍA ──────────────────────────────────────────────── */
    h2 {
      margin: 0 0 1.25rem; font-size: 1.2rem; font-weight: 700;
      color: rgba(255,255,255,0.9); text-align: center;
    }
    .subtitle {
      color: rgba(255,255,255,0.5); font-size: 0.9rem;
      margin: -0.5rem 0 1.25rem; line-height: 1.5; text-align: center;
    }

    /* ── FORM ────────────────────────────────────────────────────── */
    form {
      display: flex; flex-direction: column;
    }

    /* ── INPUTS ──────────────────────────────────────────────────── */
    label {
      display: block; font-size: 0.82rem; font-weight: 600;
      color: rgba(255,255,255,0.6); margin-top: 0.75rem;
    }
    input:not([type="checkbox"]) {
      display: block; width: 100%;
      padding: 0.7rem 0.875rem; margin: 0.35rem 0;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(224,32,200,0.2);
      border-radius: 10px; font-size: 0.95rem;
      color: rgba(255,255,255,0.9);
      box-sizing: border-box;
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    input:not([type="checkbox"])::placeholder { color: rgba(255,255,255,0.25); }
    input:not([type="checkbox"]):focus {
      outline: none;
      border-color: var(--primary);
      background: rgba(224,32,200,0.08);
      box-shadow: 0 0 0 3px rgba(224,32,200,0.15);
    }

    /* ── BOTÓN PRINCIPAL ─────────────────────────────────────────── */
    .btn-primary {
      width: 100%; padding: 0.8rem; margin-top: 1.25rem;
      background: linear-gradient(135deg, #e020c8 0%, #c018a8 50%, #a010a0 100%);
      color: white; border: none; border-radius: 10px;
      font-weight: 700; font-size: 0.95rem; cursor: pointer;
      letter-spacing: 0.01em;
      box-shadow: 0 4px 20px rgba(224,32,200,0.4);
      transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
    }
    .btn-primary:not(:disabled):hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 28px rgba(224,32,200,0.55);
    }
    .btn-primary:not(:disabled):active { transform: translateY(0); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── LINKS ───────────────────────────────────────────────────── */
    .forgot-link { text-align: right; margin: 0.25rem 0 0; }
    .forgot-link a {
      color: rgba(255,255,255,0.4); font-size: 0.83rem; cursor: pointer;
      transition: color 0.15s;
    }
    .forgot-link a:hover { color: var(--primary); }
    .toggle {
      text-align: center; margin-top: 1.1rem;
      color: rgba(255,255,255,0.4); font-size: 0.88rem;
    }
    .toggle a { cursor: pointer; color: var(--primary); font-weight: 600; }
    .toggle a:hover { text-decoration: underline; }

    /* ── NEWSLETTER ──────────────────────────────────────────────── */
    .newsletter-label {
      display: flex; align-items: flex-start; gap: 0.5rem;
      font-size: 0.82rem; color: rgba(255,255,255,0.45); line-height: 1.4;
      margin: 0.75rem 0 0; cursor: pointer;
    }
    .newsletter-label input[type="checkbox"] {
      display: inline; width: auto; margin: 0;
      flex-shrink: 0; margin-top: 2px; accent-color: var(--primary);
    }

    /* ── MENSAJES ────────────────────────────────────────────────── */
    .error {
      background: rgba(239,68,68,0.12); color: #fca5a5;
      border: 1px solid rgba(239,68,68,0.25);
      padding: 0.75rem; border-radius: 10px;
      margin-bottom: 1rem; font-size: 0.88rem;
    }
    .info-banner {
      background: rgba(224,32,200,0.1); color: #f0a0e8;
      border: 1px solid rgba(224,32,200,0.2);
      padding: 0.75rem; border-radius: 10px;
      margin-bottom: 1rem; font-size: 0.88rem;
    }
    .success-box {
      display: flex; gap: 0.6rem; align-items: flex-start;
      background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25);
      padding: 0.85rem 1rem; border-radius: 10px;
      margin-bottom: 1rem; font-size: 0.88rem;
      color: #86efac; line-height: 1.5;
    }

    /* ── DIVISOR ─────────────────────────────────────────────────── */
    .divider {
      display: flex; align-items: center; gap: 0.75rem;
      margin: 1.25rem 0 0.75rem; color: rgba(255,255,255,0.25); font-size: 0.83rem;
    }
    .divider::before, .divider::after {
      content: ''; flex: 1; height: 1px;
      background: rgba(255,255,255,0.1);
    }

    /* ── OAUTH BUTTONS ───────────────────────────────────────────── */
    .btn-google, .btn-facebook {
      display: flex; align-items: center; justify-content: center; gap: 0.6rem;
      width: 100%; padding: 0.7rem;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.8);
      font-size: 0.9rem; font-weight: 500; cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .btn-google:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
    .btn-facebook { margin-top: 0.5rem; }
    .btn-facebook:hover { background: rgba(24,119,242,0.12); border-color: rgba(24,119,242,0.3); }

    /* ── 2FA ─────────────────────────────────────────────────────── */
    .tfa-overlay { padding-top: 0.5rem; }

    /* ── ACCESIBILIDAD ───────────────────────────────────────────── */
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0;
      margin: -1px; overflow: hidden; clip: rect(0,0,0,0);
      white-space: nowrap; border: 0;
    }
  `],
})
export class AuthComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  view: AuthView = 'login';

  // Shared fields
  email = '';
  password = '';
  firstName = '';
  lastName = '';
  newsletterOptIn = false;

  // Reset flow
  resetToken = '';
  newPassword = '';
  confirmPassword = '';

  // State
  loading = false;
  errorMessage = '';
  successMessage = '';
  sessionExpired = false;

  // 2FA state
  twoFactorRequired = false;
  twoFactorCode = '';
  private tempToken = '';

  ngOnInit(): void {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    this.sessionExpired = reason === 'session_expired';

    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.resetToken = token;
      this.view = 'reset';
    } else if (this.route.snapshot.url.some(s => s.path === 'reset-password')) {
      // No token param → redirect to forgot
      this.view = 'forgot';
    }
  }

  submit(): void {
    this.errorMessage = '';
    this.loading = true;

    if (this.view === 'login') {
      this.authService.login({ email: this.email, password: this.password }).subscribe({
        next: (res) => {
          this.loading = false;
          if (res.requiresTwoFactor && res.tempToken) {
            this.tempToken = res.tempToken;
            this.twoFactorRequired = true;
          } else {
            this.router.navigate(['/']);
          }
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err.error?.error || 'Error al iniciar sesión';
        },
      });
    } else {
      this.authService.register({
        email: this.email, password: this.password,
        firstName: this.firstName, lastName: this.lastName,
        newsletterOptIn: this.newsletterOptIn,
      }).subscribe({
        next: () => this.router.navigate(['/']),
        error: (err) => {
          this.loading = false;
          this.errorMessage = err.error?.error || 'Error al registrarse';
        },
      });
    }
  }

  loginWithGoogle(): void {
    this.authService.loginWithGoogle();
  }

  loginWithFacebook(): void {
    this.authService.loginWithFacebook();
  }

  submit2FA(): void {
    this.errorMessage = '';
    this.loading = true;
    this.authService.verify2FA(this.tempToken, this.twoFactorCode).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.error || 'Código incorrecto. Intentá nuevamente.';
      },
    });
  }

  cancelTwoFactor(): void {
    this.twoFactorRequired = false;
    this.twoFactorCode = '';
    this.tempToken = '';
    this.errorMessage = '';
  }

  submitForgot(): void {
    this.errorMessage = '';
    this.loading = true;
    this.authService.forgotPassword(this.email).subscribe({
      next: (res) => {
        this.loading = false;
        this.successMessage = res.message;
      },
      error: () => {
        this.loading = false;
        // Still show success to avoid user enumeration
        this.successMessage = 'Si el email existe en nuestra base recibirás un enlace para restablecer tu contraseña.';
      },
    });
  }

  submitReset(): void {
    this.errorMessage = '';
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden.';
      return;
    }
    this.loading = true;
    this.authService.resetPassword(this.resetToken, this.newPassword).subscribe({
      next: (res) => {
        this.loading = false;
        this.successMessage = res.message || 'Contraseña actualizada. Ya podés iniciar sesión.';
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.error || 'Token inválido o expirado. Solicitá un nuevo enlace.';
      },
    });
  }
}
