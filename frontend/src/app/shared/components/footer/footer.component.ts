import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterModule],
  template: `
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <div class="footer-logo">
            <img src="assets/icon.png" alt="Solder Studio" class="footer-logo-img" />
            <span>Solder Studio</span>
          </div>
          <p class="footer-tagline">Ropa personalizada de calidad.</p>
        </div>

        <div class="footer-links">
          <div class="footer-col">
            <span class="footer-col-title">Contenido</span>
            <a routerLink="/blog">Blog</a>
            <a routerLink="/gift-cards">Gift Cards</a>
            <a routerLink="/events">Eventos</a>
            <a routerLink="/sugerencias">Sugerencias</a>
          </div>
          <div class="footer-col">
            <span class="footer-col-title">Legal</span>
            <a routerLink="/legal/privacy">Política de Privacidad</a>
            <a routerLink="/legal/terms">Términos y Condiciones</a>
          </div>
          <div class="footer-col">
            <span class="footer-col-title">Empresa</span>
            <a routerLink="/empresa">Quiénes somos</a>
            <a routerLink="/contacto">Contacto</a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        © {{ currentYear }} Solder Studio. Todos los derechos reservados.
      </div>
    </footer>
  `,
  styles: [`
    .footer {
      position: relative;
      color: var(--text-secondary);
      margin-top: auto;
      padding: 3rem 1.5rem 1.5rem;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border);
      transition: background 0.2s, border-color 0.2s, color 0.2s;
    }
    /* Línea metálica superior — usa el color primario del tema */
    .footer::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--primary-light) 35%,
        var(--primary) 50%,
        var(--primary-light) 65%,
        transparent 100%
      );
      opacity: 0.5;
    }
    .footer-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      gap: 4rem;
      flex-wrap: wrap;
    }
    .footer-brand {
      flex: 1;
      min-width: 180px;
    }
    .footer-logo {
      font-weight: 800;
      font-size: 1.1rem;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .footer-logo-img {
      width: 28px;
      height: 28px;
      object-fit: contain;
    }
    .footer-tagline {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin: 0;
    }
    .footer-links {
      display: flex;
      gap: 3rem;
      flex-wrap: wrap;
    }
    .footer-col {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 140px;
    }
    .footer-col-title {
      font-weight: 700;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text);
      margin-bottom: 0.25rem;
    }
    .footer-col a {
      font-size: 0.875rem;
      color: var(--text-secondary);
      text-decoration: none;
      transition: color 0.15s;
    }
    .footer-col a:hover {
      color: var(--primary);
    }
    .footer-bottom {
      max-width: 1200px;
      margin: 2rem auto 0;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      font-size: 0.8rem;
      color: var(--text-secondary);
      text-align: center;
    }
    @media (max-width: 600px) {
      .footer-inner {
        flex-direction: column;
        gap: 2rem;
      }
      .footer-links {
        gap: 2rem;
      }
    }
  `],
})
export class FooterComponent {
  readonly currentYear = new Date().getFullYear();
}
