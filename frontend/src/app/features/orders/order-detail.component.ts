import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { OrderService } from '../../core/services/order.service';
import { Order } from '../../core/models/order.model';
import { PricePipe } from '../../shared/pipes/price.pipe';
import { environment } from '@env/environment';

interface PaymentConfig { mpAlias: string; mpCvu: string; }

const CANCELLABLE = new Set(['pending', 'awaiting_payment']);

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending:          { label: 'Pendiente',         color: '#f59e0b', icon: '⏳' },
  awaiting_payment: { label: 'Esperando pago',    color: '#f97316', icon: '💳' },
  paid:             { label: 'Pago confirmado',   color: '#e020c8', icon: '✓'  },
  preparing:        { label: 'Preparando',        color: '#8b5cf6', icon: '⚙'  },
  shipped:          { label: 'Enviado',           color: '#06b6d4', icon: '🚚' },
  delivered:        { label: 'Entregado',         color: '#10b981', icon: '✅' },
  cancelled:        { label: 'Cancelado',         color: '#ef4444', icon: '✕'  },
  refunded:         { label: 'Reembolsado',       color: '#6b7280', icon: '↩'  },
};

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, PricePipe],
  template: `
    <div class="page">
      <div class="container">

        <!-- Back -->
        <a routerLink="/orders" class="back-link">
          ← Volver a mis pedidos
        </a>

        @if (loading()) {
          <div class="skeleton-layout">
            <div class="skeleton sk-header"></div>
            <div class="skeleton-grid">
              <div class="skeleton sk-card"></div>
              <div class="skeleton sk-card"></div>
            </div>
          </div>
        }

        @if (error()) {
          <div class="error-state">
            <div class="error-icon">⚠</div>
            <p>No se pudo cargar el pedido.</p>
            <a routerLink="/orders" class="btn-secondary">Volver a mis pedidos</a>
          </div>
        }

        @if (order(); as o) {
          <!-- Header -->
          <div class="order-header">
            <div class="order-title">
              <h1>Pedido <span class="order-id">#{{ o.orderId }}</span></h1>
              <p class="order-date">{{ formatDate(o.createdAt) }}</p>
            </div>
            <div class="header-right">
              <div class="status-badge" [style.background]="statusBg(o.status)" [style.color]="statusColor(o.status)">
                {{ statusIcon(o.status) }} {{ statusLabel(o.status) }}
              </div>
              @if (canCancel(o.status)) {
                <button class="btn-cancel-order"
                  [disabled]="cancelling()"
                  (click)="cancelOrder(o.orderId)">
                  {{ cancelling() ? 'Cancelando...' : 'Cancelar pedido' }}
                </button>
              }
            </div>
          </div>

          <!-- Manual payment card (shown when MP is not configured or status is awaiting_payment) -->
          @if (o.status === 'awaiting_payment') {
            <div class="payment-card">
              <div class="payment-card-header">
                <div class="payment-card-icon">💳</div>
                <div>
                  <h2>Completá tu pago</h2>
                  <p>Tu pedido está reservado. Realizá la transferencia para confirmarlo.</p>
                </div>
              </div>

              @if (paymentConfig() && (paymentConfig()!.mpAlias || paymentConfig()!.mpCvu)) {
                <div class="payment-details">
                  @if (paymentConfig()!.mpAlias) {
                    <div class="payment-row">
                      <span class="pay-label">Alias MercadoPago</span>
                      <span class="pay-value">{{ paymentConfig()!.mpAlias }}</span>
                      <button class="copy-btn" (click)="copyText(paymentConfig()!.mpAlias)" title="Copiar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        {{ copied() === 'alias' ? '¡Copiado!' : 'Copiar' }}
                      </button>
                    </div>
                  }
                  @if (paymentConfig()!.mpCvu) {
                    <div class="payment-row">
                      <span class="pay-label">CVU</span>
                      <span class="pay-value mono">{{ paymentConfig()!.mpCvu }}</span>
                      <button class="copy-btn" (click)="copyText(paymentConfig()!.mpCvu, 'cvu')" title="Copiar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        {{ copied() === 'cvu' ? '¡Copiado!' : 'Copiar' }}
                      </button>
                    </div>
                  }
                </div>
              }

              <div class="payment-steps">
                <div class="pay-step">
                  <span class="step-num">1</span>
                  <span>Transferí el importe exacto del pedido</span>
                </div>
                <div class="pay-step">
                  <span class="step-num">2</span>
                  <span>Envianos el comprobante por WhatsApp o email</span>
                </div>
                <div class="pay-step">
                  <span class="step-num">3</span>
                  <span>Confirmamos el pago y tu pedido pasa a procesamiento</span>
                </div>
              </div>

              <div class="payment-contact">
                <a href="https://wa.me/5491100000000" target="_blank" rel="noopener" class="contact-link whatsapp">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Enviar comprobante por WhatsApp
                </a>
                <a href="mailto:contacto@example.com?subject=Comprobante pedido #{{ o.orderId }}" class="contact-link email">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  studiosolder4&#64;gmail.com
                </a>
              </div>
            </div>
          }

          <!-- Progress bar -->
          <div class="progress-track">
            @for (step of progressSteps; track step.key) {
              <div class="step" [class.done]="isStepDone(o.status, step.key)" [class.current]="o.status === step.key">
                <div class="step-dot"></div>
                <span>{{ step.label }}</span>
              </div>
            }
          </div>

          <div class="content-grid">

            <!-- Items -->
            <div class="section items-section">
              <h2>Productos ({{ o.items.length }})</h2>
              <div class="items-list">
                @for (item of o.items; track $index) {
                  <div class="item-row">
                    <div class="item-thumb">
                      @if (item.imageUrl) {
                        <img [src]="item.imageUrl" [alt]="item.productName" loading="lazy" />
                      } @else {
                        <div class="thumb-placeholder">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                            <path d="m21 15-5-5L5 21"/>
                          </svg>
                        </div>
                      }
                      <span class="qty-badge">{{ item.quantity }}</span>
                    </div>
                    <div class="item-info">
                      @if (item.productSlug) {
                        <a [routerLink]="['/product', item.productSlug]" class="item-name">{{ item.productName }}</a>
                      } @else {
                        <span class="item-name">{{ item.productName }}</span>
                      }
                      <span class="item-variant">{{ item.color }} · Talle {{ item.size }}</span>
                      @if (item.customDesignId) {
                        <span class="custom-badge">Diseño personalizado</span>
                      }
                    </div>
                    <div class="item-price">
                      <span class="unit-price">{{ item.unitPrice | price }}</span>
                      <span class="line-total">Subtotal: {{ (item.unitPrice * item.quantity) | price }}</span>
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Right column -->
            <div class="right-col">

              <!-- Totals -->
              <div class="section">
                <h2>Resumen</h2>
                <div class="totals">
                  <div class="total-row">
                    <span>Subtotal</span>
                    <span>{{ o.amounts.subtotal | price }}</span>
                  </div>
                  @if (o.amounts.discount > 0) {
                    <div class="total-row discount">
                      <span>Descuento</span>
                      <span>−{{ o.amounts.discount | price }}</span>
                    </div>
                  }
                  @if (o.amounts.shipping > 0) {
                    <div class="total-row">
                      <span>Envío</span>
                      <span>{{ o.amounts.shipping | price }}</span>
                    </div>
                  } @else {
                    <div class="total-row free">
                      <span>Envío</span>
                      <span>Gratis</span>
                    </div>
                  }
                  @if (o.amounts.tax > 0) {
                    <div class="total-row">
                      <span>Impuestos</span>
                      <span>{{ o.amounts.tax | price }}</span>
                    </div>
                  }
                  <div class="total-row grand-total">
                    <span>Total</span>
                    <span>{{ o.amounts.total | price }}</span>
                  </div>
                </div>
              </div>

              <!-- Shipping address -->
              @if (o.shippingAddress) {
                <div class="section">
                  <h2>Dirección de envío</h2>
                  <div class="address-card">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <div>
                      <p>{{ o.shippingAddress.street }}{{ o.shippingAddress.apartment ? ', ' + o.shippingAddress.apartment : '' }}</p>
                      <p>{{ o.shippingAddress.city }}, {{ o.shippingAddress.province }}</p>
                      <p>CP {{ o.shippingAddress.postalCode }}</p>
                    </div>
                  </div>
                </div>
              }

                  <!-- Tracking info -->
              @if (o.trackingNumber) {
                <div class="section tracking-section">
                  <h2>Seguimiento de envío</h2>
                  <div class="tracking-card">
                    <div class="tracking-icon">🚚</div>
                    <div class="tracking-info">
                      <p class="tracking-label">Número de seguimiento</p>
                      <p class="tracking-number">{{ o.trackingNumber }}</p>
                      @if (o.trackingUrl) {
                        <a [href]="o.trackingUrl" target="_blank" rel="noopener" class="tracking-link">
                          Rastrear envío
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                      }
                    </div>
                  </div>
                </div>
              }

              <!-- Estimated delivery -->
              @if (o.estimatedDeliveryAt) {
                <div class="section">
                  <h2>Entrega estimada</h2>
                  <p class="delivery-date">📅 {{ formatDateShort(o.estimatedDeliveryAt) }}</p>
                </div>
              }

              <!-- Actions: print receipt -->
              <button class="btn-print" (click)="printReceipt(o)" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Imprimir comprobante
              </button>

              <!-- Last update -->
              <p class="updated-at">Última actualización: {{ formatDate(o.updatedAt) }}</p>

            </div>
          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    .page { min-height: 100vh; background: var(--bg-secondary); padding: 2rem 1rem; }
    .container { max-width: 1000px; margin: 0 auto; }

    .back-link {
      display: inline-flex; align-items: center; gap: 0.4rem;
      color: var(--text-secondary); font-size: 0.875rem; text-decoration: none; margin-bottom: 1.5rem;
    }
    .back-link:hover { color: var(--text); }

    /* Header */
    .order-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;
    }
    .order-title h1 { font-size: 1.4rem; font-weight: 700; color: var(--text); margin: 0 0 0.25rem; }
    .order-id { color: var(--text-secondary); font-weight: 500; }
    .order-date { font-size: 0.85rem; color: var(--text-secondary); margin: 0; }
    .header-right { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .status-badge {
      padding: 0.4rem 1rem; border-radius: 99px; font-size: 0.875rem;
      font-weight: 600; display: flex; align-items: center; gap: 0.4rem;
      background: var(--bg-secondary); /* overridden inline */
    }
    .btn-cancel-order {
      padding: 0.4rem 1rem; border-radius: 8px; font-size: 0.875rem;
      font-weight: 600; cursor: pointer;
      color: var(--danger); background: var(--danger-bg); border: 1.5px solid var(--danger-border);
      transition: background 0.15s;
    }
    .btn-cancel-order:hover:not(:disabled) { background: var(--danger-bg); filter: brightness(0.95); }
    .btn-cancel-order:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Progress */
    .progress-track {
      display: flex; align-items: flex-start; justify-content: space-between;
      background: var(--bg-card); border-radius: 12px; padding: 1.25rem 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.07); margin-bottom: 1.5rem;
      position: relative;
    }
    .progress-track::before {
      content: ''; position: absolute; top: 2rem; left: 2.5rem; right: 2.5rem;
      height: 2px; background: var(--border); z-index: 0;
    }
    .step {
      display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
      flex: 1; z-index: 1;
    }
    .step-dot {
      width: 14px; height: 14px; border-radius: 50%;
      background: var(--border); border: 2px solid var(--border);
      transition: all 0.2s;
    }
    .step.done .step-dot { background: var(--success); border-color: var(--success); }
    .step.current .step-dot { background: var(--bg-card); border-color: var(--primary); border-width: 3px; box-shadow: 0 0 0 3px var(--success-bg); }
    .step span { font-size: 0.72rem; color: var(--text-secondary); text-align: center; }
    .step.done span { color: var(--text); font-weight: 500; }
    .step.current span { color: var(--primary); font-weight: 600; }

    /* Grid */
    .content-grid {
      display: grid; grid-template-columns: 1fr 320px; gap: 1.25rem; align-items: start;
    }

    /* Sections */
    .section {
      background: var(--bg-card); border-radius: 12px; padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.07); margin-bottom: 1.25rem;
    }
    .section h2 {
      font-size: 1rem; font-weight: 700; color: var(--text);
      margin: 0 0 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border);
    }
    .right-col .section { margin-bottom: 1.25rem; }

    /* Items */
    .items-list { display: flex; flex-direction: column; gap: 1rem; }
    .item-row {
      display: flex; align-items: center; gap: 1rem;
      padding-bottom: 1rem; border-bottom: 1px solid var(--border);
    }
    .item-row:last-child { border-bottom: none; padding-bottom: 0; }
    .item-thumb {
      position: relative; flex-shrink: 0;
      width: 64px; height: 64px; border-radius: 8px; overflow: hidden;
      background: var(--bg-secondary);
    }
    .item-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .thumb-placeholder {
      width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    }
    .qty-badge {
      position: absolute; top: -6px; right: -6px;
      background: var(--primary); color: white; font-size: 0.7rem; font-weight: 700;
      width: 18px; height: 18px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .item-info { flex: 1; min-width: 0; }
    .item-name {
      display: block; font-weight: 600; color: var(--text); font-size: 0.9rem;
      text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    a.item-name:hover { color: var(--primary); text-decoration: underline; }
    .item-variant { display: block; font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem; }
    .custom-badge {
      display: inline-block; margin-top: 0.3rem;
      background: var(--info-bg); color: var(--info-text); font-size: 0.72rem; font-weight: 600;
      padding: 0.15rem 0.5rem; border-radius: 99px;
    }
    .item-price { text-align: right; flex-shrink: 0; }
    .unit-price { display: block; font-weight: 600; color: var(--text); font-size: 0.9rem; }
    .line-total { display: block; font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.2rem; }

    /* Totals */
    .totals { display: flex; flex-direction: column; gap: 0.6rem; }
    .total-row {
      display: flex; justify-content: space-between;
      font-size: 0.875rem; color: var(--text);
    }
    .total-row.discount { color: var(--success); }
    .total-row.free span:last-child { color: var(--success); font-weight: 600; }
    .total-row.grand-total {
      font-size: 1rem; font-weight: 700; color: var(--text);
      padding-top: 0.6rem; border-top: 1.5px solid var(--border); margin-top: 0.25rem;
    }

    /* Address */
    .address-card {
      display: flex; gap: 0.75rem; align-items: flex-start;
    }
    .address-card svg { flex-shrink: 0; margin-top: 2px; }
    .address-card p { margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text); }

    .updated-at { font-size: 0.78rem; color: var(--text-secondary); text-align: center; }

    /* Tracking */
    .tracking-section {}
    .tracking-card {
      display: flex; gap: 0.75rem; align-items: flex-start;
      background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; padding: 1rem;
    }
    .tracking-icon { font-size: 1.5rem; flex-shrink: 0; }
    .tracking-info { flex: 1; min-width: 0; }
    .tracking-label { margin: 0 0 0.2rem; font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .tracking-number { margin: 0 0 0.4rem; font-size: 1.05rem; font-weight: 700; color: var(--text); letter-spacing: 0.04em; }
    .tracking-link {
      display: inline-flex; align-items: center; gap: 0.3rem;
      font-size: 0.825rem; font-weight: 600; color: var(--primary); text-decoration: none;
    }
    .tracking-link:hover { text-decoration: underline; }

    /* Delivery date */
    .delivery-date { margin: 0; font-size: 0.9rem; color: var(--text); font-weight: 500; }

    /* Print button */
    .btn-print {
      width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      padding: 0.55rem 1rem; background: var(--bg-card); border: 1.5px solid var(--border); border-radius: 8px;
      font-size: 0.875rem; font-weight: 600; color: var(--text); cursor: pointer;
      transition: background 0.15s; margin-bottom: 1rem;
    }
    .btn-print:hover { background: var(--bg-secondary); }

    /* Skeleton */
    .skeleton { background: var(--border); border-radius: 8px; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .skeleton-layout { margin-top: 1rem; }
    .sk-header { height: 80px; margin-bottom: 1rem; }
    .skeleton-grid { display: grid; grid-template-columns: 1fr 320px; gap: 1.25rem; }
    .sk-card { height: 360px; }

    /* Error */
    .error-state {
      text-align: center; padding: 4rem 2rem; background: var(--bg-card);
      border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.07);
    }
    .error-icon { font-size: 2.5rem; margin-bottom: 1rem; }
    .error-state p { color: var(--text-secondary); margin-bottom: 1.5rem; }
    .btn-secondary {
      display: inline-block; padding: 0.6rem 1.5rem;
      border: 1.5px solid var(--border); border-radius: 8px;
      font-size: 0.9rem; font-weight: 600; color: var(--text);
      text-decoration: none; background: var(--bg-card);
    }
    .btn-secondary:hover { background: var(--bg-secondary); }

    /* Payment card */
    .payment-card {
      background: var(--bg-card); border: 2px solid #f97316;
      border-radius: 16px; padding: 1.75rem; margin-bottom: 1.5rem;
    }
    .payment-card-header {
      display: flex; gap: 1rem; align-items: flex-start; margin-bottom: 1.5rem;
    }
    .payment-card-icon { font-size: 2rem; flex-shrink: 0; }
    .payment-card-header h2 {
      font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0 0 0.3rem;
    }
    .payment-card-header p {
      font-size: 0.875rem; color: var(--text-secondary); margin: 0;
    }
    .payment-details {
      background: var(--bg-secondary); border: 1px solid var(--border);
      border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1.25rem;
    }
    .payment-row {
      display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0;
      border-bottom: 1px solid var(--border);
    }
    .payment-row:last-child { border-bottom: none; }
    .pay-label {
      font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--text-secondary); min-width: 130px;
    }
    .pay-value {
      flex: 1; font-size: 1rem; font-weight: 700; color: var(--text);
    }
    .pay-value.mono { font-family: monospace; font-size: 0.9rem; letter-spacing: 0.05em; }
    .copy-btn {
      display: inline-flex; align-items: center; gap: 0.3rem;
      padding: 0.25rem 0.65rem; border: 1px solid var(--border); border-radius: 6px;
      background: var(--bg-card); color: var(--text-secondary); font-size: 0.78rem;
      font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap;
    }
    .copy-btn:hover { border-color: var(--primary); color: var(--primary); }
    .payment-steps {
      display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1.25rem;
    }
    .pay-step {
      display: flex; align-items: center; gap: 0.75rem;
      font-size: 0.875rem; color: var(--text-secondary);
    }
    .step-num {
      width: 24px; height: 24px; border-radius: 50%;
      background: #f97316; color: white; font-size: 0.75rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .payment-contact {
      display: flex; flex-wrap: wrap; gap: 0.75rem;
    }
    .contact-link {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600;
      text-decoration: none; transition: opacity 0.15s;
    }
    .contact-link:hover { opacity: 0.85; }
    .contact-link.whatsapp { background: rgba(37,211,102,0.15); color: #16a34a; border: 1px solid rgba(37,211,102,0.3); }
    .contact-link.email { background: var(--bg-secondary); color: var(--text); border: 1px solid var(--border); }

    @media (max-width: 768px) {
      .content-grid { grid-template-columns: 1fr; }
      .progress-track { overflow-x: auto; gap: 0.5rem; }
      .order-header { flex-direction: column; gap: 0.75rem; }
      .payment-card { padding: 1.25rem; }
      .pay-label { min-width: 100px; }
    }
  `]
})
export class OrderDetailComponent implements OnInit {
  order = signal<Order | null>(null);
  loading = signal(true);
  error = signal(false);
  cancelling = signal(false);
  paymentConfig = signal<PaymentConfig | null>(null);
  copied = signal<string>('');

  progressSteps = [
    { key: 'awaiting_payment', label: 'Pago'       },
    { key: 'paid',             label: 'Confirmado' },
    { key: 'preparing',        label: 'Preparando' },
    { key: 'shipped',          label: 'Enviado'    },
    { key: 'delivered',        label: 'Entregado'  },
  ];

  private readonly stepOrder = this.progressSteps.map(s => s.key);

  private readonly apiUrl = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.orderService.getOrder(id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.loading.set(false);
        if (o.status === 'awaiting_payment') {
          this.loadPaymentConfig();
        }
      },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  private loadPaymentConfig(): void {
    this.http.get<PaymentConfig>(`${this.apiUrl}/store/payment-config`).subscribe({
      next: (cfg) => this.paymentConfig.set(cfg),
      error: () => { /* no-op — card still shows without alias */ },
    });
  }

  copyText(text: string, key = 'alias'): void {
    navigator.clipboard.writeText(text).then(() => {
      this.copied.set(key);
      setTimeout(() => this.copied.set(''), 2000);
    });
  }

  canCancel(status: string): boolean {
    return CANCELLABLE.has(status);
  }

  cancelOrder(orderId: number): void {
    if (!confirm(`¿Cancelar el pedido #${orderId}? Esta acción no se puede deshacer.`)) return;
    this.cancelling.set(true);
    this.orderService.cancelOrder(orderId).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.cancelling.set(false);
      },
      error: () => {
        this.cancelling.set(false);
      },
    });
  }

  statusLabel(status: string): string {
    return STATUS_CONFIG[status]?.label ?? status;
  }
  statusIcon(status: string): string {
    return STATUS_CONFIG[status]?.icon ?? '•';
  }
  statusColor(status: string): string {
    return STATUS_CONFIG[status]?.color ?? '#6b7280';
  }
  statusBg(status: string): string {
    const c = STATUS_CONFIG[status]?.color ?? '#6b7280';
    return c + '20';   // 12% opacity hex
  }

  isStepDone(currentStatus: string, stepKey: string): boolean {
    if (currentStatus === 'cancelled') return false;
    const ci = this.stepOrder.indexOf(currentStatus);
    const si = this.stepOrder.indexOf(stepKey);
    return si <= ci;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatDateShort(iso: string): string {
    return new Date(iso).toLocaleDateString('es-AR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
  }

  printReceipt(o: Order): void {
    const items = o.items.map(item =>
      `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${item.productName}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:center;">${item.color} / ${item.size}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;">$ ${(item.unitPrice / 100).toLocaleString('es-AR')}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;">$ ${((item.unitPrice * item.quantity) / 100).toLocaleString('es-AR')}</td>
      </tr>`
    ).join('');

    const addr = o.shippingAddress
      ? `${o.shippingAddress.street}${o.shippingAddress.apartment ? ', ' + o.shippingAddress.apartment : ''}, ${o.shippingAddress.city}, ${o.shippingAddress.province} (${o.shippingAddress.postalCode})`
      : 'Sin dirección registrada';

    const tracking = o.trackingNumber
      ? `<p style="margin:4px 0;"><strong>N° seguimiento:</strong> ${o.trackingNumber}${o.trackingUrl ? ` — <a href="${o.trackingUrl}">${o.trackingUrl}</a>` : ''}</p>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Comprobante Pedido #${o.orderId}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; margin: 0; padding: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 12px; margin: 0 0 20px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #111; padding-bottom: 12px; }
    .brand { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
    .meta p { margin: 2px 0; font-size: 12px; color: #6b7280; text-align: right; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; padding: 6px 0; border-bottom: 2px solid #e5e7eb; }
    .totals { margin-left: auto; width: 260px; margin-top: 8px; }
    .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
    .grand { font-weight: 700; font-size: 15px; border-bottom: none; padding-top: 8px; }
    .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 11px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">✦ Solder Studio</div>
      <p class="subtitle">Ropa personalizada · Buenos Aires, Argentina</p>
    </div>
    <div class="meta">
      <p><strong>Pedido #${o.orderId}</strong></p>
      <p>Fecha: ${this.formatDate(o.createdAt)}</p>
      <p>Estado: ${this.statusLabel(o.status)}</p>
    </div>
  </div>

  <h1>Comprobante de compra</h1>

  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th>Variante</th>
        <th style="text-align:center;">Cant.</th>
        <th style="text-align:right;">P. Unit.</th>
        <th style="text-align:right;">Subtotal</th>
      </tr>
    </thead>
    <tbody>${items}</tbody>
  </table>

  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>$ ${(o.amounts.subtotal / 100).toLocaleString('es-AR')}</span></div>
    ${o.amounts.discount > 0 ? `<div class="total-row"><span>Descuento</span><span>- $ ${(o.amounts.discount / 100).toLocaleString('es-AR')}</span></div>` : ''}
    ${o.amounts.shipping > 0 ? `<div class="total-row"><span>Envío</span><span>$ ${(o.amounts.shipping / 100).toLocaleString('es-AR')}</span></div>` : '<div class="total-row"><span>Envío</span><span>Gratis</span></div>'}
    ${o.amounts.tax > 0 ? `<div class="total-row"><span>Impuestos</span><span>$ ${(o.amounts.tax / 100).toLocaleString('es-AR')}</span></div>` : ''}
    <div class="total-row grand"><span>Total</span><span>$ ${(o.amounts.total / 100).toLocaleString('es-AR')}</span></div>
  </div>

  <div style="margin-top:20px;font-size:12px;color:#374151;">
    <p style="margin:4px 0;"><strong>Dirección de envío:</strong> ${addr}</p>
    ${tracking}
  </div>

  <div class="footer">
    Solder Studio · Ropa personalizada · Buenos Aires, Argentina<br>
    Este comprobante no es una factura legal.
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=800,height=700');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }
}
