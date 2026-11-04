import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { OrderService } from '@core/services/order.service';
import { ReturnService } from '@core/services/return.service';
import { Order } from '@core/models/order.model';
import { ReturnRequest, CreateReturnRequest } from '@core/models/return.model';
import { PricePipe } from '@shared/pipes/price.pipe';

const CANCELLABLE  = new Set(['pending', 'awaiting_payment']);
const INVOICEABLE  = new Set(['paid', 'preparing', 'shipped', 'delivered', 'refunded']);
const RETURNABLE   = new Set(['delivered']);

type PaymentBanner = 'success' | 'pending' | 'failed' | null;

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PricePipe],
  template: `
    <div class="container">
      <h1>Mis Pedidos</h1>

      <!-- ── Payment redirect banner ──────────────────────────── -->
      @if (paymentBanner === 'success') {
        <div class="banner banner-success">
          <span class="banner-icon">✓</span>
          <div>
            <strong>¡Pago recibido!</strong>
            <p>Tu pago fue aprobado. Te enviaremos un email de confirmación.</p>
          </div>
        </div>
      }
      @if (paymentBanner === 'pending') {
        <div class="banner banner-pending">
          <span class="banner-icon">⏳</span>
          <div>
            <strong>Pago pendiente</strong>
            <p>Tu pago está siendo procesado. Te avisaremos cuando se confirme.</p>
          </div>
        </div>
      }
      @if (paymentBanner === 'failed') {
        <div class="banner banner-error">
          <span class="banner-icon">✕</span>
          <div>
            <strong>Pago rechazado</strong>
            <p>No se pudo procesar el pago. Podés intentarlo de nuevo desde el carrito.</p>
          </div>
        </div>
      }

      <!-- ── Loading ────────────────────────────────────────────── -->
      @if (loading) {
        <div class="loading">Cargando pedidos...</div>
      }

      <!-- ── Empty state ────────────────────────────────────────── -->
      @if (!loading && orders.length === 0) {
        <div class="empty">
          <p>Todavía no tenés pedidos.</p>
          <a routerLink="/" class="btn-primary">Ver catálogo</a>
        </div>
      }

      <!-- ── Order list ─────────────────────────────────────────── -->
      @for (order of orders; track order.orderId) {
        <div class="order-card" [class.highlighted]="highlightedOrderId === order.orderId">

          <!-- Header -->
          <div class="order-header">
            <div class="order-id">
              <span class="label">Pedido</span>
              <span class="value">#{{ order.orderId }}</span>
            </div>
            <span class="status-badge" [attr.data-status]="order.status">
              {{ statusLabel(order.status) }}
            </span>
            <div class="order-date">
              {{ order.createdAt | date: 'dd/MM/yyyy' }}
            </div>
          </div>

          <!-- Items -->
          <div class="order-items">
            @for (item of order.items; track $index) {
              <div class="item-row">
                <div class="item-name">
                  {{ item.productName }}
                  <span class="item-variant">{{ item.color }} / {{ item.size }}</span>
                  @if (item.customDesignId) {
                    <span class="badge-custom">Personalizado</span>
                  }
                </div>
                <div class="item-qty-price">
                  <span class="qty">x{{ item.quantity }}</span>
                  <span class="price">{{ item.unitPrice * item.quantity | price }}</span>
                </div>
              </div>
            }
          </div>

          <!-- Footer: address + total + detail link -->
          <div class="order-footer">
            @if (order.shippingAddress) {
              <div class="shipping-address">
                📦 {{ order.shippingAddress.street }}{{ order.shippingAddress.apartment ? ', ' + order.shippingAddress.apartment : '' }},
                {{ order.shippingAddress.city }}, {{ order.shippingAddress.province }}
              </div>
            }
            <div class="footer-right">
              <div class="order-total">
                Total: <strong>{{ order.amounts.total | price: order.amounts.currency }}</strong>
              </div>
              @if (canCancel(order.status)) {
                <button class="btn-cancel-order"
                  [disabled]="cancellingId === order.orderId"
                  (click)="cancelOrder(order)">
                  {{ cancellingId === order.orderId ? 'Cancelando...' : 'Cancelar pedido' }}
                </button>
              }
              @if (canDownloadInvoice(order.status)) {
                <button class="btn-invoice"
                  [disabled]="downloadingId === order.orderId"
                  (click)="downloadInvoice(order.orderId)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {{ downloadingId === order.orderId ? 'Generando...' : 'Comprobante' }}
                </button>
              }
              @if (canReturn(order.status) && !hasExistingReturn(order.orderId)) {
                <button class="btn-return"
                  (click)="toggleReturnForm(order.orderId)">
                  ↩ Devolver
                </button>
              }
              @if (hasExistingReturn(order.orderId)) {
                <span class="return-badge"
                  [attr.data-rs]="getReturn(order.orderId)?.status?.toLowerCase()">
                  Devolución: {{ returnStatusLabel(getReturn(order.orderId)?.status) }}
                </span>
              }
              <a [routerLink]="['/orders', order.orderId]" class="btn-detail">Ver detalle →</a>
            </div>
          </div>

          <!-- ── Return request inline form ────────────────── -->
          @if (returnFormOrderId === order.orderId) {
            <div class="return-form">
              <h4>Solicitar devolución — Pedido #{{ order.orderId }}</h4>
              <div class="return-form-grid">

                <label>
                  Motivo
                  <select [(ngModel)]="returnForm.reason">
                    <option value="">Seleccioná un motivo</option>
                    <option value="DEFECTIVE">Producto defectuoso</option>
                    <option value="WRONG_SIZE">Talle incorrecto</option>
                    <option value="WRONG_ITEM">Producto incorrecto</option>
                    <option value="CHANGED_MIND">Cambié de opinión</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </label>

                <label>
                  Resolución deseada
                  <select [(ngModel)]="returnForm.resolution">
                    <option value="REFUND">Reembolso</option>
                    <option value="EXCHANGE">Cambio de producto</option>
                  </select>
                </label>

                <label class="full-width">
                  Descripción (opcional)
                  <textarea [(ngModel)]="returnForm.description"
                    rows="3"
                    maxlength="1000"
                    placeholder="Contanos más detalles sobre el problema..."></textarea>
                </label>

              </div>
              <div class="return-form-actions">
                <button class="btn-submit-return"
                  [disabled]="!returnForm.reason || submittingReturn"
                  (click)="submitReturn(order.orderId)">
                  {{ submittingReturn ? 'Enviando...' : 'Enviar solicitud' }}
                </button>
                <button class="btn-cancel-return" (click)="cancelReturnForm()">
                  Cancelar
                </button>
              </div>
              @if (returnError) {
                <p class="return-error">{{ returnError }}</p>
              }
            </div>
          }

        </div>
      }

      <!-- ── Pagination ──────────────────────────────────────────── -->
      @if (totalPages > 1) {
        <div class="pagination">
          <button (click)="loadPage(currentPage - 1)" [disabled]="currentPage === 0">Anterior</button>
          <span>Página {{ currentPage + 1 }} de {{ totalPages }}</span>
          <button (click)="loadPage(currentPage + 1)" [disabled]="currentPage >= totalPages - 1">Siguiente</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .container { max-width: 720px; margin: 0 auto; padding: 2rem 1rem; }
    h1 { font-size: 1.75rem; margin-bottom: 1.5rem; }

    /* ── Banners ── */
    .banner {
      display: flex; align-items: flex-start; gap: 1rem;
      padding: 1rem 1.25rem; border-radius: 10px; margin-bottom: 1.5rem;
      border-width: 1px; border-style: solid;
    }
    .banner p { margin: 0.25rem 0 0; font-size: 0.9rem; }
    .banner-icon { font-size: 1.4rem; line-height: 1; }
    .banner-success { background: var(--success-bg); border-color: var(--success-border); color: var(--success-text); }
    .banner-pending { background: var(--warning-bg); border-color: var(--warning-border); color: var(--warning-text); }
    .banner-error   { background: var(--danger-bg); border-color: var(--danger-border); color: var(--danger-text); }

    /* ── Loading / empty ── */
    .loading { text-align: center; padding: 3rem; color: var(--text-muted); }
    .empty { text-align: center; padding: 3rem; color: var(--text-muted); }
    .empty .btn-primary {
      display: inline-block; margin-top: 1rem; padding: 0.75rem 1.5rem;
      background: var(--primary); color: white; border-radius: 8px;
      text-decoration: none; font-weight: 600;
    }

    /* ── Order card ── */
    .order-card {
      border: 1px solid var(--border); border-radius: 10px;
      margin-bottom: 1rem; overflow: hidden;
    }
    .order-card.highlighted { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-light); }

    /* Header */
    .order-header {
      display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
      background: var(--bg-secondary); padding: 0.85rem 1.25rem;
      border-bottom: 1px solid var(--border);
    }
    .order-id .label { font-size: 0.75rem; color: var(--text-muted); display: block; }
    .order-id .value { font-weight: 700; font-size: 1rem; }
    .order-date { margin-left: auto; font-size: 0.85rem; color: var(--text-muted); }

    /* Status badge */
    .status-badge {
      font-size: 0.75rem; font-weight: 600; padding: 3px 10px;
      border-radius: 20px; text-transform: uppercase; letter-spacing: 0.03em;
    }
    .status-badge[data-status="paid"]             { background: var(--success-bg); color: var(--success-text); }
    .status-badge[data-status="awaiting_payment"] { background: var(--warning-bg); color: var(--warning-text); }
    .status-badge[data-status="pending"]          { background: var(--warning-bg); color: var(--warning-text); }
    .status-badge[data-status="processing"]       { background: var(--bg-secondary); color: var(--primary); }
    .status-badge[data-status="shipped"]          { background: var(--info-bg); color: var(--info-text); }
    .status-badge[data-status="delivered"]        { background: var(--success-bg); color: var(--success-text); }
    .status-badge[data-status="cancelled"]        { background: var(--danger-bg); color: var(--danger); }

    /* Items */
    .order-items { padding: 0.75rem 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .item-row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .item-name { font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
    .item-variant { color: var(--text-muted); font-size: 0.82rem; }
    .badge-custom {
      background: var(--info-bg); color: var(--info-text);
      font-size: 0.7rem; padding: 1px 6px; border-radius: 4px;
    }
    .item-qty-price { display: flex; gap: 0.75rem; align-items: center; white-space: nowrap; }
    .qty { font-size: 0.85rem; color: var(--text-muted); }
    .price { font-weight: 500; font-size: 0.9rem; }

    /* Footer */
    .order-footer {
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      background: var(--bg-secondary); border-top: 1px solid var(--border);
    }
    .shipping-address { font-size: 0.82rem; color: var(--text-muted); }
    .footer-right { display: flex; align-items: center; gap: 1rem; }
    .order-total { font-size: 1rem; }
    .btn-cancel-order {
      font-size: 0.82rem; font-weight: 600; color: var(--danger);
      white-space: nowrap; cursor: pointer;
      padding: 0.35rem 0.85rem; border: 1.5px solid var(--danger-border); border-radius: 6px;
      background: var(--danger-bg); transition: background 0.15s;
    }
    .btn-cancel-order:hover:not(:disabled) { background: var(--danger-bg); }
    .btn-cancel-order:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-detail {
      font-size: 0.82rem; font-weight: 600; color: var(--primary-dark);
      text-decoration: none; white-space: nowrap;
      padding: 0.35rem 0.85rem; border: 1.5px solid var(--primary-light); border-radius: 6px;
      background: var(--primary-light); transition: background 0.15s;
    }
    .btn-detail:hover { background: var(--primary-light); }

    /* Invoice download button */
    .btn-invoice {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.4rem 0.85rem; border: 1px solid var(--border);
      border-radius: 6px; background: var(--bg-card); color: var(--text);
      font-size: 0.8rem; font-weight: 500; cursor: pointer;
      transition: background .12s, border-color .12s;
    }
    .btn-invoice:hover:not(:disabled) { background: var(--bg-secondary); border-color: var(--text-secondary); }
    .btn-invoice:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Return button */
    .btn-return {
      font-size: 0.82rem; font-weight: 600; color: var(--info-text);
      white-space: nowrap; cursor: pointer;
      padding: 0.35rem 0.85rem; border: 1.5px solid var(--info-border); border-radius: 6px;
      background: var(--info-bg); transition: background 0.15s;
    }
    .btn-return:hover { background: var(--info-bg); }

    /* Return status badge */
    .return-badge {
      font-size: 0.75rem; font-weight: 600; padding: 3px 10px;
      border-radius: 20px; text-transform: uppercase; letter-spacing: 0.03em;
    }
    .return-badge[data-rs="pending"]     { background: var(--warning-bg); color: var(--warning-text); }
    .return-badge[data-rs="approved"]    { background: #f8e4f8; color: #8b1a80; /* brand */ }
    .return-badge[data-rs="in_progress"] { background: var(--info-bg); color: var(--info-text); }
    .return-badge[data-rs="completed"]   { background: var(--success-bg); color: var(--success-text); }
    .return-badge[data-rs="rejected"]    { background: var(--danger-bg); color: var(--danger); }

    /* Return inline form */
    .return-form {
      padding: 1.25rem 1.25rem 1rem;
      border-top: 1px dashed var(--info-border);
      background: var(--info-bg);
    }
    .return-form h4 {
      margin: 0 0 1rem;
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--info-text);
    }
    .return-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .return-form-grid label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text);
    }
    .return-form-grid .full-width { grid-column: 1 / -1; }
    .return-form-grid select,
    .return-form-grid textarea {
      padding: 0.5rem 0.65rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.875rem;
      background: var(--bg-card);
      resize: vertical;
    }
    .return-form-grid select:focus,
    .return-form-grid textarea:focus {
      outline: none;
      border-color: var(--info-border);
      box-shadow: 0 0 0 2px var(--info-bg);
    }
    .return-form-actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1rem;
      align-items: center;
    }
    .btn-submit-return {
      padding: 0.5rem 1.25rem;
      background: var(--info-text); color: white;
      border: none; border-radius: 6px;
      font-weight: 600; font-size: 0.875rem;
      cursor: pointer; transition: background 0.15s;
    }
    .btn-submit-return:hover:not(:disabled) { background: var(--info-text); }
    .btn-submit-return:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-cancel-return {
      padding: 0.5rem 1rem;
      background: transparent; color: var(--text-secondary);
      border: 1px solid var(--border); border-radius: 6px;
      font-size: 0.875rem; cursor: pointer;
    }
    .return-error {
      margin-top: 0.5rem;
      font-size: 0.82rem; color: var(--danger);
    }

    /* Pagination */
    .pagination {
      display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.5rem;
    }
    .pagination button {
      padding: 0.5rem 1rem; border: 1px solid var(--border);
      border-radius: 6px; background: var(--bg-card); cursor: pointer;
    }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
    .pagination span { font-size: 0.9rem; color: var(--text-muted); }
  `],
})
export class OrdersComponent implements OnInit {
  private orderService  = inject(OrderService);
  private returnService = inject(ReturnService);
  private route         = inject(ActivatedRoute);

  orders: Order[] = [];
  loading = true;
  currentPage = 0;
  totalPages = 0;
  pageSize = 10;

  paymentBanner: PaymentBanner = null;
  highlightedOrderId: number | null = null;
  cancellingId: number | null = null;
  downloadingId: number | null = null;

  // Return request state
  myReturns: ReturnRequest[] = [];
  returnFormOrderId: number | null = null;
  returnForm: CreateReturnRequest = { orderId: 0, reason: '', resolution: 'REFUND', description: '' };
  submittingReturn = false;
  returnError: string | null = null;

  ngOnInit(): void {
    // Handle MercadoPago redirect query params: ?payment=success&order=123
    const payment = this.route.snapshot.queryParamMap.get('payment');
    const orderId = this.route.snapshot.queryParamMap.get('order');

    if (payment === 'success') this.paymentBanner = 'success';
    else if (payment === 'pending') this.paymentBanner = 'pending';
    else if (payment === 'failed') this.paymentBanner = 'failed';

    if (orderId) this.highlightedOrderId = Number(orderId);

    this.loadPage(0);
    this.loadMyReturns();
  }

  loadMyReturns(): void {
    this.returnService.getMyReturns().subscribe({
      next: (returns) => { this.myReturns = returns; },
      error: () => {},
    });
  }

  loadPage(page: number): void {
    this.loading = true;
    this.orderService.getOrders(page, this.pageSize).subscribe({
      next: (response) => {
        this.orders = response.content;
        this.totalPages = Math.ceil(response.totalElements / this.pageSize);
        this.currentPage = page;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  canCancel(status: string): boolean {
    return CANCELLABLE.has(status);
  }

  canDownloadInvoice(status: string): boolean {
    return INVOICEABLE.has(status);
  }

  downloadInvoice(orderId: number): void {
    this.downloadingId = orderId;
    this.orderService.downloadInvoice(orderId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comprobante-pedido-${orderId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingId = null;
      },
      error: () => {
        this.downloadingId = null;
      },
    });
  }

  cancelOrder(order: Order): void {
    if (!confirm(`¿Cancelar el pedido #${order.orderId}? Esta acción no se puede deshacer.`)) return;
    this.cancellingId = order.orderId;
    this.orderService.cancelOrder(order.orderId).subscribe({
      next: (updated) => {
        const idx = this.orders.findIndex(o => o.orderId === order.orderId);
        if (idx !== -1) this.orders[idx] = updated;
        this.cancellingId = null;
      },
      error: () => {
        this.cancellingId = null;
      },
    });
  }

  canReturn(status: string): boolean {
    return RETURNABLE.has(status);
  }

  hasExistingReturn(orderId: number): boolean {
    return this.myReturns.some(r => r.orderId === orderId);
  }

  getReturn(orderId: number): ReturnRequest | undefined {
    return this.myReturns.find(r => r.orderId === orderId);
  }

  toggleReturnForm(orderId: number): void {
    if (this.returnFormOrderId === orderId) {
      this.returnFormOrderId = null;
      return;
    }
    this.returnFormOrderId = orderId;
    this.returnForm = { orderId, reason: '', resolution: 'REFUND', description: '' };
    this.returnError = null;
  }

  cancelReturnForm(): void {
    this.returnFormOrderId = null;
    this.returnError = null;
  }

  submitReturn(orderId: number): void {
    if (!this.returnForm.reason) return;
    this.submittingReturn = true;
    this.returnError = null;

    const payload: CreateReturnRequest = {
      orderId,
      reason:      this.returnForm.reason,
      resolution:  this.returnForm.resolution,
      description: this.returnForm.description || undefined,
    };

    this.returnService.create(payload).subscribe({
      next: (newReturn) => {
        this.myReturns = [...this.myReturns, newReturn];
        this.returnFormOrderId = null;
        this.submittingReturn  = false;
      },
      error: (err) => {
        this.returnError = err?.error?.message ?? 'Error al enviar la solicitud. Intentá de nuevo.';
        this.submittingReturn = false;
      },
    });
  }

  returnStatusLabel(status?: string): string {
    const labels: Record<string, string> = {
      PENDING:     'Pendiente',
      APPROVED:    'Aprobada',
      IN_PROGRESS: 'En proceso',
      COMPLETED:   'Completada',
      REJECTED:    'Rechazada',
    };
    return status ? (labels[status] ?? status) : '';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending:          'Pendiente',
      awaiting_payment: 'Esperando pago',
      paid:             'Pagado',
      processing:       'En proceso',
      preparing:        'Preparando',
      shipped:          'Enviado',
      delivered:        'Entregado',
      cancelled:        'Cancelado',
      refunded:         'Reembolsado',
    };
    return labels[status] ?? status;
  }
}
