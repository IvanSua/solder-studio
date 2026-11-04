import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';
import { ToastService } from '@core/services/toast.service';

type PromotionScope = 'GLOBAL' | 'PRODUCT' | 'CATEGORY';
type PromotionType  = 'PERCENTAGE' | 'FIXED_AMOUNT';

interface Promotion {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  scope: PromotionScope;
  type: PromotionType;
  value: number;          // basis-points×100 for PERCENTAGE; centavos for FIXED_AMOUNT
  priority: number;
  stackable: boolean;
  active: boolean;
  startsAt: string;
  endsAt: string;
  targetProductId: number | null;
  targetCategoryId: number | null;
  minimumPurchaseAmount: number | null;
}

interface PromotionForm {
  name: string;
  code: string;
  description: string;
  scope: PromotionScope;
  type: PromotionType;
  valueDisplay: number;   // % for PERCENTAGE; pesos for FIXED_AMOUNT
  priority: number;
  stackable: boolean;
  active: boolean;
  startsAt: string;
  endsAt: string;
  targetProductId: number | null;
  targetCategoryId: number | null;
  minimumPurchaseAmountDisplay: number;  // pesos
}

function blankForm(): PromotionForm {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    name: '', code: '', description: '', scope: 'GLOBAL', type: 'PERCENTAGE',
    valueDisplay: 10, priority: 0, stackable: false, active: true,
    startsAt: now.toISOString().substring(0, 16),
    endsAt: future.toISOString().substring(0, 16),
    targetProductId: null, targetCategoryId: null, minimumPurchaseAmountDisplay: 0,
  };
}

@Component({
  selector: 'app-admin-promotions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="header-left">
          <h2>Promociones y cupones</h2>
          <span class="count-badge">{{ total }}</span>
        </div>
        <button class="btn-primary" (click)="openCreate()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva promoción
        </button>
      </div>

      @if (errorMessage()) {
        <div class="alert-error">{{ errorMessage() }}</div>
      }

      <!-- Table -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Código</th>
              <th>Tipo</th>
              <th>Descuento</th>
              <th>Alcance</th>
              <th>Vigencia</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              @for (i of [1,2,3]; track i) {
                <tr class="skeleton-row">
                  <td><div class="skel w-32"></div></td>
                  <td><div class="skel w-20"></div></td>
                  <td><div class="skel w-20"></div></td>
                  <td><div class="skel w-16"></div></td>
                  <td><div class="skel w-16"></div></td>
                  <td><div class="skel w-28"></div></td>
                  <td><div class="skel w-16"></div></td>
                  <td><div class="skel w-20"></div></td>
                </tr>
              }
            } @else if (promotions.length === 0) {
              <tr><td colspan="8" class="empty-cell">
                <div class="empty-state">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                  <p>No hay promociones aún. ¡Creá una!</p>
                </div>
              </td></tr>
            }
            @for (p of promotions; track p.id) {
              <tr>
                <td>
                  <div class="promo-name">{{ p.name }}</div>
                  @if (p.description) {
                    <div class="promo-desc">{{ p.description }}</div>
                  }
                </td>
                <td>
                  @if (p.code) {
                    <code class="coupon-code">{{ p.code }}</code>
                  } @else {
                    <span class="auto-tag">Automática</span>
                  }
                </td>
                <td>
                  <span class="type-badge" [attr.data-type]="p.type">
                    {{ p.type === 'PERCENTAGE' ? '%' : '$' }} {{ p.type === 'PERCENTAGE' ? 'Porcentaje' : 'Fijo' }}
                  </span>
                </td>
                <td class="value-cell">{{ formatDiscount(p) }}</td>
                <td>
                  <span class="scope-badge" [attr.data-scope]="p.scope">{{ scopeLabel(p.scope) }}</span>
                </td>
                <td class="date-cell">
                  <span>{{ p.startsAt | date: 'dd/MM/yy' }}</span>
                  <span class="date-sep">→</span>
                  <span>{{ p.endsAt | date: 'dd/MM/yy' }}</span>
                </td>
                <td>
                  <span class="status-dot" [class.active]="p.active" [class.inactive]="!p.active">
                    {{ p.active ? 'Activa' : 'Inactiva' }}
                  </span>
                </td>
                <td>
                  <div class="action-btns">
                    <button class="btn-icon edit" title="Editar" (click)="openEdit(p)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn-icon delete" title="Eliminar" (click)="deletePromotion(p)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (totalPages > 1) {
        <div class="pagination">
          <button (click)="loadPage(currentPage - 1)" [disabled]="currentPage === 0">‹</button>
          @for (p of pageNumbers(); track p) {
            <button (click)="loadPage(p)" [class.active]="p === currentPage">{{ p + 1 }}</button>
          }
          <button (click)="loadPage(currentPage + 1)" [disabled]="currentPage >= totalPages - 1">›</button>
        </div>
      }
    </div>

    <!-- ── Modal ─────────────────────────────────────────────────── -->
    @if (showModal()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingId ? 'Editar promoción' : 'Nueva promoción' }}</h3>
            <button class="modal-close" (click)="closeModal()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="modal-body">
            @if (modalError()) {
              <div class="alert-error small">{{ modalError() }}</div>
            }

            <div class="form-grid">
              <!-- Name -->
              <div class="form-group span-2">
                <label>Nombre <span class="req">*</span></label>
                <input type="text" [(ngModel)]="form.name" placeholder="Ej: Descuento verano 20%" />
              </div>

              <!-- Code -->
              <div class="form-group">
                <label>Código de cupón</label>
                <input type="text" [(ngModel)]="form.code" placeholder="Ej: VERANO20 (opcional)" style="text-transform: uppercase;" />
                <span class="hint">Dejar vacío para descuento automático</span>
              </div>

              <!-- Description -->
              <div class="form-group">
                <label>Descripción</label>
                <input type="text" [(ngModel)]="form.description" placeholder="Descripción interna (opcional)" />
              </div>

              <!-- Type + Value -->
              <div class="form-group">
                <label>Tipo de descuento <span class="req">*</span></label>
                <select [(ngModel)]="form.type">
                  <option value="PERCENTAGE">Porcentaje (%)</option>
                  <option value="FIXED_AMOUNT">Monto fijo ($)</option>
                </select>
              </div>
              <div class="form-group">
                <label>{{ form.type === 'PERCENTAGE' ? 'Porcentaje (ej: 15 = 15%)' : 'Descuento en pesos' }} <span class="req">*</span></label>
                <input type="number" [(ngModel)]="form.valueDisplay" min="0" [max]="form.type === 'PERCENTAGE' ? 100 : null" step="0.01" />
              </div>

              <!-- Scope -->
              <div class="form-group">
                <label>Alcance <span class="req">*</span></label>
                <select [(ngModel)]="form.scope">
                  <option value="GLOBAL">Global (todo el carrito)</option>
                  <option value="PRODUCT">Producto específico</option>
                  <option value="CATEGORY">Categoría específica</option>
                </select>
              </div>

              <!-- Conditional target IDs -->
              @if (form.scope === 'PRODUCT') {
                <div class="form-group">
                  <label>ID del producto <span class="req">*</span></label>
                  <input type="number" [(ngModel)]="form.targetProductId" placeholder="ID del producto" min="1" />
                </div>
              }
              @if (form.scope === 'CATEGORY') {
                <div class="form-group">
                  <label>ID de la categoría <span class="req">*</span></label>
                  <input type="number" [(ngModel)]="form.targetCategoryId" placeholder="ID de la categoría" min="1" />
                </div>
              }

              <!-- Minimum purchase -->
              <div class="form-group">
                <label>Compra mínima ($ pesos)</label>
                <input type="number" [(ngModel)]="form.minimumPurchaseAmountDisplay" min="0" step="0.01" placeholder="0 = sin mínimo" />
              </div>

              <!-- Priority -->
              <div class="form-group">
                <label>Prioridad</label>
                <input type="number" [(ngModel)]="form.priority" min="0" />
                <span class="hint">Mayor número = se aplica antes</span>
              </div>

              <!-- Dates -->
              <div class="form-group">
                <label>Inicio <span class="req">*</span></label>
                <input type="datetime-local" [(ngModel)]="form.startsAt" />
              </div>
              <div class="form-group">
                <label>Vencimiento <span class="req">*</span></label>
                <input type="datetime-local" [(ngModel)]="form.endsAt" />
              </div>

              <!-- Flags -->
              <div class="form-group checkboxes span-2">
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="form.stackable" />
                  Apilable (se combina con otras promociones)
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="form.active" />
                  Activa
                </label>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn-primary" (click)="savePromotion()" [disabled]="saving()">
              @if (saving()) { <span class="spinner-sm"></span> Guardando... }
              @else { {{ editingId ? 'Guardar cambios' : 'Crear promoción' }} }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .page { padding: 1.5rem; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
    .header-left { display: flex; align-items: center; gap: 0.75rem; }
    h2 { margin: 0; font-size: 1.3rem; font-weight: 700; }
    .count-badge { background: var(--primary); color: white; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 12px; }

    .btn-primary {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.55rem 1rem; background: var(--primary); color: white;
      border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-primary:not(:disabled):hover { opacity: 0.9; }
    .btn-secondary {
      padding: 0.55rem 1rem; background: var(--bg-card); color: var(--text);
      border: 1.5px solid var(--border); border-radius: 8px; font-size: 0.875rem;
      font-weight: 500; cursor: pointer; transition: background 0.15s;
    }
    .btn-secondary:hover { background: var(--bg-secondary); }

    .alert-error { background: var(--danger-bg); border: 1px solid var(--danger-border); color: var(--danger-text); padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.875rem; }
    .alert-error.small { padding: 0.5rem 0.75rem; font-size: 0.82rem; margin-bottom: 0.75rem; }

    .table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; }
    table { width: 100%; border-collapse: collapse; min-width: 750px; }
    thead { background: var(--bg-secondary); }
    th { padding: 0.6rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); }
    td { padding: 0.75rem 1rem; border-top: 1px solid var(--border); font-size: 0.875rem; vertical-align: middle; }

    .promo-name { font-weight: 600; }
    .promo-desc { font-size: 0.775rem; color: var(--text-secondary); margin-top: 2px; }

    .coupon-code { background: var(--success-bg); color: var(--success); border: 1px solid var(--success-border); border-radius: 5px; padding: 2px 7px; font-family: monospace; font-size: 0.82rem; font-weight: 700; letter-spacing: 0.05em; }
    .auto-tag { font-size: 0.75rem; color: var(--text-secondary); font-style: italic; }

    .type-badge { font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 10px; }
    .type-badge[data-type="PERCENTAGE"] { background: var(--bg-secondary); color: var(--primary); }
    .type-badge[data-type="FIXED_AMOUNT"] { background: var(--warning-bg); color: var(--warning-text); }

    .value-cell { font-weight: 700; color: var(--text); }

    .scope-badge { font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 10px; }
    .scope-badge[data-scope="GLOBAL"]   { background: var(--bg-secondary); color: var(--text); }
    .scope-badge[data-scope="PRODUCT"]  { background: var(--info-bg); color: var(--info-text); }
    .scope-badge[data-scope="CATEGORY"] { background: var(--bg-secondary); color: var(--primary); }

    .date-cell { display: flex; align-items: center; gap: 0.25rem; font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap; }
    .date-sep { color: var(--border); }

    .status-dot { font-size: 0.78rem; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
    .status-dot.active { background: var(--success-bg); color: var(--success); }
    .status-dot.inactive { background: var(--danger-bg); color: var(--danger); }

    .action-btns { display: flex; gap: 0.35rem; }
    .btn-icon { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card); color: var(--text-secondary); cursor: pointer; transition: all 0.15s; }
    .btn-icon.edit:hover { background: var(--bg-secondary); border-color: var(--info-border); color: var(--primary-dark); }
    .btn-icon.delete:hover { background: var(--danger-bg); border-color: var(--danger-border); color: var(--danger); }

    .empty-cell { text-align: center; padding: 3rem; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: var(--text-secondary); }
    .empty-state p { margin: 0; font-size: 0.875rem; }
    .skeleton-row td { padding: 0.75rem 1rem; }
    .skel { height: 12px; border-radius: 4px; background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--border) 50%, var(--bg-secondary) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
    .w-16 { width: 64px; } .w-20 { width: 80px; } .w-28 { width: 112px; } .w-32 { width: 128px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .pagination { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 1rem; }
    .pagination button { min-width: 32px; height: 32px; padding: 0 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card); cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .pagination button.active { background: var(--primary); color: white; border-color: transparent; }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Modal */
    .modal-backdrop { position: fixed; inset: 0; background: var(--overlay); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .modal { background: var(--bg-card); border-radius: 14px; width: 100%; max-width: 640px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); }
    .modal-header h3 { margin: 0; font-size: 1.05rem; font-weight: 700; }
    .modal-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 4px; display: flex; align-items: center; border-radius: 6px; }
    .modal-close:hover { background: var(--bg-secondary); color: var(--text); }
    .modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--border); }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .form-group.span-2 { grid-column: span 2; }
    .form-group.checkboxes { gap: 0.5rem; }
    .form-group label { font-size: 0.82rem; font-weight: 600; color: var(--text); }
    .form-group input, .form-group select {
      padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 8px;
      font-size: 0.875rem; outline: none; transition: border-color 0.15s;
    }
    .form-group input:focus, .form-group select:focus { border-color: var(--primary); }
    .req { color: var(--danger); }
    .hint { font-size: 0.75rem; color: var(--text-secondary); }
    .checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; cursor: pointer; }
    .checkbox-label input { width: 16px; height: 16px; cursor: pointer; }

    .spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class AdminPromotionsComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private readonly apiUrl = `${environment.apiUrl}/admin/promotions`;

  promotions: Promotion[] = [];
  loading = signal(true);
  errorMessage = signal('');
  showModal = signal(false);
  saving = signal(false);
  modalError = signal('');

  editingId: number | null = null;
  form: PromotionForm = blankForm();

  currentPage = 0;
  totalPages = 0;
  total = 0;
  pageSize = 20;

  ngOnInit(): void {
    this.loadPage(0);
  }

  loadPage(page: number): void {
    this.loading.set(true);
    const params = new HttpParams().set('page', page).set('size', this.pageSize);
    this.http.get<{ content: Promotion[]; totalElements: number; totalPages: number }>(
      this.apiUrl, { params }
    ).subscribe({
      next: r => {
        this.promotions = r.content;
        this.total = r.totalElements;
        this.totalPages = r.totalPages;
        this.currentPage = page;
        this.loading.set(false);
      },
      error: err => {
        this.errorMessage.set(err.error?.error || 'Error al cargar las promociones');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.form = blankForm();
    this.modalError.set('');
    this.showModal.set(true);
  }

  openEdit(p: Promotion): void {
    this.editingId = p.id;
    this.modalError.set('');
    this.form = {
      name: p.name,
      code: p.code ?? '',
      description: p.description ?? '',
      scope: p.scope,
      type: p.type,
      valueDisplay: p.type === 'PERCENTAGE'
        ? +(p.value / 100).toFixed(2)   // basis-points → %
        : +(p.value / 100).toFixed(2),  // centavos → pesos
      priority: p.priority,
      stackable: p.stackable,
      active: p.active,
      startsAt: p.startsAt.substring(0, 16),
      endsAt: p.endsAt.substring(0, 16),
      targetProductId: p.targetProductId,
      targetCategoryId: p.targetCategoryId,
      minimumPurchaseAmountDisplay: p.minimumPurchaseAmount != null ? +(p.minimumPurchaseAmount / 100).toFixed(2) : 0,
    };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingId = null;
  }

  savePromotion(): void {
    if (!this.form.name.trim()) {
      this.modalError.set('El nombre es requerido.');
      return;
    }

    // Convert display values back to storage format
    const value = this.form.type === 'PERCENTAGE'
      ? Math.round(this.form.valueDisplay * 100)   // % × 100 → basis points
      : Math.round(this.form.valueDisplay * 100);  // pesos × 100 → centavos

    const payload = {
      name: this.form.name.trim(),
      code: this.form.code.trim().toUpperCase() || null,
      description: this.form.description.trim() || null,
      scope: this.form.scope,
      type: this.form.type,
      value,
      priority: this.form.priority,
      stackable: this.form.stackable,
      active: this.form.active,
      startsAt: new Date(this.form.startsAt).toISOString(),
      endsAt: new Date(this.form.endsAt).toISOString(),
      targetProductId: this.form.scope === 'PRODUCT' ? this.form.targetProductId : null,
      targetCategoryId: this.form.scope === 'CATEGORY' ? this.form.targetCategoryId : null,
      minimumPurchaseAmount: this.form.minimumPurchaseAmountDisplay > 0
        ? Math.round(this.form.minimumPurchaseAmountDisplay * 100)
        : null,
    };

    this.saving.set(true);
    this.modalError.set('');

    const req$ = this.editingId
      ? this.http.put<Promotion>(`${this.apiUrl}/${this.editingId}`, payload)
      : this.http.post<Promotion>(this.apiUrl, payload);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.toast.success(this.editingId ? 'Promoción actualizada' : 'Promoción creada');
        this.loadPage(this.currentPage);
      },
      error: err => {
        this.saving.set(false);
        this.modalError.set(err.error?.error || 'Error al guardar la promoción');
      },
    });
  }

  deletePromotion(p: Promotion): void {
    if (!confirm(`¿Eliminar la promoción "${p.name}"?`)) return;
    this.http.delete(`${this.apiUrl}/${p.id}`).subscribe({
      next: () => {
        this.toast.success('Promoción eliminada');
        this.loadPage(this.currentPage);
      },
      error: err => this.errorMessage.set(err.error?.error || 'Error al eliminar'),
    });
  }

  formatDiscount(p: Promotion): string {
    if (p.type === 'PERCENTAGE') {
      return `${(p.value / 100).toFixed(2).replace(/\.00$/, '')}%`;
    }
    const pesos = (p.value / 100).toFixed(2);
    return `$${parseFloat(pesos).toLocaleString('es-AR')}`;
  }

  scopeLabel(scope: PromotionScope): string {
    const m: Record<PromotionScope, string> = { GLOBAL: 'Global', PRODUCT: 'Producto', CATEGORY: 'Categoría' };
    return m[scope] ?? scope;
  }

  pageNumbers(): number[] {
    const start = Math.max(0, this.currentPage - 2);
    const end = Math.min(this.totalPages, start + 5);
    return Array.from({ length: end - start }, (_, i) => start + i);
  }
}
