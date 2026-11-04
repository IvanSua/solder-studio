import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

interface Subscriber {
  id: number;
  email: string;
  name: string | null;
  source: string;
  active: boolean;
  subscribedAt: string;
}

interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

type EditorMode = 'edit' | 'preview';
type SendResult = 'ok' | 'error' | null;
type ActiveTab = 'subscribers' | 'campaign';

@Component({
  selector: 'app-admin-newsletter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Newsletter</h1>
          <p class="subtitle">Gestión de suscriptores y campañas de email</p>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ subscriberCount() }}</span>
          <span class="stat-label">suscriptores activos</span>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab" [class.active]="activeTab() === 'subscribers'"
                (click)="activeTab.set('subscribers')">
          Suscriptores
        </button>
        <button class="tab" [class.active]="activeTab() === 'campaign'"
                (click)="activeTab.set('campaign')">
          Enviar Campaña
        </button>
      </div>

      <!-- ── Tab: Suscriptores ── -->
      @if (activeTab() === 'subscribers') {
        <div class="tab-content">
          @if (loading()) {
            <div class="loading">Cargando suscriptores...</div>
          } @else if (subscribers().length === 0) {
            <div class="empty">
              <p>No hay suscriptores activos todavía.</p>
            </div>
          } @else {
            <div class="table-wrap">
              <table class="subs-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Nombre</th>
                    <th>Origen</th>
                    <th>Fecha</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of subscribers(); track s.id) {
                    <tr>
                      <td class="email-cell">{{ s.email }}</td>
                      <td>{{ s.name ?? '—' }}</td>
                      <td>
                        <span class="source-badge" [attr.data-src]="s.source ? s.source.toLowerCase() : ''">
                          {{ sourceLabel(s.source) }}
                        </span>
                      </td>
                      <td class="date">{{ s.subscribedAt | date:'dd/MM/yyyy' }}</td>
                      <td>
                        <button class="btn-unsub"
                                [disabled]="unsubscribingId() === s.id"
                                (click)="unsubscribe(s)">
                          {{ unsubscribingId() === s.id ? 'Procesando...' : 'Desuscribir' }}
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="table-footer">
              <!-- Page size selector -->
              <div class="page-size">
                <label>Por página:</label>
                <select [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange()">
                  <option [value]="5">5</option>
                  <option [value]="10">10</option>
                  <option [value]="20">20</option>
                  <option [value]="25">25</option>
                </select>
              </div>

              <!-- Pagination -->
              @if (totalPages() > 1) {
                <div class="pagination">
                  <button [disabled]="currentPage() === 0" (click)="loadPage(currentPage() - 1)">
                    ← Anterior
                  </button>
                  <span>Página {{ currentPage() + 1 }} de {{ totalPages() }}</span>
                  <button [disabled]="currentPage() >= totalPages() - 1"
                          (click)="loadPage(currentPage() + 1)">
                    Siguiente →
                  </button>
                </div>
              }

              <span class="total-info">{{ totalElements() }} suscriptores en total</span>
            </div>
          }
        </div>
      }

      <!-- ── Tab: Campaña ── -->
      @if (activeTab() === 'campaign') {
        <div class="tab-content">
          <div class="campaign-form">

            <div class="form-row">
              <div class="form-group">
                <label for="fromName">Nombre del remitente</label>
                <input id="fromName" type="text" [(ngModel)]="fromName"
                       placeholder="Tienda de Ropa" />
              </div>

              <div class="form-group">
                <label for="subject">Asunto del email <span class="required">*</span></label>
                <input id="subject" type="text" [(ngModel)]="subject"
                       placeholder="Ej: ¡Nuevos productos de temporada!" />
              </div>
            </div>

            <div class="form-group">
              <div class="editor-header">
                <label>Cuerpo del email (HTML) <span class="required">*</span></label>
                <div class="editor-tabs">
                  <button [class.active]="editorMode() === 'edit'"
                          (click)="editorMode.set('edit')">Editar</button>
                  <button [class.active]="editorMode() === 'preview'"
                          (click)="editorMode.set('preview')">Vista previa</button>
                </div>
              </div>

              @if (editorMode() === 'edit') {
                <textarea [(ngModel)]="htmlBody" rows="16"
                          placeholder="<p>Hola, te escribimos para contarte...</p>"></textarea>
              } @else {
                <div class="preview-box" [innerHTML]="previewHtml()"></div>
              }
            </div>

            <div class="send-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>Se enviará a <strong>{{ subscriberCount() }}</strong> suscriptores activos</span>
            </div>

            <button class="btn-send"
                    (click)="sendCampaign()"
                    [disabled]="sending() || !subject.trim() || !htmlBody.trim()">
              @if (sending()) {
                <span class="spinner"></span> Enviando...
              } @else {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Enviar campaña
              }
            </button>

            @if (sendResult() !== null) {
              <div class="send-result" [class.success]="sendResult() === 'ok'" [class.error]="sendResult() === 'error'">
                @if (sendResult() === 'ok') {
                  ✓ Campaña enviada exitosamente
                } @else {
                  ✗ Error al enviar la campaña. Revisá los logs.
                }
              </div>
            }

          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    /* ── Layout ── */
    .page { padding: 1.5rem; }

    .page-header {
      display: flex; align-items: flex-start;
      justify-content: space-between; margin-bottom: 1.5rem;
    }
    .page-header h1 { margin: 0 0 4px; font-size: 1.4rem; color: var(--text); }
    .subtitle { margin: 0; font-size: 0.85rem; color: var(--text-secondary); }

    /* ── Stat card ── */
    .stat-card {
      display: flex; flex-direction: column; align-items: center;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 10px; padding: 0.75rem 1.5rem; min-width: 140px;
    }
    .stat-num { font-size: 1.75rem; font-weight: 800; color: var(--primary); line-height: 1; }
    .stat-label { font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px; }

    /* ── Tabs ── */
    .tabs {
      display: flex; gap: 0; border-bottom: 2px solid var(--border);
      margin-bottom: 1.5rem;
    }
    .tab {
      padding: 0.6rem 1.25rem; font-size: 0.9rem; font-weight: 600;
      background: none; border: none; border-bottom: 2px solid transparent;
      margin-bottom: -2px; cursor: pointer; color: var(--text-secondary);
      transition: color 0.15s, border-color 0.15s;
    }
    .tab:hover { color: var(--text); }
    .tab.active { color: var(--primary); border-bottom-color: var(--primary); }

    /* ── Table ── */
    .table-wrap { overflow-x: auto; }
    .subs-table {
      width: 100%; border-collapse: collapse; font-size: 0.875rem;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }
    .subs-table thead th {
      padding: 0.65rem 1rem; text-align: left;
      font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);
      text-transform: uppercase; letter-spacing: 0.04em;
      background: var(--bg-secondary); border-bottom: 1px solid var(--border);
    }
    .subs-table tbody td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); }
    .subs-table tbody tr:last-child td { border-bottom: none; }
    .subs-table tbody tr:hover { background: var(--bg-secondary); }

    .email-cell { font-weight: 500; color: var(--text); }
    .date { color: var(--text-secondary); white-space: nowrap; }

    .source-badge {
      font-size: 0.72rem; font-weight: 600; padding: 2px 8px;
      border-radius: 10px; text-transform: uppercase; letter-spacing: 0.03em;
    }
    .source-badge[data-src="registration"] { background: var(--bg-secondary); color: var(--primary); }
    .source-badge[data-src="checkout"]     { background: var(--success-bg); color: var(--success-text); }
    .source-badge[data-src="manual"]       { background: var(--bg-secondary); color: var(--text); }

    /* ── Table footer ── */
    .table-footer {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 1rem; margin-top: 1rem;
    }
    .page-size {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.85rem; color: var(--text-secondary);
    }
    .page-size select {
      padding: 0.3rem 0.5rem; border: 1px solid var(--border);
      border-radius: 6px; background: var(--bg-card); color: var(--text);
      font-size: 0.85rem; cursor: pointer;
    }
    .pagination { display: flex; align-items: center; gap: 0.75rem; }
    .pagination button {
      padding: 0.4rem 0.9rem; border: 1px solid var(--border);
      border-radius: 6px; background: var(--bg-card); color: var(--text);
      cursor: pointer; font-size: 0.85rem; font-weight: 500;
      transition: background 0.15s;
    }
    .pagination button:hover:not(:disabled) { background: var(--bg-secondary); }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
    .pagination span { font-size: 0.85rem; color: var(--text-secondary); white-space: nowrap; }
    .total-info { font-size: 0.8rem; color: var(--text-secondary); }

    /* ── Unsubscribe button ── */
    .btn-unsub {
      font-size: 0.78rem; font-weight: 600; padding: 0.3rem 0.75rem;
      background: var(--danger-bg); color: var(--danger);
      border: 1px solid var(--danger-border);
      border-radius: 6px; cursor: pointer; transition: opacity 0.15s;
    }
    .btn-unsub:hover:not(:disabled) { opacity: 0.8; }
    .btn-unsub:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Campaign form ── */
    .campaign-form { max-width: 860px; }

    .form-row {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 1rem; margin-bottom: 1rem;
    }
    @media (max-width: 640px) { .form-row { grid-template-columns: 1fr; } }

    .form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
    .form-group label {
      font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);
    }
    .required { color: var(--danger); }

    .form-group input, .form-group textarea {
      padding: 0.6rem 0.75rem; border: 1px solid var(--border);
      border-radius: 8px; background: var(--bg-card); color: var(--text);
      font-size: 0.9rem; width: 100%; box-sizing: border-box;
      transition: border-color 0.15s;
    }
    .form-group input:focus, .form-group textarea:focus {
      outline: none; border-color: var(--primary);
    }
    .form-group textarea { resize: vertical; font-family: 'JetBrains Mono', monospace; }

    /* ── Editor header ── */
    .editor-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 0.4rem;
    }
    .editor-header label { margin: 0; }
    .editor-tabs { display: flex; gap: 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
    .editor-tabs button {
      padding: 0.3rem 0.8rem; font-size: 0.78rem; font-weight: 600;
      background: var(--bg-card); color: var(--text-secondary);
      border: none; cursor: pointer; transition: background 0.15s, color 0.15s;
    }
    .editor-tabs button + button { border-left: 1px solid var(--border); }
    .editor-tabs button.active { background: var(--primary); color: #fff; }

    /* ── Preview box ── */
    .preview-box {
      border: 1px solid var(--border); border-radius: 8px;
      padding: 1rem; min-height: 240px; background: #fff; color: #111;
      font-size: 0.9rem; line-height: 1.6; overflow: auto;
    }

    /* ── Send info ── */
    .send-info {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.875rem; color: var(--text-secondary);
      background: var(--bg-secondary); border: 1px solid var(--border);
      border-radius: 8px; padding: 0.65rem 1rem; margin-bottom: 1.25rem;
    }
    .send-info strong { color: var(--text); }

    /* ── Send button ── */
    .btn-send {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.65rem 1.5rem; background: var(--primary); color: #fff;
      border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 700;
      cursor: pointer; transition: opacity 0.15s;
    }
    .btn-send:hover:not(:disabled) { opacity: 0.88; }
    .btn-send:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Spinner ── */
    .spinner {
      width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff; border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Send result ── */
    .send-result {
      margin-top: 1rem; padding: 0.75rem 1rem; border-radius: 8px;
      font-size: 0.875rem; font-weight: 600;
    }
    .send-result.success { background: var(--success-bg); color: var(--success-text); }
    .send-result.error   { background: var(--danger-bg);  color: var(--danger); }

    /* ── Utils ── */
    .loading, .empty { text-align: center; padding: 3rem; color: var(--text-secondary); }
  `],
})
export class AdminNewsletterComponent implements OnInit {
  private http = inject(HttpClient);

  // State
  activeTab        = signal<ActiveTab>('subscribers');
  subscribers      = signal<Subscriber[]>([]);
  loading          = signal(true);
  unsubscribingId  = signal<number | null>(null);
  totalElements    = signal(0);
  totalPages       = signal(0);
  currentPage      = signal(0);
  subscriberCount  = signal(0);

  // Campaign
  editorMode  = signal<EditorMode>('edit');
  sending     = signal(false);
  sendResult  = signal<SendResult>(null);
  subject     = '';
  htmlBody    = '';
  fromName    = 'Tienda de Ropa';
  pageSize    = 10;

  private readonly base = `${environment.apiUrl}/newsletter`;

  previewHtml(): string {
    return this.htmlBody || '<em style="color:var(--text-secondary)">Sin contenido para previsualizar</em>';
  }

  ngOnInit(): void {
    this.loadPage(0);
    this.loadStats();
  }

  loadPage(page: number): void {
    this.loading.set(true);
    this.http.get<PageResponse<Subscriber>>(
      `${this.base}/admin/subscribers?page=${page}&size=${this.pageSize}&sort=subscribedAt,desc`
    ).subscribe({
      next: (data) => {
        this.subscribers.set(data.content);
        this.totalElements.set(data.totalElements);
        this.totalPages.set(data.totalPages);
        this.currentPage.set(data.number);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
  }

  loadStats(): void {
    this.http.get<{ activeSubscribers: number }>(`${this.base}/admin/stats`).subscribe({
      next: (data) => this.subscriberCount.set(data.activeSubscribers),
    });
  }

  onPageSizeChange(): void {
    this.loadPage(0);
  }

  unsubscribe(s: Subscriber): void {
    if (!confirm(`¿Desuscribir a ${s.email}? Esta acción no se puede deshacer.`)) return;
    this.unsubscribingId.set(s.id);
    this.http.post(`${this.base}/admin/unsubscribe/${s.id}`, {}).subscribe({
      next: () => {
        this.subscribers.update(list => list.filter(x => x.id !== s.id));
        this.totalElements.update(n => n - 1);
        this.subscriberCount.update(n => n - 1);
        this.unsubscribingId.set(null);
      },
      error: () => { this.unsubscribingId.set(null); },
    });
  }

  sendCampaign(): void {
    if (!this.subject.trim() || !this.htmlBody.trim()) return;
    if (!confirm(`¿Enviar campaña a ${this.subscriberCount()} suscriptores?`)) return;

    this.sending.set(true);
    this.sendResult.set(null);

    this.http.post<{ message: string }>(`${this.base}/admin/send-campaign`, {
      subject: this.subject,
      body: this.htmlBody,
      fromName: this.fromName || 'Tienda de Ropa',
    }).subscribe({
      next: () => {
        this.sending.set(false);
        this.sendResult.set('ok');
      },
      error: () => {
        this.sending.set(false);
        this.sendResult.set('error');
      },
    });
  }

  sourceLabel(src: string): string {
    const labels: Record<string, string> = {
      REGISTRATION: 'Registro',
      CHECKOUT:     'Checkout',
      MANUAL:       'Manual',
    };
    return labels[src?.toUpperCase()] ?? (src ?? '—');
  }
}
