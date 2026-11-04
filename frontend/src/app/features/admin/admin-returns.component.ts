import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

interface ReturnItem {
  id: number;
  orderId: number;
  reason: string;
  description: string | null;
  resolution: string;
  status: string;
  adminNotes: string | null;
  refundAmount: number | null;
  refundProcessed: boolean;
  createdAt: string;
  updatedAt: string;
  // Extended from admin endpoint (joined from order/user)
  customerName?: string;
  customerEmail?: string;
}

interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'PENDING',     label: 'Pendiente' },
  { value: 'APPROVED',    label: 'Aprobada' },
  { value: 'IN_PROGRESS', label: 'En proceso' },
  { value: 'COMPLETED',   label: 'Completada' },
  { value: 'REJECTED',    label: 'Rechazada' },
];

const REASON_LABELS: Record<string, string> = {
  DEFECTIVE:    'Producto defectuoso',
  WRONG_SIZE:   'Talle incorrecto',
  WRONG_ITEM:   'Producto incorrecto',
  CHANGED_MIND: 'Cambió de opinión',
  OTHER:        'Otro',
};

const RESOLUTION_LABELS: Record<string, string> = {
  REFUND:   'Reembolso',
  EXCHANGE: 'Cambio',
};

@Component({
  selector: 'app-admin-returns',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Devoluciones</h1>
          <p class="subtitle">Gestión de solicitudes de devolución y cambio</p>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar">
        @for (opt of statusOptions; track opt.value) {
          <button class="filter-btn"
            [class.active]="statusFilter === opt.value"
            (click)="setFilter(opt.value)">
            {{ opt.label }}
            @if (opt.value && counts()[opt.value]) {
              <span class="count-badge">{{ counts()[opt.value] }}</span>
            }
          </button>
        }
      </div>

      <!-- Table -->
      @if (loading()) {
        <div class="loading">Cargando...</div>
      } @else if (returns().length === 0) {
        <div class="empty">No hay solicitudes de devolución para este filtro.</div>
      } @else {
        <div class="table-wrap">
          <table class="returns-table">
            <thead>
              <tr>
                <th>#ID</th>
                <th>Pedido</th>
                <th>Motivo</th>
                <th>Resolución</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (r of returns(); track r.id) {
                <tr [class.expanded]="expandedId() === r.id">
                  <td class="mono">#{{ r.id }}</td>
                  <td>
                    <a [href]="'/admin/orders?q=' + r.orderId" class="order-link">
                      Pedido #{{ r.orderId }}
                    </a>
                  </td>
                  <td>{{ reasonLabel(r.reason) }}</td>
                  <td>
                    <span class="resolution-badge" [attr.data-res]="r.resolution.toLowerCase()">
                      {{ resolutionLabel(r.resolution) }}
                    </span>
                  </td>
                  <td>
                    <span class="status-badge" [attr.data-status]="r.status.toLowerCase()">
                      {{ statusLabel(r.status) }}
                    </span>
                  </td>
                  <td class="date">{{ r.createdAt | date:'dd/MM/yy' }}</td>
                  <td>
                    <button class="btn-detail" (click)="toggleExpand(r.id)">
                      {{ expandedId() === r.id ? 'Cerrar ▲' : 'Gestionar ▼' }}
                    </button>
                  </td>
                </tr>

                <!-- Expanded detail + action row -->
                @if (expandedId() === r.id) {
                  <tr class="detail-row">
                    <td colspan="7">
                      <div class="detail-panel">

                        @if (r.description) {
                          <div class="detail-field">
                            <span class="detail-label">Descripción del cliente</span>
                            <p class="detail-value">{{ r.description }}</p>
                          </div>
                        }

                        <!-- Admin notes input -->
                        <div class="detail-field">
                          <label class="detail-label" [for]="'notes-' + r.id">
                            Notas internas (no visibles para el cliente)
                          </label>
                          <textarea [id]="'notes-' + r.id"
                            [(ngModel)]="editNotes()[r.id]"
                            rows="2"
                            placeholder="Agregar notas internas...">
                          </textarea>
                        </div>

                        <!-- Status actions -->
                        <div class="action-row">
                          <span class="detail-label">Cambiar estado:</span>
                          <div class="status-buttons">
                            @if (r.status === 'PENDING') {
                              <button class="btn-approve"
                                [disabled]="saving()"
                                (click)="updateStatus(r, 'APPROVED')">
                                ✓ Aprobar
                              </button>
                              <button class="btn-reject"
                                [disabled]="saving()"
                                (click)="updateStatus(r, 'REJECTED')">
                                ✕ Rechazar
                              </button>
                            }
                            @if (r.status === 'APPROVED') {
                              <button class="btn-progress"
                                [disabled]="saving()"
                                (click)="updateStatus(r, 'IN_PROGRESS')">
                                ⚙ Marcar en proceso
                              </button>
                            }
                            @if (r.status === 'IN_PROGRESS') {
                              <button class="btn-complete"
                                [disabled]="saving()"
                                (click)="updateStatus(r, 'COMPLETED')">
                                ✓ Marcar completada
                              </button>
                            }
                          </div>
                          <button class="btn-save-notes"
                            [disabled]="saving()"
                            (click)="saveNotes(r)">
                            Guardar notas
                          </button>
                        </div>

                        <!-- Partial refund section (REFUND resolution only) -->
                        @if (r.resolution === 'REFUND') {
                          <div class="refund-section">
                            <span class="detail-label">Reembolso MercadoPago</span>
                            @if (r.refundProcessed) {
                              <div class="refund-done">
                                ✓ Reembolso procesado: {{ '$' + ((r.refundAmount ?? 0) / 100 | number:'1.2-2') }} ARS
                              </div>
                            } @else {
                              <div class="refund-input-row">
                                <input
                                  type="number"
                                  class="refund-input"
                                  [(ngModel)]="refundAmounts()[r.id]"
                                  placeholder="Monto en pesos (ej: 1500)"
                                  min="1"
                                  step="0.01"
                                />
                                <button class="btn-refund"
                                  [disabled]="saving() || !refundAmounts()[r.id]"
                                  (click)="issueRefund(r)">
                                  Emitir reembolso
                                </button>
                              </div>
                              <p class="refund-hint">Ingresá el monto en pesos ARS. Solo aplica si el pago fue vía MercadoPago.</p>
                            }
                          </div>
                        }

                        @if (saveError()) {
                          <p class="error-msg">{{ saveError() }}</p>
                        }

                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div class="pagination">
            <button [disabled]="currentPage() === 0" (click)="loadPage(currentPage() - 1)">Anterior</button>
            <span>Página {{ currentPage() + 1 }} de {{ totalPages() }}</span>
            <button [disabled]="currentPage() >= totalPages() - 1" (click)="loadPage(currentPage() + 1)">Siguiente</button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .page { padding: 1.5rem; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.25rem; }
    .page-header h1 { margin: 0 0 4px; font-size: 1.4rem; color: var(--text); }
    .subtitle { margin: 0; font-size: 0.85rem; color: var(--text-secondary); }

    /* Filter bar */
    .filter-bar { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .filter-btn {
      display: flex; align-items: center; gap: 5px;
      padding: 0.4rem 0.9rem; border: 1px solid var(--border);
      border-radius: 20px; background: var(--bg-card); font-size: 0.82rem;
      color: var(--text); cursor: pointer; transition: all 0.15s;
    }
    .filter-btn:hover { border-color: var(--text-secondary); background: var(--bg-secondary); }
    .filter-btn.active { background: var(--text); color: var(--bg-card); border-color: var(--text); }
    .count-badge {
      background: rgba(255,255,255,0.25); color: inherit;
      font-size: 0.7rem; font-weight: 700; padding: 0 5px;
      border-radius: 10px; min-width: 18px; text-align: center;
    }
    .filter-btn:not(.active) .count-badge { background: var(--bg-secondary); color: var(--text-secondary); }

    /* Table */
    .table-wrap { overflow-x: auto; }
    .returns-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .returns-table thead th {
      padding: 0.65rem 1rem; text-align: left;
      font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);
      text-transform: uppercase; letter-spacing: 0.04em;
      background: var(--bg-secondary); border-bottom: 1px solid var(--border);
    }
    .returns-table tbody td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); }
    .returns-table tbody tr:last-child td { border-bottom: none; }
    .returns-table tbody tr.expanded td { background: var(--bg-secondary); }

    .mono { font-family: monospace; font-weight: 600; color: var(--text); }
    .order-link { color: var(--primary); text-decoration: none; font-weight: 500; }
    .order-link:hover { text-decoration: underline; }
    .date { color: var(--text-secondary); white-space: nowrap; }

    /* Badges */
    .status-badge {
      font-size: 0.72rem; font-weight: 600; padding: 2px 10px;
      border-radius: 12px; text-transform: uppercase; letter-spacing: 0.03em;
    }
    .status-badge[data-status="pending"]     { background: var(--warning-bg); color: var(--warning-text); }
    .status-badge[data-status="approved"]    { background: var(--success-bg); color: var(--success-text); }
    .status-badge[data-status="in_progress"] { background: var(--info-bg); color: var(--info-text); }
    .status-badge[data-status="completed"]   { background: var(--success-bg); color: var(--success-text); }
    .status-badge[data-status="rejected"]    { background: var(--danger-bg); color: var(--danger); }

    .resolution-badge {
      font-size: 0.72rem; font-weight: 600; padding: 2px 8px;
      border-radius: 10px;
    }
    .resolution-badge[data-res="refund"]   { background: var(--info-bg); color: var(--info-text); }
    .resolution-badge[data-res="exchange"] { background: var(--info-bg); color: var(--info-text); }

    /* Action buttons */
    .btn-detail {
      font-size: 0.78rem; font-weight: 600; padding: 0.3rem 0.75rem;
      background: var(--bg-secondary); color: var(--text); border: 1px solid var(--border);
      border-radius: 6px; cursor: pointer; white-space: nowrap;
    }
    .btn-detail:hover { background: var(--border); }

    /* Detail panel */
    .detail-row td { padding: 0; }
    .detail-panel {
      padding: 1.25rem 1.5rem;
      background: var(--bg-secondary);
      border-top: 1px dashed var(--info-border);
      border-bottom: 1px dashed var(--info-border);
    }
    .detail-field { margin-bottom: 0.75rem; }
    .detail-label { display: block; font-size: 0.75rem; font-weight: 700; color: var(--info-text); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
    .detail-value { margin: 0; font-size: 0.875rem; color: var(--text); line-height: 1.5; }
    .detail-panel textarea {
      width: 100%; max-width: 500px; padding: 0.5rem 0.65rem;
      border: 1px solid var(--border); border-radius: 6px;
      font-size: 0.875rem; resize: vertical; box-sizing: border-box;
    }
    .detail-panel textarea:focus { outline: none; border-color: var(--info-border); box-shadow: 0 0 0 2px var(--info-bg); }

    .action-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.25rem; }
    .status-buttons { display: flex; gap: 0.5rem; }
    .btn-approve { padding: 0.4rem 0.85rem; background: var(--success); color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; }
    .btn-approve:hover:not(:disabled) { background: var(--success-text); }
    .btn-reject  { padding: 0.4rem 0.85rem; background: var(--danger); color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; }
    .btn-reject:hover:not(:disabled) { background: var(--danger-text); }
    .btn-progress{ padding: 0.4rem 0.85rem; background: var(--info); color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; }
    .btn-progress:hover:not(:disabled) { background: var(--info-text); }
    .btn-complete{ padding: 0.4rem 0.85rem; background: var(--success-text); color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; }
    .btn-complete:hover:not(:disabled) { background: var(--success-text); opacity: 0.85; }
    .btn-save-notes { padding: 0.4rem 0.85rem; background: var(--info-text); color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; margin-left: auto; }
    .btn-save-notes:hover:not(:disabled) { background: var(--info-text); opacity: 0.85; }
    button:disabled { opacity: 0.55; cursor: not-allowed; }

    .error-msg { color: var(--danger); font-size: 0.82rem; margin-top: 0.5rem; }

    /* Refund section */
    .refund-section { margin-top: 1rem; padding-top: 0.75rem; border-top: 1px dashed var(--info-border); }
    .refund-done { display: flex; align-items: center; gap: 0.5rem; color: var(--success-text); font-weight: 600; font-size: 0.875rem; background: var(--success-bg); padding: 0.5rem 0.75rem; border-radius: 6px; }
    .refund-input-row { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem; }
    .refund-input { border: 1px solid var(--border); border-radius: 6px; padding: 0.4rem 0.65rem; font-size: 0.875rem; width: 180px; }
    .refund-input:focus { outline: none; border-color: var(--info-border); box-shadow: 0 0 0 2px var(--info-bg); }
    .btn-refund { padding: 0.4rem 0.85rem; background: var(--info-text); color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; white-space: nowrap; }
    .btn-refund:hover:not(:disabled) { background: var(--info-text); opacity: 0.85; }
    .btn-refund:disabled { opacity: 0.55; cursor: not-allowed; }
    .refund-hint { margin: 0.35rem 0 0; font-size: 0.75rem; color: var(--text-secondary); }

    /* Pagination */
    .pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.5rem; }
    .pagination button { padding: 0.5rem 1rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card); cursor: pointer; }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
    .pagination span { font-size: 0.9rem; color: var(--text-secondary); }

    .loading, .empty { text-align: center; padding: 3rem; color: var(--text-secondary); }
  `],
})
export class AdminReturnsComponent implements OnInit {
  private http = inject(HttpClient);

  returns      = signal<ReturnItem[]>([]);
  loading      = signal(true);
  saving       = signal(false);
  saveError    = signal<string | null>(null);
  expandedId   = signal<number | null>(null);
  editNotes    = signal<Record<number, string>>({});
  refundAmounts = signal<Record<number, number>>({});
  totalPages   = signal(0);
  currentPage  = signal(0);

  statusFilter = '';
  readonly statusOptions = STATUS_OPTIONS;

  // Count per status from current loaded page (simplified)
  readonly counts = signal<Record<string, number>>({});

  ngOnInit(): void {
    this.loadPage(0);
  }

  setFilter(status: string): void {
    this.statusFilter = status;
    this.loadPage(0);
  }

  loadPage(page: number): void {
    this.loading.set(true);
    this.expandedId.set(null);
    this.saveError.set(null);

    const params: Record<string, string> = { page: String(page), size: '20', sort: 'createdAt,desc' };
    if (this.statusFilter) params['status'] = this.statusFilter;

    const queryString = new URLSearchParams(params).toString();

    this.http.get<Page<ReturnItem>>(`${environment.apiUrl}/admin/returns?${queryString}`).subscribe({
      next: (data) => {
        this.returns.set(data.content);
        this.totalPages.set(data.totalPages);
        this.currentPage.set(data.number);

        // Seed editNotes with existing adminNotes
        const notesMap: Record<number, string> = {};
        data.content.forEach(r => { notesMap[r.id] = r.adminNotes ?? ''; });
        this.editNotes.set(notesMap);

        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
  }

  toggleExpand(id: number): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
    this.saveError.set(null);
  }

  updateStatus(r: ReturnItem, status: string): void {
    this.saving.set(true);
    this.saveError.set(null);
    const body: Record<string, string> = { status };
    const notes = this.editNotes()[r.id];
    if (notes) body['adminNotes'] = notes;

    this.http.patch<ReturnItem>(`${environment.apiUrl}/admin/returns/${r.id}`, body).subscribe({
      next: (updated) => {
        this.returns.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.saving.set(false);
        this.expandedId.set(null);
      },
      error: (err) => {
        this.saveError.set(err?.error?.message ?? 'Error al actualizar el estado.');
        this.saving.set(false);
      },
    });
  }

  saveNotes(r: ReturnItem): void {
    this.saving.set(true);
    this.saveError.set(null);
    const notes = this.editNotes()[r.id] ?? '';
    this.http.patch<ReturnItem>(`${environment.apiUrl}/admin/returns/${r.id}`, { adminNotes: notes }).subscribe({
      next: (updated) => {
        this.returns.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.saving.set(false);
      },
      error: (err) => {
        this.saveError.set(err?.error?.message ?? 'Error al guardar notas.');
        this.saving.set(false);
      },
    });
  }

  issueRefund(r: ReturnItem): void {
    const amountPesos = this.refundAmounts()[r.id];
    if (!amountPesos || amountPesos <= 0) return;
    const amountCentavos = Math.round(amountPesos * 100);

    this.saving.set(true);
    this.saveError.set(null);
    this.http.post<ReturnItem>(`${environment.apiUrl}/admin/returns/${r.id}/refund`, { amount: amountCentavos }).subscribe({
      next: (updated) => {
        this.returns.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.saving.set(false);
      },
      error: (err) => {
        this.saveError.set(err?.error?.error ?? 'Error al procesar el reembolso.');
        this.saving.set(false);
      },
    });
  }

  reasonLabel(key: string): string     { return REASON_LABELS[key] ?? key; }
  resolutionLabel(key: string): string { return RESOLUTION_LABELS[key] ?? key; }

  statusLabel(status: string): string {
    return STATUS_OPTIONS.find(s => s.value === status)?.label ?? status;
  }
}
