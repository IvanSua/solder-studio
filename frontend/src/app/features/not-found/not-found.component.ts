import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SeoService } from '@core/services/seo.service';
import { Meta } from '@angular/platform-browser';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="page">
      <div class="content">
        <div class="code">404</div>
        <div class="illustration">
          <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Hanger -->
            <path d="M100 20 L100 38" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="100" cy="18" r="4" fill="currentColor"/>
            <path d="M100 38 L62 80 L138 80 Z" fill="var(--border)" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <!-- Shirt body -->
            <rect x="54" y="80" width="92" height="60" rx="4" fill="var(--bg-secondary)" stroke="currentColor" stroke-width="1.5"/>
            <!-- Question marks on shirt -->
            <text x="80" y="120" font-size="28" fill="currentColor" font-family="serif" font-weight="700">?</text>
          </svg>
        </div>
        <h1>Página no encontrada</h1>
        <p>La dirección que buscás no existe o fue movida.<br/>¿Querés volver al inicio?</p>
        <div class="actions">
          <a routerLink="/" class="btn-primary">Ir al catálogo</a>
          <a routerLink="/orders" class="btn-secondary">Mis pedidos</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page {
      min-height: 100vh; background: var(--bg-secondary);
      display: flex; align-items: center; justify-content: center;
      padding: 2rem;
    }
    .content {
      text-align: center; max-width: 400px;
    }
    .code {
      font-size: 6rem; font-weight: 800; color: var(--border);
      line-height: 1; letter-spacing: -4px; margin-bottom: -0.5rem;
    }
    .illustration svg {
      width: 160px; height: 130px; margin: 0 auto 1.5rem; display: block;
    }
    h1 {
      font-size: 1.5rem; font-weight: 700; color: var(--text); margin: 0 0 0.75rem;
    }
    p {
      color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6; margin: 0 0 2rem;
    }
    .actions {
      display: flex; gap: 0.75rem; justify-content: center;
    }
    .btn-primary {
      background: var(--primary); color: white; border: none;
      padding: 0.65rem 1.5rem; border-radius: 8px;
      font-size: 0.9rem; font-weight: 600; text-decoration: none;
      transition: background 0.15s;
    }
    .btn-primary:hover { background: var(--primary-dark); }
    .btn-secondary {
      background: var(--bg-card); color: var(--text);
      border: 1.5px solid var(--border); padding: 0.65rem 1.5rem;
      border-radius: 8px; font-size: 0.9rem; font-weight: 600;
      text-decoration: none; transition: background 0.15s;
    }
    .btn-secondary:hover { background: var(--bg-secondary); }
  `]
})
export class NotFoundComponent implements OnInit {
  private seo  = inject(SeoService);
  private meta = inject(Meta);

  ngOnInit(): void {
    this.seo.set({
      title:       'Página no encontrada',
      description: 'La página que buscás no existe o fue movida. Explorá el catálogo de Solder Studio.',
    });
    // Tell crawlers not to index 404 pages
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }
}
