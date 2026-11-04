import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SeoService } from '@core/services/seo.service';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="legal-page">
      <div class="legal-container">
        <a routerLink="/" class="back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Volver al inicio
        </a>

        @if (page() === 'privacy') {
          <article class="legal-content">
            <h1>Política de Privacidad</h1>
            <p class="legal-updated">Última actualización: mayo 2025</p>

            <h2>1. Información que recopilamos</h2>
            <p>En Solder Studio recopilamos la siguiente información cuando usás nuestros servicios:</p>
            <ul>
              <li><strong>Datos de registro:</strong> nombre, apellido, dirección de correo electrónico y contraseña.</li>
              <li><strong>Datos de compra:</strong> dirección de envío, método de pago (procesado por MercadoPago, no almacenamos datos de tarjeta).</li>
              <li><strong>Datos de uso:</strong> páginas visitadas, productos vistos, carrito de compras.</li>
            </ul>

            <h2>2. Cómo usamos tu información</h2>
            <p>Utilizamos tu información para:</p>
            <ul>
              <li>Procesar y gestionar tus pedidos.</li>
              <li>Enviarte confirmaciones y actualizaciones sobre tus compras.</li>
              <li>Mejorar nuestros productos y servicios.</li>
              <li>Enviarte comunicaciones de marketing si diste tu consentimiento (podés darte de baja en cualquier momento).</li>
              <li>Cumplir con obligaciones legales.</li>
            </ul>

            <h2>3. Compartir información con terceros</h2>
            <p>No vendemos ni alquilamos tu información personal. Podemos compartirla con:</p>
            <ul>
              <li><strong>MercadoPago:</strong> para procesar pagos de forma segura.</li>
              <li><strong>OCA / proveedores logísticos:</strong> para gestionar el envío de tus pedidos.</li>
              <li><strong>Proveedores de servicios tecnológicos</strong> que nos ayudan a operar la plataforma.</li>
            </ul>

            <h2>4. Seguridad de los datos</h2>
            <p>Tomamos medidas técnicas y organizativas para proteger tu información personal contra accesos no autorizados, pérdida o divulgación. Todas las comunicaciones se realizan bajo protocolo HTTPS.</p>

            <h2>5. Tus derechos</h2>
            <p>De acuerdo con la Ley 25.326 de Protección de Datos Personales de Argentina, tenés derecho a:</p>
            <ul>
              <li>Acceder a tus datos personales.</li>
              <li>Rectificar datos inexactos o incompletos.</li>
              <li>Solicitar la eliminación de tus datos.</li>
              <li>Oponerte al tratamiento de tus datos para fines de marketing.</li>
            </ul>
            <p>Para ejercer estos derechos, contactanos en <strong>privacidad&#64;solderstudio.com</strong>.</p>

            <h2>6. Cookies</h2>
            <p>Utilizamos cookies técnicas necesarias para el funcionamiento del sitio (sesión, carrito). No utilizamos cookies de seguimiento de terceros.</p>

            <h2>7. Cambios a esta política</h2>
            <p>Podemos actualizar esta política periódicamente. Te notificaremos de cambios significativos a través del correo electrónico registrado.</p>

            <h2>8. Contacto</h2>
            <p>Para consultas sobre privacidad: <strong>privacidad&#64;solderstudio.com</strong></p>
          </article>
        }

        @if (page() === 'terms') {
          <article class="legal-content">
            <h1>Términos y Condiciones</h1>
            <p class="legal-updated">Última actualización: mayo 2025</p>

            <h2>1. Aceptación de los términos</h2>
            <p>Al acceder y utilizar el sitio web de Solder Studio, aceptás estos Términos y Condiciones en su totalidad. Si no estás de acuerdo, por favor no uses el sitio.</p>

            <h2>2. Descripción del servicio</h2>
            <p>Solder Studio es una tienda de ropa personalizada que ofrece productos de indumentaria con diseños únicos. Operamos exclusivamente a través de nuestro sitio web.</p>

            <h2>3. Registro y cuenta</h2>
            <ul>
              <li>Debés tener al menos 18 años para registrarte.</li>
              <li>Sos responsable de mantener la confidencialidad de tu contraseña.</li>
              <li>Toda la información de registro debe ser verdadera y precisa.</li>
              <li>Podemos suspender cuentas que violen estos términos.</li>
            </ul>

            <h2>4. Productos y precios</h2>
            <ul>
              <li>Los precios están expresados en pesos argentinos (ARS) e incluyen IVA.</li>
              <li>Nos reservamos el derecho de modificar precios sin previo aviso.</li>
              <li>Las imágenes de los productos son referenciales; los colores pueden variar según la pantalla.</li>
              <li>En caso de error en el precio, nos contactaremos antes de procesar el pedido.</li>
            </ul>

            <h2>5. Proceso de compra y pago</h2>
            <ul>
              <li>Los pagos son procesados por MercadoPago de forma segura.</li>
              <li>Aceptamos tarjetas de crédito/débito, transferencia bancaria y efectivo (según disponibilidad).</li>
              <li>El pedido se confirma una vez acreditado el pago.</li>
            </ul>

            <h2>6. Envíos</h2>
            <ul>
              <li>Realizamos envíos a todo el territorio argentino a través de OCA.</li>
              <li>Los plazos de entrega son estimativos y pueden variar.</li>
              <li>El costo de envío se calcula en el checkout según destino y peso.</li>
            </ul>

            <h2>7. Devoluciones y cambios</h2>
            <ul>
              <li>Aceptamos devoluciones dentro de los 30 días de recibido el producto.</li>
              <li>El producto debe estar en condiciones originales, sin uso y con etiquetas.</li>
              <li>Los productos personalizados no tienen cambio ni devolución salvo defecto de fabricación.</li>
              <li>Los costos de envío por devolución son a cargo del comprador, salvo producto defectuoso.</li>
            </ul>

            <h2>8. Propiedad intelectual</h2>
            <p>Todos los diseños, imágenes, textos y contenidos del sitio son propiedad de Solder Studio y están protegidos por las leyes de propiedad intelectual. No podés reproducirlos sin autorización expresa.</p>

            <h2>9. Limitación de responsabilidad</h2>
            <p>Solder Studio no será responsable por daños indirectos, incidentales o consecuentes derivados del uso del sitio o de los productos adquiridos.</p>

            <h2>10. Ley aplicable</h2>
            <p>Estos términos se rigen por las leyes de la República Argentina. Cualquier disputa será resuelta en los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires.</p>

            <h2>11. Contacto</h2>
            <p>Para consultas: <strong>legal&#64;solderstudio.com</strong></p>
          </article>
        }
      </div>
    </div>
  `,
  styles: [`
    .legal-page {
      min-height: 60vh;
      background: var(--bg);
      padding: 2rem 1.5rem 4rem;
    }
    .legal-container {
      max-width: 780px;
      margin: 0 auto;
    }
    .back-link {
      display: inline-flex; align-items: center; gap: 0.35rem;
      color: var(--text-secondary); text-decoration: none; font-size: 0.875rem;
      margin-bottom: 2rem; transition: color 0.15s;
    }
    .back-link:hover { color: var(--primary); }

    .legal-content h1 {
      font-size: 2rem; font-weight: 800; color: var(--text);
      margin: 0 0 0.4rem;
    }
    .legal-updated {
      font-size: 0.82rem; color: var(--text-secondary);
      margin: 0 0 2.5rem;
    }
    .legal-content h2 {
      font-size: 1.1rem; font-weight: 700; color: var(--text);
      margin: 2rem 0 0.65rem;
      padding-bottom: 0.4rem;
      border-bottom: 1px solid var(--border);
    }
    .legal-content p, .legal-content li {
      font-size: 0.925rem; color: var(--text-secondary); line-height: 1.75;
    }
    .legal-content p { margin: 0 0 0.85rem; }
    .legal-content ul {
      padding-left: 1.35rem; margin: 0 0 0.85rem;
    }
    .legal-content li { margin-bottom: 0.35rem; }
    .legal-content strong { color: var(--text); font-weight: 600; }
  `],
})
export class LegalComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private seo = inject(SeoService);

  page = signal<'privacy' | 'terms'>('privacy');

  ngOnInit(): void {
    const segments = this.route.snapshot.url.map(s => s.path);
    const last = segments[segments.length - 1];
    const isTerms = last === 'terms';
    this.page.set(isTerms ? 'terms' : 'privacy');
    const title = isTerms ? 'Términos y Condiciones' : 'Política de Privacidad';
    this.seo.set({ title: `${title} — Solder Studio`, description: title, canonicalPath: `/legal/${last}` });
  }
}
