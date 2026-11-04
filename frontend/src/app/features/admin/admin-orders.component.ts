import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { environment } from '@env/environment';
import { PricePipe } from '@shared/pipes/price.pipe';
import { ToastService } from '@core/services/toast.service';

const ALL_STATUSES = [
  'pending', 'awaiting_payment', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded'
] as const;
type OrderStatus = typeof ALL_STATUSES[number];

interface OrderItem {
  productName: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  customDesignId: number | null;
}
interface AdminOrder {
  orderId: number;
  status: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  amounts: { subtotal: number; discount: number; tax: number; shipping: number; total: number; currency: string };
  shippingAddress: { street: string; apartment: string; city: string; province: string; postalCode: string } | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, PricePipe],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="header-left">
          <h2>Pedidos</h2>
          <span class="count-badge">{{ totalElements }}</span>
        </div>
      </div>

      <!-- Filters bar -->
      <div class="filters-bar">
        <!-- Search -->
        <div class="search-box">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Buscar por cliente, email o #ID..."
            class="search-input"
          />
          @if (searchQuery) {
            <button class="clear-search" (click)="clearSearch()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          }
        </div>

        <!-- Status filter tabs -->
        <div class="status-tabs" role="tablist">
          <button
            role="tab"
            class="status-tab"
            [class.active]="activeStatusFilter === null"
            (click)="setStatusFilter(null)">
            Todos
          </button>
          @for (s of allStatuses; track s) {
            <button
              role="tab"
              class="status-tab"
              [class.active]="activeStatusFilter === s"
              [attr.data-status]="s"
              (click)="setStatusFilter(s)">
              {{ statusLabel(s) }}
            </button>
          }
        </div>
      </div>

      @if (errorMessage()) {
        <div class="alert-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {{ errorMessage() }}
        </div>
      }

      <!-- Table -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Items</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Actualizar</th>
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
              <tr>
                <td colspan="7" class="empty-cell">
                  <div class="empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><line x1="16" y1="12" x2="16" y2="12"/></svg>
                    <p>No se encontraron pedidos</p>
                  </div>
                </td>
              </tr>
            }
            @for (order of orders; track order.orderId) {
              <tr
                class="order-row"
                [class.expanded]="expandedId() === order.orderId"
                (click)="toggleExpand(order.orderId)">
                <td>
                  <span class="order-id">#{{ order.orderId }}</span>
                </td>
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
                </td>
                <td>
                  <strong>{{ order.amounts.total | price: order.amounts.currency }}</strong>
                </td>
                <td>
                  <span class="status-badge" [attr.data-status]="order.status">
                    {{ statusLabel(order.status) }}
                  </span>
                </td>
                <td (click)="$event.stopPropagation()">
                  @if (updatingId() === order.orderId) {
                    <span class="updating-indicator">
                      <span class="spinner"></span>
                      Guardando...
                    </span>
                  } @else {
                    <select
                      [ngModel]="order.status.toUpperCase()"
                      (ngModelChange)="onStatusChange(order, $event)"
                      class="status-select"
                      (click)="$event.stopPropagation()">
                      @for (s of allStatuses; track s) {
                        <option [value]="s.toUpperCase()">{{ statusLabel(s) }}</option>
                      }
                    </select>
                  }
                </td>
              </tr>

              <!-- Expanded detail row -->
              @if (expandedId() === order.orderId) {
                <tr class="detail-row" (click)="$event.stopPropagation()">
                  <td colspan="7">
                    <div class="detail-panel">
                      <!-- Items -->
                      <div class="detail-section">
                        <h4>Productos</h4>
                        <div class="detail-items">
                          @for (item of order.items; track $index) {
                            <div class="detail-item">
                              <div class="item-info">
                                <span class="item-name">{{ item.productName }}</span>
                                <span class="item-variant">{{ item.color }} / Talle {{ item.size }}</span>
                                @if (item.customDesignId) {
                                  <span class="custom-badge">Personalizado</span>
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

                      <!-- Amounts breakdown -->
                      <div class="detail-section">
                        <h4>Montos</h4>
                        <div class="amounts-grid">
                          <span>Subtotal</span><span>{{ order.amounts.subtotal | price: order.amounts.currency }}</span>
                          @if (order.amounts.discount > 0) {
                            <span>Descuento</span><span class="discount">-{{ order.amounts.discount | price: order.amounts.currency }}</span>
                          }
                          @if (order.amounts.shipping > 0) {
                            <span>Envío</span><span>{{ order.amounts.shipping | price: order.amounts.currency }}</span>
                          }
                          @if (order.amounts.tax > 0) {
                            <span>Impuestos</span><span>{{ order.amounts.tax | price: order.amounts.currency }}</span>
                          }
                          <span class="total-label"><strong>Total</strong></span>
                          <span><strong>{{ order.amounts.total | price: order.amounts.currency }}</strong></span>
                        </div>
                      </div>

                      <!-- Shipping address -->
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

                      <!-- Tracking number editor -->
                      <div class="detail-section tracking-edit-section">
                        <h4>Seguimiento de envío</h4>
                        @if (trackingEditId() === order.orderId) {
                          <div class="tracking-form">
                            <input
                              type="text"
                              [(ngModel)]="trackingNumberInput"
                              placeholder="N° seguimiento (ej: OCA123456)"
                              class="tracking-input"
                            />
                            <input
                              type="text"
                              [(ngModel)]="trackingUrlInput"
                              placeholder="URL de rastreo (opcional)"
                              class="tracking-input"
                            />
                            <div class="tracking-actions">
                              @if (savingTrackingId() === order.orderId) {
                                <span class="updating-indicator"><span class="spinner"></span>Guardando...</span>
                              } @else {
                                <button class="btn-save-tracking" (click)="saveTracking(order)">Guardar</button>
                                <button class="btn-cancel-tracking" (click)="cancelTrackingEdit()">Cancelar</button>
                              }
                            </div>
                          </div>
                        } @else {
                          @if (order.trackingNumber) {
                            <p class="tracking-display">
                              <strong>{{ order.trackingNumber }}</strong>
                              @if (order.trackingUrl) {
                                <a [href]="order.trackingUrl" target="_blank" rel="noopener" class="tracking-ext-link">↗</a>
                              }
                            </p>
                          } @else {
                            <p class="tracking-empty">Sin número de seguimiento</p>
                          }
                          <button class="btn-edit-tracking" (click)="startTrackingEdit(order)">
                            ✏️ {{ order.trackingNumber ? 'Editar' : 'Agregar' }} seguimiento
                          </button>
                        }
                      </div>

                      <!-- Admin notes editor -->
                      <div class="detail-section notes-section">
                        <h4>Notas internas</h4>
                        @if (notesEditId() === order.orderId) {
                          <div class="notes-form">
                            <textarea
                              [(ngModel)]="notesInput"
                              rows="3"
                              placeholder="Notas visibles solo para el equipo..."
                              class="notes-textarea"
                            ></textarea>
                            <div class="tracking-actions">
                              @if (savingNotesId() === order.orderId) {
                                <span class="updating-indicator"><span class="spinner"></span>Guardando...</span>
                              } @else {
                                <button class="btn-save-tracking" (click)="saveNotes(order)">Guardar</button>
                                <button class="btn-cancel-tracking" (click)="cancelNotesEdit()">Cancelar</button>
                              }
                            </div>
                          </div>
                        } @else {
                          @if (order.adminNotes) {
                            <p class="notes-display">{{ order.adminNotes }}</p>
                          } @else {
                            <p class="tracking-empty">Sin notas</p>
                          }
                          <button class="btn-edit-tracking" (click)="startNotesEdit(order)">
                            ✏️ {{ order.adminNotes ? 'Editar' : 'Agregar' }} nota
                          </button>
                        }
                      </div>

                      <!-- Refund action -->
                      @if (order.status === 'delivered' || order.status === 'paid') {
                        <div class="detail-section refund-section">
                          <h4>Acciones</h4>
                          @if (refundingId() === order.orderId) {
                            <span class="updating-indicator">
                              <span class="spinner"></span>Procesando...
                            </span>
                          } @else {
                            <button class="btn-refund" (click)="refundOrder(order)">
                              💸 Reembolsar pedido
                            </button>
                          }
                        </div>
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
      @if (totalPages > 1) {
        <div class="pagination">
          <button (click)="loadPage(currentPage - 1)" [disabled]="currentPage === 0 || loading()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          @for (p of pageNumbers(); track p) {
            <button (click)="loadPage(p)" [class.active]="p === currentPage" [disabled]="loading()">
              {{ p + 1 }}
            </button>
          }
          <button (click)="loadPage(currentPage + 1)" [disabled]="currentPage >= totalPages - 1 || loading()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .page { padding: 1.5rem; }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .header-left { display: flex; align-items: center; gap: 0.75rem; }
    h2 { margin: 0; font-size: 1.3rem; font-weight: 700; }
    .count-badge {
      background: var(--primary);
      color: white;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
    }

    /* Filters */
    .filters-bar {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }
    .search-box {
      position: relative;
      max-width: 380px;
    }
    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      padding: 0.5rem 2.25rem 0.5rem 2.25rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.875rem;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.15s;
    }
    .search-input:focus { border-color: var(--primary); }
    .clear-search {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-muted);
      padding: 2px;
      display: flex;
      align-items: center;
    }
    .clear-search:hover { color: var(--text); }

    /* Status tabs */
    .status-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }
    .status-tab {
      padding: 0.3rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 20px;
      background: var(--bg-card);
      font-size: 0.78rem;
      cursor: pointer;
      transition: all 0.15s;
      color: var(--text-muted);
    }
    .status-tab:hover { border-color: var(--primary); color: var(--primary); }
    .status-tab.active { background: var(--primary); border-color: var(--primary); color: white; font-weight: 600; }

    /* Alert */
    .alert-error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--danger-bg);
      border: 1px solid var(--danger-border);
      color: var(--danger-text);
      padding: 0.75rem 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      font-size: 0.875rem;
    }

    /* Table */
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 10px;
    }
    table { width: 100%; border-collapse: collapse; min-width: 700px; }
    thead { background: var(--bg-secondary); }
    th {
      padding: 0.6rem 1rem;
      text-align: left;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 0.75rem 1rem;
      border-top: 1px solid var(--border);
      font-size: 0.875rem;
      vertical-align: middle;
    }
    .order-row {
      cursor: pointer;
      transition: background 0.1s;
    }
    .order-row:hover { background: var(--bg-secondary); }
    .order-row.expanded { background: var(--bg-secondary); }

    .order-id { font-weight: 700; color: var(--primary); }
    .date-cell { display: flex; flex-direction: column; gap: 1px; }
    .time-muted { font-size: 0.75rem; color: var(--text-muted); }
    .customer-info { display: flex; flex-direction: column; gap: 1px; }
    .customer-name { font-weight: 500; }
    .customer-email { font-size: 0.775rem; color: var(--text-muted); }
    .items-count { color: var(--text-muted); font-size: 0.825rem; }

    /* Status badge */
    .status-badge {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }
    .status-badge[data-status="paid"]             { background: var(--success-bg); color: var(--success); }
    .status-badge[data-status="awaiting_payment"] { background: var(--warning-bg); color: var(--warning-text); }
    .status-badge[data-status="pending"]          { background: var(--warning-bg); color: var(--warning-text); }
    .status-badge[data-status="preparing"]        { background: var(--bg-secondary); color: var(--primary); }
    .status-badge[data-status="shipped"]          { background: var(--info-bg); color: var(--info-text); }
    .status-badge[data-status="delivered"]        { background: var(--success-bg); color: var(--success-text); }
    .status-badge[data-status="cancelled"]        { background: var(--danger-bg); color: var(--danger); }
    .status-badge[data-status="refunded"]         { background: var(--bg-secondary); color: var(--text-secondary); }

    .status-select {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 0.82rem;
      cursor: pointer;
      background: var(--bg-card);
    }
    .updating-indicator {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Detail panel */
    .detail-row td { background: var(--bg-secondary); padding: 0; }
    .detail-panel {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.25rem;
      padding: 1rem 1.25rem;
      border-top: 2px solid var(--border);
    }
    .detail-section h4 {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 600;
      margin: 0 0 0.6rem;
    }
    .detail-items { display: flex; flex-direction: column; gap: 0.5rem; }
    .detail-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
      font-size: 0.825rem;
    }
    .item-info { display: flex; flex-direction: column; gap: 1px; }
    .item-name { font-weight: 500; }
    .item-variant { font-size: 0.775rem; color: var(--text-muted); }
    .custom-badge {
      display: inline-block;
      background: var(--info-bg);
      color: var(--info);
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 600;
      width: fit-content;
    }
    .item-qty-price { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; white-space: nowrap; }
    .item-qty { font-size: 0.775rem; color: var(--text-muted); }
    .item-price { font-weight: 600; font-size: 0.85rem; }

    .amounts-grid {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.3rem 1rem;
      font-size: 0.825rem;
    }
    .amounts-grid .total-label { padding-top: 0.25rem; border-top: 1px solid var(--border); }
    .amounts-grid strong + strong { padding-top: 0.25rem; border-top: 1px solid var(--border); }
    .discount { color: var(--success); }

    .shipping-address {
      font-style: normal;
      font-size: 0.825rem;
      line-height: 1.6;
      color: var(--text-muted);
    }
    /* Tracking editor */
    .tracking-edit-section { display: flex; flex-direction: column; gap: 0.5rem; }
    .tracking-form { display: flex; flex-direction: column; gap: 0.4rem; }
    .tracking-input {
      padding: 0.4rem 0.6rem; border: 1px solid var(--border); border-radius: 6px;
      font-size: 0.82rem; outline: none; transition: border-color 0.15s;
    }
    .tracking-input:focus { border-color: var(--primary); }
    .tracking-actions { display: flex; gap: 0.4rem; }
    .btn-save-tracking {
      padding: 0.35rem 0.85rem; background: var(--primary); color: white;
      border: none; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;
      transition: background 0.15s;
    }
    .btn-save-tracking:hover { background: var(--primary-dark); }
    .btn-cancel-tracking {
      padding: 0.35rem 0.85rem; background: var(--bg-card); color: var(--text-muted);
      border: 1px solid var(--border); border-radius: 6px; font-size: 0.8rem;
      font-weight: 500; cursor: pointer; transition: background 0.15s;
    }
    .btn-cancel-tracking:hover { background: var(--bg-secondary); }
    .tracking-display { margin: 0 0 0.3rem; font-size: 0.85rem; color: var(--primary-dark); display: flex; align-items: center; gap: 0.3rem; }
    .tracking-ext-link { color: var(--primary); text-decoration: none; font-size: 0.9rem; }
    .tracking-empty { margin: 0 0 0.3rem; font-size: 0.8rem; color: var(--text-muted); font-style: italic; }
    .btn-edit-tracking {
      display: inline-flex; align-items: center; gap: 0.3rem;
      padding: 0.3rem 0.75rem; background: var(--bg-card); color: var(--text);
      border: 1px solid var(--border); border-radius: 6px; font-size: 0.78rem;
      font-weight: 500; cursor: pointer; transition: background 0.15s;
    }
    .btn-edit-tracking:hover { background: var(--bg-secondary); }

    /* Notes editor */
    .notes-section { display: flex; flex-direction: column; gap: 0.5rem; }
    .notes-form { display: flex; flex-direction: column; gap: 0.4rem; }
    .notes-textarea {
      padding: 0.5rem 0.6rem; border: 1px solid var(--border); border-radius: 6px;
      font-size: 0.82rem; font-family: inherit; resize: vertical; outline: none;
      transition: border-color 0.15s; min-height: 64px;
    }
    .notes-textarea:focus { border-color: var(--primary); }
    .notes-display {
      margin: 0 0 0.3rem; font-size: 0.82rem; color: var(--text);
      white-space: pre-wrap; background: var(--warning-bg); border: 1px solid var(--warning-border);
      border-radius: 6px; padding: 0.5rem 0.6rem;
    }

    .refund-section { display: flex; flex-direction: column; gap: 0.5rem; }
    .btn-refund {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.45rem 1rem; background: var(--danger-bg); color: var(--danger);
      border: 1.5px solid var(--danger-border); border-radius: 8px; font-size: 0.82rem;
      font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap;
    }
    .btn-refund:hover { background: var(--danger-bg); border-color: var(--danger); }

    /* Empty / skeleton */
    .empty-cell { text-align: center; padding: 3rem; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: var(--text-muted); }
    .empty-state p { margin: 0; font-size: 0.875rem; }
    .skeleton-row td { border-top: 1px solid var(--border); padding: 0.75rem 1rem; }
    .skel {
      height: 12px;
      border-radius: 4px;
      background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--border) 50%, var(--bg-secondary) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    .w-12 { width: 48px; } .w-16 { width: 64px; } .w-20 { width: 80px; }
    .w-24 { width: 96px; } .w-28 { width: 112px; } .w-32 { width: 128px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Pagination */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      margin-top: 1rem;
    }
    .pagination button {
      min-width: 32px;
      height: 32px;
      padding: 0 6px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg-card);
      cursor: pointer;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }
    .pagination button.active {
      background: var(--primary);
      color: white;
      border-color: transparent;
    }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
    .pagination button:not(:disabled):not(.active):hover {
      background: var(--bg-secondary);
    }
  `],
})
export class AdminOrdersComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  private readonly apiUrl = `${environment.apiUrl}/admin/orders`;
  private searchSubject = new Subject<string>();

  orders: AdminOrder[] = [];
  loading = signal(true);
  errorMessage = signal('');
  updatingId = signal<number | null>(null);
  refundingId = signal<number | null>(null);
  expandedId = signal<number | null>(null);
  trackingEditId = signal<number | null>(null);
  savingTrackingId = signal<number | null>(null);
  trackingNumberInput = '';
  trackingUrlInput = '';
  notesEditId = signal<number | null>(null);
  savingNotesId = signal<number | null>(null);
  notesInput = '';

  currentPage = 0;
  totalPages = 0;
  totalElements = 0;
  pageSize = 10;

  searchQuery = '';
  activeStatusFilter: OrderStatus | null = null;

  readonly allStatuses = ALL_STATUSES;

  ngOnInit(): void {
    // Debounce search input
    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.loadPage(0));

    this.loadPage(0);
  }

  loadPage(page: number): void {
    this.loading.set(true);
    this.errorMessage.set('');

    let params = new HttpParams()
      .set('page', page)
      .set('size', this.pageSize)
      .set('sort', 'createdAt,desc');

    if (this.activeStatusFilter) {
      params = params.set('status', this.activeStatusFilter.toUpperCase());
    }
    if (this.searchQuery.trim()) {
      params = params.set('q', this.searchQuery.trim());
    }

    this.http.get<{ content: AdminOrder[]; totalElements: number; totalPages: number }>(
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

  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.loadPage(0);
  }

  setStatusFilter(status: OrderStatus | null): void {
    this.activeStatusFilter = status;
    this.loadPage(0);
  }

  toggleExpand(id: number): void {
    this.expandedId.update(cur => cur === id ? null : id);
  }

  onStatusChange(order: AdminOrder, newStatus: string): void {
    const currentUpper = order.status.toUpperCase();
    if (newStatus === currentUpper) return;

    this.updatingId.set(order.orderId);
    this.http.patch<AdminOrder>(`${this.apiUrl}/${order.orderId}/status`, { status: newStatus })
      .subscribe({
        next: updated => {
          const idx = this.orders.findIndex(o => o.orderId === order.orderId);
          if (idx !== -1) this.orders[idx] = { ...this.orders[idx], ...updated };
          this.updatingId.set(null);
          this.toast.success(`Estado del pedido #${order.orderId} actualizado`);
        },
        error: err => {
          const msg = err.error?.error || 'Error al actualizar el estado';
          this.errorMessage.set(msg);
          this.toast.error(msg);
          this.updatingId.set(null);
        },
      });
  }

  refundOrder(order: AdminOrder): void {
    if (!confirm(`¿Reembolsar el pedido #${order.orderId}? Esta acción no se puede deshacer.`)) return;

    this.refundingId.set(order.orderId);
    this.http.post<AdminOrder>(`${this.apiUrl}/${order.orderId}/refund`, {})
      .subscribe({
        next: updated => {
          const idx = this.orders.findIndex(o => o.orderId === order.orderId);
          if (idx !== -1) this.orders[idx] = { ...this.orders[idx], ...updated };
          this.refundingId.set(null);
          this.toast.success(`Pedido #${order.orderId} reembolsado`);
        },
        error: err => {
          const msg = err.error?.error || 'Error al procesar el reembolso';
          this.errorMessage.set(msg);
          this.toast.error(msg);
          this.refundingId.set(null);
        },
      });
  }

  startTrackingEdit(order: AdminOrder): void {
    this.trackingEditId.set(order.orderId);
    this.trackingNumberInput = order.trackingNumber ?? '';
    this.trackingUrlInput = order.trackingUrl ?? '';
  }

  cancelTrackingEdit(): void {
    this.trackingEditId.set(null);
    this.trackingNumberInput = '';
    this.trackingUrlInput = '';
  }

  saveTracking(order: AdminOrder): void {
    this.savingTrackingId.set(order.orderId);
    this.http.patch<AdminOrder>(`${this.apiUrl}/${order.orderId}/tracking`, {
      trackingNumber: this.trackingNumberInput.trim() || null,
      trackingUrl: this.trackingUrlInput.trim() || null,
    }).subscribe({
      next: updated => {
        const idx = this.orders.findIndex(o => o.orderId === order.orderId);
        if (idx !== -1) this.orders[idx] = { ...this.orders[idx], ...updated };
        this.savingTrackingId.set(null);
        this.trackingEditId.set(null);
        this.toast.success(`Seguimiento actualizado para pedido #${order.orderId}`);
      },
      error: err => {
        const msg = err.error?.error || 'Error al guardar el seguimiento';
        this.toast.error(msg);
        this.savingTrackingId.set(null);
      },
    });
  }

  startNotesEdit(order: AdminOrder): void {
    this.notesEditId.set(order.orderId);
    this.notesInput = order.adminNotes ?? '';
  }

  cancelNotesEdit(): void {
    this.notesEditId.set(null);
    this.notesInput = '';
  }

  saveNotes(order: AdminOrder): void {
    this.savingNotesId.set(order.orderId);
    this.http.patch<AdminOrder>(`${this.apiUrl}/${order.orderId}/notes`, {
      notes: this.notesInput.trim() || null,
    }).subscribe({
      next: updated => {
        const idx = this.orders.findIndex(o => o.orderId === order.orderId);
        if (idx !== -1) this.orders[idx] = { ...this.orders[idx], ...updated };
        this.savingNotesId.set(null);
        this.notesEditId.set(null);
        this.notesInput = '';
        this.toast.success(`Nota guardada para pedido #${order.orderId}`);
      },
      error: err => {
        const msg = err.error?.error || 'Error al guardar la nota';
        this.toast.error(msg);
        this.savingNotesId.set(null);
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
      pending:          'Pendiente',
      awaiting_payment: 'Esp. pago',
      paid:             'Pagado',
      preparing:        'Preparando',
      shipped:          'Enviado',
      delivered:        'Entregado',
      cancelled:        'Cancelado',
      refunded:         'Reembolsado',
    };
    return labels[status?.toLowerCase()] ?? status;
  }
}
