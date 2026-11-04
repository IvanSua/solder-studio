import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '@core/services/seo.service';

@Component({
  selector: 'app-empresa',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="empresa-page">

      <!-- Hero -->
      <section class="hero">
        <div class="hero-inner">
          <span class="hero-tag">Nuestra historia</span>
          <h1>Somos Solder Studio</h1>
          <p class="hero-lead">
            Nació de la pasión por la música, el cine y la cultura pop. Hacemos ropa que dice algo.
          </p>
        </div>
      </section>

      <div class="content-wrap">

        <!-- Historia -->
        <section class="section">
          <div class="section-grid">
            <div class="section-text">
              <h2>¿Quiénes somos?</h2>
              <p>
                Solder Studio es una marca argentina de indumentaria personalizada. Creamos remeras,
                buzos y accesorios con diseños únicos inspirados en bandas de música, películas de culto
                y la cultura urbana.
              </p>
              <p>
                Cada prenda es un objeto de edición limitada: diseñada, impresa y controlada por
                nosotros para garantizar calidad real. No somos un intermediario — somos los que
                diseñan y los que imprimen.
              </p>
            </div>
            <div class="section-visual">
              <div class="stat-grid">
                <div class="stat-card">
                  <span class="stat-num">2020</span>
                  <span class="stat-label">Fundación</span>
                </div>
                <div class="stat-card">
                  <span class="stat-num">+500</span>
                  <span class="stat-label">Diseños únicos</span>
                </div>
                <div class="stat-card">
                  <span class="stat-num">100%</span>
                  <span class="stat-label">Nacional</span>
                </div>
                <div class="stat-card">
                  <span class="stat-num">24hs</span>
                  <span class="stat-label">Respuesta</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Valores -->
        <section class="section">
          <h2 class="section-title-center">Lo que nos mueve</h2>
          <div class="values-grid">
            <div class="value-card">
              <div class="value-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                </svg>
              </div>
              <h3>Calidad real</h3>
              <p>Usamos telas premium y procesos de estampado que no se lavan ni se pelan. Garantizamos cada prenda.</p>
            </div>
            <div class="value-card">
              <div class="value-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                  <line x1="9" y1="9" x2="9.01" y2="9"/>
                  <line x1="15" y1="9" x2="15.01" y2="9"/>
                </svg>
              </div>
              <h3>Diseño con identidad</h3>
              <p>Cada gráfico tiene una historia. No copiamos tendencias — creamos prendas que representan algo real.</p>
            </div>
            <div class="value-card">
              <div class="value-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3>Comunidad primero</h3>
              <p>Escuchamos a nuestros clientes. El Buzón de Sugerencias y las reseñas no son decoración — los leemos todos.</p>
            </div>
            <div class="value-card">
              <div class="value-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <h3>100% Argentina</h3>
              <p>Producimos en Argentina. Apoyamos la industria local y llevamos trabajo de calidad a la indumentaria nacional.</p>
            </div>
          </div>
        </section>

        <!-- CTA -->
        <section class="cta-section">
          <h2>¿Querés hablar con nosotros?</h2>
          <p>Ya sea una consulta, un pedido especial o simplemente decir hola.</p>
          <div class="cta-btns">
            <a routerLink="/contacto" class="btn-primary">Contactanos</a>
            <a routerLink="/blog" class="btn-outline">Leer el blog</a>
          </div>
        </section>

      </div>
    </div>
  `,
  styles: [`
    .empresa-page { background: var(--bg); }

    /* Hero */
    .hero {
      background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-card) 100%);
      border-bottom: 1px solid var(--border);
      padding: 5rem 1.5rem 4rem;
      text-align: center;
    }
    .hero-inner { max-width: 680px; margin: 0 auto; }
    .hero-tag {
      display: inline-block; font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.1em; color: var(--primary); background: rgba(224,32,200,0.1);
      padding: 0.3rem 0.85rem; border-radius: 20px; margin-bottom: 1.25rem;
    }
    .hero h1 {
      font-size: 2.75rem; font-weight: 900; color: var(--text); margin: 0 0 1rem; line-height: 1.1;
    }
    .hero-lead {
      font-size: 1.15rem; color: var(--text-secondary); margin: 0; line-height: 1.6;
    }

    /* Content */
    .content-wrap { max-width: 1100px; margin: 0 auto; padding: 3rem 1.5rem 4rem; }

    .section { margin-bottom: 4rem; }
    .section-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 3.5rem; align-items: center;
    }
    .section-text h2 {
      font-size: 1.6rem; font-weight: 800; color: var(--text); margin: 0 0 1rem;
    }
    .section-text p {
      font-size: 0.975rem; color: var(--text-secondary); line-height: 1.75; margin: 0 0 1rem;
    }

    /* Stats */
    .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .stat-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
      padding: 1.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
    }
    .stat-num { font-size: 1.9rem; font-weight: 900; color: var(--primary); }
    .stat-label { font-size: 0.78rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }

    /* Values */
    .section-title-center {
      font-size: 1.6rem; font-weight: 800; color: var(--text); text-align: center; margin: 0 0 2.5rem;
    }
    .values-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.25rem;
    }
    .value-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px;
      padding: 1.75rem; transition: box-shadow 0.2s;
    }
    .value-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .value-icon {
      width: 52px; height: 52px; background: rgba(224,32,200,0.1);
      border-radius: 12px; display: flex; align-items: center; justify-content: center;
      margin-bottom: 1rem; color: var(--primary);
    }
    .value-card h3 { font-size: 1rem; font-weight: 700; color: var(--text); margin: 0 0 0.5rem; }
    .value-card p { font-size: 0.875rem; color: var(--text-secondary); margin: 0; line-height: 1.6; }

    /* CTA */
    .cta-section {
      text-align: center; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: 20px; padding: 3.5rem 2rem;
    }
    .cta-section h2 { font-size: 1.75rem; font-weight: 800; color: var(--text); margin: 0 0 0.75rem; }
    .cta-section p { color: var(--text-secondary); margin: 0 0 2rem; font-size: 1rem; }
    .cta-btns { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    .btn-primary {
      padding: 0.75rem 1.75rem; background: var(--primary); color: white;
      text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 0.95rem;
      transition: background 0.15s;
    }
    .btn-primary:hover { background: var(--primary-dark); }
    .btn-outline {
      padding: 0.75rem 1.75rem; background: transparent; color: var(--text);
      text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 0.95rem;
      border: 1.5px solid var(--border); transition: border-color 0.15s;
    }
    .btn-outline:hover { border-color: var(--primary); color: var(--primary); }

    @media (max-width: 768px) {
      .hero h1 { font-size: 2rem; }
      .section-grid { grid-template-columns: 1fr; }
      .stat-grid { grid-template-columns: 1fr 1fr; }
    }
  `],
})
export class EmpresaComponent implements OnInit {
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.set({
      title: 'Empresa — Solder Studio',
      description: 'Conocé la historia de Solder Studio, nuestra misión y los valores que nos mueven.',
      canonicalPath: '/empresa',
    });
  }
}
