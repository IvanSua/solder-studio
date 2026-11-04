import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';
import { PricePipe } from '@shared/pipes/price.pipe';
import { ToastService } from '@core/services/toast.service';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ALL_STATUSES = [
  'pending', 'awaiting_payment', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded'
] as const;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type OrderStatus = typeof ALL_STATUSES[number];

interface DesignAsset {
  assetId: number;
  sortOrder: number;
  mimeType: string;
  widthPx: number;
  heightPx: number;
  normalizedUrl: string;
  originalUrl: string;
}

interface OrderItem {
  productName: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  customDesignId: number | null;
}

interface WorkerOrder {
  orderId: number;
  status: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  amounts: { subtotal: number; discount: number; tax: number; shipping: number; total: number; currency: string };
  shippingAddress: { street: string; apartment: string; city: string; province: string; postalCode: string } | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-worker-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, PricePipe],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="header-left">
          <h2>Cola de Producción</h2>
        </div>
        <label class="toggle-all">
          <input type="checkbox" [(ngModel)]="showAll" (ngModelChange)="onShowAllChange()" />
          Ver todos (incluyendo entregados)
        </label>
      </div>

      <div class="info-banner">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Flujo operativo: <strong>Pagado → En preparación → Enviado → Entregado</strong>
      </div>

      @if (errorMessage()) {
        <div class="alert-error">{{ errorMessage() }}</div>
      }

      <!-- TRACKING MODAL -->
      @if (trackingOrderId() !== null) {
        <div class="modal-overlay" (click)="cancelTracking()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Número de seguimiento</h3>
            <p class="modal-sub">Requerido para marcar el pedido #{{ trackingOrderId() }} como Enviado</p>
            <div class="form-field">
              <label>Número de seguimiento *</label>
              <input [(ngModel)]="trackingNumberInput" placeholder="Ej: OCA123456, AND789..." autofocus />
            </div>
            <div class="form-field">
              <label>URL de rastreo (opcional)</label>
              <input [(ngModel)]="trackingUrlInput" placeholder="https://..." />
            </div>
            @if (trackingError()) {
              <p class="field-error">{{ trackingError() }}</p>
            }
            <div class="modal-actions">
              <button class="btn-secondary" (click)="cancelTracking()">Cancelar</button>
              <button class="btn-primary" [disabled]="updatingId() !== null" (click)="confirmShip()">
                {{ updatingId() !== null ? 'Enviando...' : 'Confirmar envío' }}
              </button>
            </div>
          </div>
        </div>
      }

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Items</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Avanzar</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              @for (i of [1,2,3,4,5]; track i) {
                <tr class="skeleton-row">
                  <td><div class="skel w-16"></div></td>
                  <td><div class="skel w-24"></div></td>
                  <td><div class="skel w-32"></div></td>
                  <td><div class="skel w-12"></div></td>
                  <td><div class="skel w-20"></div></td>
                  <td><div class="skel w-20"></div></td>
                  <td><div class="skel w-28"></div></td>
                </tr>
              }
            } @else if (orders.length === 0) {
              <tr><td colspan="7" class="empty-cell">
                <div class="empty-state">
                  <p>No hay pedidos en la cola</p>
                </div>
              </td></tr>
            }
            @for (order of orders; track order.orderId) {
              <tr class="order-row" [class.expanded]="expandedId() === order.orderId" (click)="toggleExpand(order.orderId)">
                <td><span class="order-id">#{{ order.orderId }}</span></td>
                <td class="date-cell">
                  <span>{{ order.createdAt | date: 'dd/MM/yy' }}</span>
                  <span class="time-muted">{{ order.createdAt | date: 'HH:mm' }}</span>
                </td>
                <td>
                  <div class="customer-info">
                    <span class="customer-name">{{ order.customerName }}</span>
                    <span class="customer-email">{{ order.customerEmail }}</span>
                  </div>
                </td>
                <td>
                  <span class="items-count">{{ order.items.length }} {{ order.items.length === 1 ? 'item' : 'items' }}</span>
                  @if (hasCustomDesign(order)) {
                    <span class="custom-badge">Personalizado</span>
                  }
                </td>
                <td><strong>{{ order.amounts.total | price: order.amounts.currency }}</strong></td>
                <td>
                  <span class="status-badge" [attr.data-status]="order.status">{{ statusLabel(order.status) }}</span>
                </td>
                <td (click)="$event.stopPropagation()">
                  @if (updatingId() === order.orderId) {
                    <span class="updating-indicator">
                      <span class="spinner"></span>Guardando...
                    </span>
                  } @else {
                    @if (nextStatus(order.status); as next) {
                      <button class="btn-advance" (click)="advanceStatus(order, next)">
                        {{ statusLabel(next) }}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    } @else {
                      <span class="no-action">—</span>
                    }
                  }
                </td>
              </tr>

              @if (expandedId() === order.orderId) {
                <tr class="detail-row" (click)="$event.stopPropagation()">
                  <td colspan="7">
                    <div class="detail-panel">

                      <!-- PRODUCTOS + DISEÑOS -->
                      <div class="detail-section">
                        <h4>Productos</h4>
                        <div class="detail-items">
                          @for (item of order.items; track $index) {
                            <div class="detail-item">
                              <div class="item-info">
                                <span class="item-name">{{ item.productName }}</span>
                                <span class="item-variant">{{ item.color }} / Talle {{ item.size }}</span>
                                @if (item.customDesignId) {
                                  <div class="design-download-section">
                                    <span class="custom-badge">Diseño personalizado</span>
                                    @if (designAssets()[item.customDesignId]) {
                                      @for (asset of designAssets()[item.customDesignId]; track asset.assetId) {
                                        <a class="btn-download" [href]="asset.normalizedUrl" target="_blank" rel="noopener">
                                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                          Descargar arte {{ asset.widthPx }}×{{ asset.heightPx }}px
                                        </a>
                                      }
                                    } @else if (loadingDesign()[item.customDesignId]) {
                                      <span class="loading-design">Cargando assets...</span>
                                    } @else {
                                      <button class="btn-load-design" (click)="loadDesignAssets(order.orderId, item.customDesignId!)">
                                        Ver assets de diseño
                                      </button>
                                    }
                                  </div>
                                }
                              </div>
                              <div class="item-qty-price">
                                <span class="item-qty">x{{ item.quantity }}</span>
                                <span class="item-price">{{ item.unitPrice * item.quantity | price }}</span>
                              </div>
                            </div>
                          }
                        </div>
                      </div>

                      @if (order.shippingAddress) {
                        <div class="detail-section">
                          <h4>Dirección de envío</h4>
                          <address class="shipping-address">
                            {{ order.shippingAddress.street }}
                            @if (order.shippingAddress.apartment) { , {{ order.shippingAddress.apartment }} }
                            <br>
                            {{ order.shippingAddress.city }}, {{ order.shippingAddress.province }}
                            {{ order.shippingAddress.postalCode }}
                          </address>
                        </div>
                      }

                      @if (order.trackingNumber) {
                        <div class="detail-section">
                          <h4>Seguimiento</h4>
                          <p class="tracking-info">
                            <strong>{{ order.trackingNumber }}</strong>
                            @if (order.trackingUrl) {
                              <a [href]="order.trackingUrl" target="_blank" rel="noopener" class="tracking-link">Ver seguimiento →</a>
                            }
                          </p>
                        </div>
                      }

                      <div class="detail-section">
                        <h4>Total</h4>
                        <div class="amounts-grid">
                          <span>Subtotal</span><span>{{ order.amounts.subtotal | price: order.amounts.currency }}</span>
                          @if (order.amounts.discount > 0) {
                            <span>Descuento</span><span class="discount">-{{ order.amounts.discount | price: order.amounts.currency }}</span>
                          }
                          <span class="total-label"><strong>Total</strong></span>
                          <span><strong>{{ order.amounts.total | price: order.amounts.currency }}</strong></span>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      @if (totalPages > 1) {
        <div class="pagination">
          <button (click)="loadPage(currentPage - 1)" [disabled]="currentPage === 0 || loading()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          @for (p of pageNumbers(); track p) {
            <button (click)="loadPage(p)" [class.active]="p === currentPage" [disabled]="loading()">{{ p + 1 }}</button>
          }
          <button (click)="loadPage(currentPage + 1)" [disabled]="currentPage >= totalPages - 1 || loading()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 1.5rem; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .header-left { display: flex; align-items: center; gap: 0.75rem; }
    h2 { margin: 0; font-size: 1.3rem; font-weight: 700; }
    .toggle-all { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-secondary); cursor: pointer; }

    .info-banner {
      display: flex; align-items: center; gap: 0.5rem;
      background: var(--bg-secondary); border: 1px solid var(--border);
      color: var(--primary-dark); padding: 0.6rem 1rem; border-radius: 8px;
      font-size: 0.82rem; margin-bottom: 1.25rem;
    }

    .alert-error { background: var(--danger-bg); border: 1px solid var(--danger-border); color: var(--danger-text); padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.875rem; }

    /* MODAL */
    .modal-overlay {
      position: fixed; inset: 0; background: var(--overlay);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .modal {
      background: var(--bg-card); border-radius: 12px; padding: 1.75rem;
      width: 460px; max-width: 95vw; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .modal h3 { margin: 0 0 0.25rem; font-size: 1.1rem; }
    .modal-sub { margin: 0 0 1.25rem; font-size: 0.85rem; color: var(--text-secondary); }
    .form-field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.75rem; }
    .form-field label { font-size: 0.78rem; font-weight: 600; color: var(--text); text-transform: uppercase; letter-spacing: 0.04em; }
    .form-field input { border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.9rem; outline: none; }
    .form-field input:focus { border-color: var(--primary); }
    .field-error { color: var(--danger); font-size: 0.82rem; margin: 0 0 0.5rem; }
    .modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.25rem; }
    .btn-primary { padding: 0.5rem 1.1rem; background: var(--primary); color: white; border: none; border-radius: 7px; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-secondary { padding: 0.5rem 1.1rem; background: var(--bg-card); color: var(--text); border: 1px solid var(--border); border-radius: 7px; font-size: 0.875rem; font-weight: 600; cursor: pointer; }

    .table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; }
    table { width: 100%; border-collapse: collapse; min-width: 700px; }
    thead { background: var(--bg-secondary); }
    th { padding: 0.6rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); }
    td { padding: 0.75rem 1rem; border-top: 1px solid var(--border); font-size: 0.875rem; vertical-align: middle; }
    .order-row { cursor: pointer; transition: background 0.1s; }
    .order-row:hover { background: var(--bg-secondary); }
    .order-row.expanded { background: var(--bg-secondary); }

    .order-id { font-weight: 700; color: var(--primary); }
    .date-cell { display: flex; flex-direction: column; gap: 1px; }
    .time-muted { font-size: 0.75rem; color: var(--text-secondary); }
    .customer-info { display: flex; flex-direction: column; gap: 1px; }
    .customer-name { font-weight: 500; }
    .customer-email { font-size: 0.775rem; color: var(--text-secondary); }
    .items-count { color: var(--text-secondary); font-size: 0.825rem; }
    .custom-badge { display: inline-block; background: var(--info-bg); color: var(--info); font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; font-weight: 600; margin-left: 4px; }

    .status-badge { font-size: 0.72rem; font-weight: 600; padding: 3px 8px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; }
    .status-badge[data-status="paid"]             { background: var(--success-bg); color: var(--success); }
    .status-badge[data-status="awaiting_payment"] { background: var(--warning-bg); color: var(--warning-text); }
    .status-badge[data-status="pending"]          { background: var(--warning-bg); color: var(--warning-text); }
    .status-badge[data-status="preparing"]        { background: var(--bg-secondary); color: var(--primary-dark); }
    .status-badge[data-status="shipped"]          { background: var(--info-bg); color: var(--info-text); }
    .status-badge[data-status="delivered"]        { background: var(--success-bg); color: var(--success-text); }
    .status-badge[data-status="cancelled"]        { background: var(--danger-bg); color: var(--danger); }
    .status-badge[data-status="refunded"]         { background: var(--bg-secondary); color: var(--text-secondary); }

    .btn-advance {
      display: inline-flex; align-items: center; gap: 0.25rem;
      padding: 0.35rem 0.75rem; background: var(--primary); color: white;
      border: none; border-radius: 6px; font-size: 0.78rem; font-weight: 600;
      cursor: pointer; transition: opacity 0.15s;
    }
    .btn-advance:hover { opacity: 0.85; }
    .no-action { color: var(--text-secondary); font-size: 0.875rem; }

    .updating-indicator { display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; color: var(--text-secondary); }
    .spinner { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .detail-row td { background: var(--bg-secondary); padding: 0; }
    .detail-panel { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.25rem; padding: 1rem 1.25rem; border-top: 2px solid var(--border); }
    .detail-section h4 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); font-weight: 600; margin: 0 0 0.6rem; }
    .detail-items { display: flex; flex-direction: column; gap: 0.75rem; }
    .detail-item { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; font-size: 0.825rem; }
    .item-info { display: flex; flex-direction: column; gap: 3px; }
    .item-name { font-weight: 500; }
    .item-variant { font-size: 0.775rem; color: var(--text-secondary); }
    .item-qty-price { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; white-space: nowrap; }
    .item-qty { font-size: 0.775rem; color: var(--text-secondary); }
    .item-price { font-weight: 600; font-size: 0.85rem; }

    .design-download-section { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
    .btn-download {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 0.3rem 0.75rem; background: var(--success-bg); color: var(--success);
      border: 1px solid var(--success-border); border-radius: 6px;
      font-size: 0.78rem; font-weight: 600; text-decoration: none;
      transition: background 0.15s;
    }
    .btn-download:hover { background: var(--success-bg); opacity: 0.85; }
    .btn-load-design {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 0.25rem 0.65rem; background: var(--bg-secondary); color: var(--primary);
      border: 1px solid var(--border); border-radius: 6px;
      font-size: 0.78rem; font-weight: 600; cursor: pointer;
    }
    .loading-design { font-size: 0.78rem; color: var(--text-secondary); }

    .amounts-grid { display: grid; grid-template-columns: 1fr auto; gap: 0.3rem 1rem; font-size: 0.825rem; }
    .amounts-grid .total-label { padding-top: 0.25rem; border-top: 1px solid var(--border); }
    .discount { color: var(--success); }

    .shipping-address { font-style: normal; font-size: 0.825rem; line-height: 1.6; color: var(--text); }
    .tracking-info { margin: 0; font-size: 0.85rem; }
    .tracking-link { color: var(--primary); text-decoration: none; margin-left: 0.5rem; }

    .empty-cell { text-align: center; padding: 3rem; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: var(--text-secondary); }
    .empty-state p { margin: 0; font-size: 0.875rem; }
    .skeleton-row td { border-top: 1px solid var(--border); padding: 0.75rem 1rem; }
    .skel { height: 12px; border-radius: 4px; background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--border) 50%, var(--bg-secondary) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
    .w-12 { width: 48px; } .w-16 { width: 64px; } .w-20 { width: 80px; }
    .w-24 { width: 96px; } .w-28 { width: 112px; } .w-32 { width: 128px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .pagination { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 1rem; }
    .pagination button { min-width: 32px; height: 32px; padding: 0 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card); cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .pagination button.active { background: var(--primary); color: white; border-color: transparent; }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
  `],
})
export class WorkerOrdersComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private readonly apiUrl = `${environment.apiUrl}/worker/orders`;

  orders: WorkerOrder[] = [];
  loading = signal(true);
  errorMessage = signal('');
  updatingId = signal<number | null>(null);
  expandedId = signal<number | null>(null);

  // Design asset downloads
  designAssets = signal<Record<number, DesignAsset[]>>({});
  loadingDesign = signal<Record<number, boolean>>({});

  // Tracking modal
  trackingOrderId = signal<number | null>(null);
  trackingNextStatus = signal<string>('');
  trackingNumberInput = '';
  trackingUrlInput = '';
  trackingError = signal('');

  showAll = false;

  currentPage = 0;
  totalPages = 0;
  totalElements = 0;
  pageSize = 20;

  ngOnInit(): void {
    this.loadPage(0);
  }

  loadPage(page: number): void {
    this.loading.set(true);
    this.errorMessage.set('');

    const params = new HttpParams()
      .set('page', page)
      .set('size', this.pageSize)
      .set('all', this.showAll);

    this.http.get<{ content: WorkerOrder[]; totalElements: number; totalPages: number }>(
      this.apiUrl, { params }
    ).subscribe({
      next: r => {
        this.orders = r.content;
        this.totalElements = r.totalElements;
        this.totalPages = r.totalPages;
        this.currentPage = page;
        this.loading.set(false);
      },
      error: err => {
        this.errorMessage.set(err.error?.error || 'Error al cargar los pedidos');
        this.loading.set(false);
      },
    });
  }

  onShowAllChange(): void { this.loadPage(0); }
  toggleExpand(id: number): void { this.expandedId.update(cur => cur === id ? null : id); }

  hasCustomDesign(order: WorkerOrder): boolean {
    return order.items.some(i => i.customDesignId != null);
  }

  loadDesignAssets(orderId: number, designId: number): void {
    this.loadingDesign.update(m => ({ ...m, [designId]: true }));
    this.http.get<DesignAsset[]>(`${this.apiUrl}/${orderId}/designs/${designId}/assets`).subscribe({
      next: assets => {
        this.designAssets.update(m => ({ ...m, [designId]: assets }));
        this.loadingDesign.update(m => ({ ...m, [designId]: false }));
      },
      error: () => {
        this.loadingDesign.update(m => ({ ...m, [designId]: false }));
        this.toast.error('No se pudieron cargar los assets del diseño');
      },
    });
  }

  /** Returns the next status in the worker flow, or null if terminal */
  nextStatus(currentStatus: string): string | null {
    const map: Record<string, string> = {
      paid: 'preparing', preparing: 'shipped', shipped: 'delivered',
    };
    return map[currentStatus.toLowerCase()] ?? null;
  }

  advanceStatus(order: WorkerOrder, newStatus: string): void {
    // Shipping requires tracking number — show modal
    if (newStatus === 'shipped') {
      this.trackingOrderId.set(order.orderId);
      this.trackingNextStatus.set(newStatus);
      this.trackingNumberInput = '';
      this.trackingUrlInput = '';
      this.trackingError.set('');
      return;
    }

    this.doAdvance(order.orderId, newStatus, null, null);
  }

  confirmShip(): void {
    if (!this.trackingNumberInput.trim()) {
      this.trackingError.set('El número de seguimiento es obligatorio.');
      return;
    }
    const orderId = this.trackingOrderId()!;
    this.doAdvance(orderId, 'shipped', this.trackingNumberInput.trim(), this.trackingUrlInput.trim() || null);
  }

  cancelTracking(): void {
    this.trackingOrderId.set(null);
    this.trackingError.set('');
  }

  private doAdvance(orderId: number, newStatus: string, trackingNumber: string | null, trackingUrl: string | null): void {
    this.updatingId.set(orderId);
    const body: Record<string, string> = {};
    if (trackingNumber) body['trackingNumber'] = trackingNumber;
    if (trackingUrl)    body['trackingUrl']    = trackingUrl;

    this.http.patch<WorkerOrder>(`${this.apiUrl}/${orderId}/advance`, body).subscribe({
      next: updated => {
        const idx = this.orders.findIndex(o => o.orderId === orderId);
        if (idx !== -1) this.orders[idx] = { ...this.orders[idx], ...updated };
        this.updatingId.set(null);
        this.trackingOrderId.set(null);
        this.toast.success(`Pedido #${orderId} → ${this.statusLabel(updated.status)}`);
      },
      error: err => {
        const msg = err.error?.error || 'Error al actualizar el estado';
        if (this.trackingOrderId() !== null) {
          this.trackingError.set(msg);
        } else {
          this.errorMessage.set(msg);
          this.toast.error(msg);
        }
        this.updatingId.set(null);
      },
    });
  }

  pageNumbers(): number[] {
    const start = Math.max(0, this.currentPage - 2);
    const end = Math.min(this.totalPages, start + 5);
    return Array.from({ length: end - start }, (_, i) => start + i);
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente', awaiting_payment: 'Esp. pago', paid: 'Pagado',
      preparing: 'Preparando', shipped: 'Enviado', delivered: 'Entregado',
      cancelled: 'Cancelado', refunded: 'Reembolsado',
    };
    return labels[status?.toLowerCase()] ?? status;
  }
}
