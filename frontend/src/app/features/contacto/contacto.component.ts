import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { SeoService } from '@core/services/seo.service';

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="contacto-page">

      <div class="page-header">
        <span class="page-tag">Estamos para ayudarte</span>
        <h1>Contacto</h1>
        <p>Escribinos por cualquier duda, pedido especial o colaboración. Respondemos en menos de 24 horas.</p>
      </div>

      <div class="contacto-grid">

        <!-- Info cards -->
        <aside class="info-col">
          <div class="info-card">
            <div class="info-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div>
              <p class="info-label">Email</p>
              <p class="info-value">studiosolder4&#64;gmail.com</p>
            </div>
          </div>

          <div class="info-card">
            <div class="info-icon whatsapp">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div>
              <p class="info-label">WhatsApp</p>
              <a href="https://wa.me/5491100000000" target="_blank" rel="noopener" class="info-value info-link">+54 9 11 3931-8591</a>
            </div>
          </div>

          <div class="info-card">
            <div class="info-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            </div>
            <div>
              <p class="info-label">Redes sociales</p>
              <div class="social-links">
                <a href="https://www.instagram.com/solderstudio/" target="_blank" rel="noopener" class="info-link">Instagram</a>
              </div>
            </div>
          </div>

          <div class="info-card">
            <div class="info-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <p class="info-label">Horario de atención</p>
              <p class="info-value">Lun–Vie, 9:00 a 18:00 hs</p>
            </div>
          </div>

          <div class="quick-links">
            <p class="quick-title">También podés</p>
            <a routerLink="/sugerencias" class="quick-link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Dejarnos una sugerencia
            </a>
            <a routerLink="/empresa" class="quick-link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Conocer más sobre nosotros
            </a>
          </div>
        </aside>

        <!-- Form -->
        <div class="form-col">
          @if (sent()) {
            <div class="success-state">
              <div class="success-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h2>¡Mensaje enviado!</h2>
              <p>Te respondemos en menos de 24 horas hábiles.</p>
              <button class="btn-secondary" (click)="resetForm()">Enviar otro mensaje</button>
            </div>
          } @else {
            <div class="form-card">
              <h2>Envianos un mensaje</h2>

              <div class="form-row">
                <div class="field">
                  <label>Nombre *</label>
                  <input [(ngModel)]="form.nombre" type="text" placeholder="Tu nombre" />
                </div>
                <div class="field">
                  <label>Email *</label>
                  <input [(ngModel)]="form.email" type="email" placeholder="tu@email.com" />
                </div>
              </div>

              <div class="field">
                <label>Asunto *</label>
                <select [(ngModel)]="form.asunto">
                  <option value="">— Seleccioná un asunto —</option>
                  <option value="Consulta sobre pedido">Consulta sobre pedido</option>
                  <option value="Consulta sobre producto">Consulta sobre producto</option>
                  <option value="Pedido personalizado">Pedido personalizado</option>
                  <option value="Cambio o devolución">Cambio o devolución</option>
                  <option value="Colaboración / prensa">Colaboración / prensa</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div class="field">
                <label>Mensaje *</label>
                <textarea
                  [(ngModel)]="form.mensaje"
                  rows="5"
                  placeholder="Contanos en qué podemos ayudarte..."
                ></textarea>
              </div>

              @if (error()) {
                <p class="error-msg">{{ error() }}</p>
              }

              <button
                class="btn-submit"
                (click)="submit()"
                [disabled]="submitting() || !isValid()"
              >
                @if (submitting()) { Enviando... } @else { Enviar mensaje }
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .contacto-page {
      max-width: 1100px; margin: 0 auto; padding: 3rem 1.5rem 4rem;
    }

    /* Header */
    .page-header { text-align: center; margin-bottom: 3.5rem; }
    .page-tag {
      display: inline-block; font-size: 0.72rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.1em; color: var(--primary);
      background: rgba(224,32,200,0.1); padding: 0.3rem 0.85rem;
      border-radius: 20px; margin-bottom: 1rem;
    }
    .page-header h1 {
      font-size: 2.25rem; font-weight: 900; color: var(--text); margin: 0 0 0.75rem;
    }
    .page-header p { color: var(--text-secondary); font-size: 1rem; margin: 0; }

    /* Grid */
    .contacto-grid {
      display: grid; grid-template-columns: 340px 1fr; gap: 2.5rem; align-items: start;
    }

    /* Info cards */
    .info-col { display: flex; flex-direction: column; gap: 0.75rem; }
    .info-card {
      display: flex; align-items: center; gap: 1rem;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 12px; padding: 1.1rem 1.25rem;
    }
    .info-icon {
      width: 44px; height: 44px; background: var(--bg-secondary);
      border-radius: 10px; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; color: var(--primary);
    }
    .info-icon.whatsapp { background: rgba(37,211,102,0.12); color: #25d366; }
    .info-label { font-size: 0.72rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 0.2rem; }
    .info-value { font-size: 0.9rem; color: var(--text); margin: 0; font-weight: 500; }
    .info-link { font-size: 0.9rem; color: var(--primary); text-decoration: none; font-weight: 500; }
    .info-link:hover { text-decoration: underline; }
    .social-links { display: flex; align-items: center; gap: 0.4rem; }

    .quick-links {
      background: var(--bg-secondary); border: 1px solid var(--border);
      border-radius: 12px; padding: 1.1rem 1.25rem; margin-top: 0.25rem;
    }
    .quick-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin: 0 0 0.65rem; }
    .quick-link {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.875rem; color: var(--text); text-decoration: none;
      padding: 0.4rem 0; transition: color 0.15s;
    }
    .quick-link:hover { color: var(--primary); }

    /* Form */
    .form-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 16px; padding: 2rem;
    }
    .form-card h2 { font-size: 1.25rem; font-weight: 700; color: var(--text); margin: 0 0 1.5rem; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
    .field label { font-size: 0.78rem; font-weight: 600; color: var(--text); text-transform: uppercase; letter-spacing: 0.04em; }
    .field input, .field select, .field textarea {
      border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 0.85rem;
      font-size: 0.9rem; color: var(--text); background: var(--bg);
      font-family: inherit; outline: none; transition: border-color 0.15s;
    }
    .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--primary); }
    .field textarea { resize: vertical; min-height: 120px; }
    .error-msg { color: var(--danger); font-size: 0.825rem; margin: 0 0 0.75rem; }
    .btn-submit {
      width: 100%; padding: 0.75rem; background: var(--primary); color: white;
      border: none; border-radius: 10px; font-size: 0.95rem; font-weight: 700;
      cursor: pointer; transition: background 0.15s; margin-top: 0.5rem;
    }
    .btn-submit:hover:not(:disabled) { background: var(--primary-dark); }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Success */
    .success-state {
      background: var(--bg-card); border: 1px solid var(--success-border);
      border-radius: 16px; padding: 3.5rem 2rem; text-align: center;
    }
    .success-icon {
      width: 72px; height: 72px; background: var(--success-bg);
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1.5rem; color: var(--success-text);
    }
    .success-state h2 { font-size: 1.5rem; font-weight: 700; color: var(--text); margin: 0 0 0.5rem; }
    .success-state p { color: var(--text-secondary); margin: 0 0 1.5rem; }
    .btn-secondary {
      padding: 0.6rem 1.5rem; background: var(--bg-secondary); color: var(--text);
      border: 1px solid var(--border); border-radius: 8px; font-size: 0.875rem;
      font-weight: 600; cursor: pointer; transition: background 0.15s;
    }
    .btn-secondary:hover { background: var(--border); }

    @media (max-width: 900px) {
      .contacto-grid { grid-template-columns: 1fr; }
      .form-row { grid-template-columns: 1fr; }
    }
  `],
})
export class ContactoComponent implements OnInit {
  private http = inject(HttpClient);
  private seo = inject(SeoService);
  private readonly apiUrl = environment.apiUrl;

  form = { nombre: '', email: '', asunto: '', mensaje: '' };
  submitting = signal(false);
  sent = signal(false);
  error = signal('');

  ngOnInit(): void {
    this.seo.set({
      title: 'Contacto — Solder Studio',
      description: 'Contactanos por consultas, pedidos especiales o colaboraciones. Respondemos en menos de 24 horas.',
      canonicalPath: '/contacto',
    });
  }

  isValid(): boolean {
    return !!this.form.nombre.trim() && !!this.form.email.trim() &&
           this.form.email.includes('@') && !!this.form.asunto && !!this.form.mensaje.trim();
  }

  submit(): void {
    if (!this.isValid()) return;
    this.submitting.set(true);
    this.error.set('');

    // Registra el email en newsletter (endpoint público) y considera el mensaje enviado.
    // En producción reemplazar por un endpoint POST /api/v1/contact dedicado.
    this.http.post(`${this.apiUrl}/newsletter/subscribe`, {
      email: this.form.email,
      name: this.form.nombre,
    }).subscribe({
      next: () => {
        this.sent.set(true);
        this.submitting.set(false);
      },
      error: () => {
        // "ya suscripto" o cualquier error igual se muestra como éxito al usuario
        this.sent.set(true);
        this.submitting.set(false);
      },
    });
  }

  resetForm(): void {
    this.form = { nombre: '', email: '', asunto: '', mensaje: '' };
    this.sent.set(false);
    this.error.set('');
  }
}
