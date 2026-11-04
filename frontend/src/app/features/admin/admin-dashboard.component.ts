import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';
import { PricePipe } from '@shared/pipes/price.pipe';

interface StatsResponse {
  totalOrders: number;
  newOrdersLast30Days: number;
  pendingOrders: number;
  ordersByStatus: Record<string, number>;
  totalRevenue: number;
  monthRevenue: number;
  lastMonthRevenue: number;
  totalUsers: number;
  totalCustomers: number;
  newUsersLast30Days: number;
  totalProducts: number;
  activeProducts: number;
  lowStockCount: number;
  recentOrders: RecentOrder[];
  dailyRevenue: DailyPoint[];
}

interface RecentOrder {
  id: number;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
}

interface DailyPoint {
  day: string;
  total: number;
}

interface StockAlert {
  variantId: number;
  productId: number;
  productName: string;
  color: string;
  size: string;
  stockAvailable: number;
  active: boolean;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PricePipe],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Panel de Administración</h1>
        <div class="header-right">
          <!-- Date range filter -->
          <div class="date-filter">
            <label class="date-label">Desde</label>
            <input type="date" class="date-input" [(ngModel)]="dateFrom" (change)="loadStats()" />
            <label class="date-label">Hasta</label>
            <input type="date" class="date-input" [(ngModel)]="dateTo" (change)="loadStats()" />
            <button class="btn-clear-dates" (click)="clearDateFilter()" title="Limpiar filtro de fechas">✕</button>
          </div>
          <button class="btn-refresh" (click)="loadStats()" [disabled]="loading">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 [class.spinning]="loading">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            Actualizar
          </button>
        </div>
      </div>

      @if (loading && !stats) {
        <div class="skeleton-grid">
          @for (i of [1,2,3,4]; track i) {
            <div class="skeleton-card"></div>
          }
        </div>
      }

      @if (error) {
        <div class="error-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="error-icon">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>No se pudo cargar las estadísticas.</p>
          <p class="error-hint">Asegurate de que el servidor esté corriendo y que tengas permisos de administrador.</p>
          <button class="btn-retry" (click)="loadStats()">Reintentar</button>
        </div>
      }

      @if (stats) {
        <!-- KPI Cards -->
        <div class="kpi-grid">
          <!-- Revenue -->
          <div class="kpi-card accent-blue">
            <div class="kpi-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
            </div>
            <div class="kpi-body">
              <span class="kpi-label">Ingresos totales</span>
              <span class="kpi-value">{{ stats.totalRevenue | price:'ARS' }}</span>
              <span class="kpi-sub">
                Este mes: {{ stats.monthRevenue | price:'ARS' }}
                @if (revenueChange !== null) {
                  <span [class]="revenueChange >= 0 ? 'trend-up' : 'trend-down'">
                    {{ revenueChange >= 0 ? '▲' : '▼' }} {{ absRevenueChange }}%
                  </span>
                }
              </span>
            </div>
          </div>

          <!-- Orders -->
          <div class="kpi-card accent-green">
            <div class="kpi-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
            </div>
            <div class="kpi-body">
              <span class="kpi-label">Pedidos totales</span>
              <span class="kpi-value">{{ stats.totalOrders | number }}</span>
              <span class="kpi-sub">{{ stats.newOrdersLast30Days }} nuevos últimos 30 días</span>
            </div>
          </div>

          <!-- Pending -->
          <div class="kpi-card" [class.accent-orange]="stats.pendingOrders > 0">
            <div class="kpi-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div class="kpi-body">
              <span class="kpi-label">Pedidos pendientes</span>
              <span class="kpi-value">{{ stats.pendingOrders }}</span>
              <span class="kpi-sub">Requieren atención</span>
            </div>
          </div>

          <!-- Customers -->
          <div class="kpi-card accent-purple">
            <div class="kpi-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div class="kpi-body">
              <span class="kpi-label">Clientes</span>
              <span class="kpi-value">{{ stats.totalCustomers | number }}</span>
              <span class="kpi-sub">{{ stats.newUsersLast30Days }} nuevos últimos 30 días</span>
            </div>
          </div>
        </div>

        <!-- Revenue sparkline + Low-stock + Export row -->
        <div class="mid-grid three-col" style="margin-bottom:1.25rem">
          <!-- Daily revenue sparkline -->
          <div class="panel">
            <h3 class="panel-title">Ingresos últimos 7 días</h3>
            @if (stats.dailyRevenue.length) {
              <svg class="sparkline" viewBox="0 0 280 60" preserveAspectRatio="none">
                <polyline
                  [attr.points]="sparklinePoints"
                  fill="none" class="spark-line" stroke-width="2"
                  stroke-linejoin="round" stroke-linecap="round"/>
                <polyline
                  [attr.points]="sparklineAreaPoints"
                  fill="url(#sparkGrad)" stroke="none"/>
                <defs>
                  <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.18"/>
                    <stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>
                  </linearGradient>
                </defs>
              </svg>
              <div class="spark-labels">
                @for (pt of stats.dailyRevenue; track pt.day) {
                  <span>{{ formatSparkLabel(pt.day) }}</span>
                }
              </div>
            }
          </div>

          <!-- Low stock alert -->
          <div class="panel" [class.alert-panel]="stats.lowStockCount > 0">
            <div class="panel-header-row">
              <h3 class="panel-title">Stock bajo</h3>
              @if (stats.lowStockCount > 0) {
                <span class="badge-red">{{ stats.lowStockCount }}</span>
              }
            </div>
            @if (stats.lowStockCount === 0) {
              <p class="empty-hint">✓ Todos los productos con stock suficiente</p>
            } @else {
              <p class="alert-hint">{{ stats.lowStockCount }} variante(s) con 5 unidades o menos.</p>
              @if (stockAlerts.length > 0) {
                <div class="stock-alert-list">
                  @for (a of stockAlerts; track a.variantId) {
                    <a class="stock-alert-row" [routerLink]="['/admin/products']"
                       [title]="'Ir a productos'">
                      <span class="stock-alert-name">{{ a.productName }}</span>
                      <span class="stock-alert-variant">{{ a.color }} / {{ a.size }}</span>
                      <span class="stock-alert-qty" [class.stock-zero]="a.stockAvailable === 0">
                        {{ a.stockAvailable === 0 ? 'Sin stock' : a.stockAvailable + ' u.' }}
                      </span>
                    </a>
                  }
                </div>
              }
            }
          </div>

          <!-- Export -->
          <div class="panel">
            <h3 class="panel-title">Exportar datos</h3>
            <div class="quick-links">
              <button class="quick-link export-link"
                      (click)="downloadCsv('pedidos.csv', apiUrl + '/admin/export/orders.csv')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Exportar pedidos (.csv)
              </button>
              <button class="quick-link export-link"
                      (click)="downloadCsv('inventario.csv', apiUrl + '/admin/export/products.csv')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Exportar inventario (.csv)
              </button>
              <button class="quick-link export-link"
                      (click)="downloadCsv('stock-bajo.csv', apiUrl + '/admin/export/products.csv?lowStockOnly=true')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Exportar stock bajo (.csv)
              </button>
            </div>
          </div>
        </div>

        <!-- Mid row: Orders by status + Products -->
        <div class="mid-grid">
          <!-- Orders by status -->
          <div class="panel">
            <h3 class="panel-title">Estado de pedidos</h3>
            <div class="status-list">
              @for (s of statusList; track s.key) {
                <div class="status-row">
                  <div class="status-info">
                    <span class="status-dot" [style.background]="s.color"></span>
                    <span class="status-label">{{ s.label }}</span>
                  </div>
                  <div class="status-bar-wrap">
                    <div class="status-bar"
                         [style.width.%]="getStatusPct(s.key)"
                         [style.background]="s.color">
                    </div>
                  </div>
                  <span class="status-count">{{ getStatusCount(s.key) }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Products & quick nav -->
          <div class="panel">
            <h3 class="panel-title">Catálogo</h3>
            <div class="catalog-stats">
              <div class="catalog-stat">
                <span class="cs-value">{{ stats.activeProducts }}</span>
                <span class="cs-label">Productos activos</span>
              </div>
              <div class="catalog-stat">
                <span class="cs-value">{{ stats.totalProducts }}</span>
                <span class="cs-label">Total productos</span>
              </div>
            </div>
            <div class="quick-links">
              <a routerLink="/admin/products" class="quick-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                Gestionar productos
              </a>
              <a routerLink="/admin/categories" class="quick-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                Gestionar categorías
              </a>
              <a routerLink="/admin/orders" class="quick-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                </svg>
                Ver todos los pedidos
              </a>
              <a routerLink="/admin/users" class="quick-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Gestionar usuarios
              </a>
            </div>
          </div>
        </div>

        <!-- Recent Orders -->
        <div class="panel">
          <div class="panel-header-row">
            <h3 class="panel-title">Últimos pedidos</h3>
            <a routerLink="/admin/orders" class="view-all">Ver todos →</a>
          </div>
          <table class="orders-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              @for (order of stats.recentOrders; track order.id) {
                <tr>
                  <td class="order-id">#{{ order.id }}</td>
                  <td>
                    <div class="customer-cell">
                      <span class="customer-name">{{ order.customerName }}</span>
                      <span class="customer-email">{{ order.customerEmail }}</span>
                    </div>
                  </td>
                  <td>
                    <span class="status-badge" [class]="'status-' + order.status.toLowerCase()">
                      {{ statusLabel(order.status) }}
                    </span>
                  </td>
                  <td class="amount">{{ order.total | price: order.currency }}</td>
                  <td class="date">{{ order.createdAt | date:'dd/MM/yy HH:mm' }}</td>
                </tr>
              }
            </tbody>
          </table>
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
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem; }
    .page-header h1 { margin: 0; font-size: 1.4rem; color: var(--text); }

    .header-right { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }

    .date-filter {
      display: flex; align-items: center; gap: 0.4rem;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px;
      padding: 4px 10px; font-size: 0.82rem;
    }
    .date-label { color: var(--text-secondary); font-size: 0.78rem; font-weight: 500; white-space: nowrap; }
    .date-input {
      border: none; outline: none; font-size: 0.82rem; color: var(--text);
      cursor: pointer; background: transparent;
    }
    .date-input::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; }
    .btn-clear-dates {
      background: none; border: none; cursor: pointer; color: var(--text-secondary);
      font-size: 0.9rem; padding: 0 2px; line-height: 1;
      display: flex; align-items: center;
    }
    .btn-clear-dates:hover { color: var(--text); }

    .btn-refresh {
      display: flex; align-items: center; gap: 0.4rem;
      background: none; border: 1px solid var(--border); border-radius: 6px;
      padding: 6px 12px; font-size: 0.82rem; cursor: pointer; color: var(--text-secondary);
    }
    .btn-refresh:hover:not(:disabled) { background: var(--bg-secondary); }
    .btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
    .spinning { animation: spin 0.8s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    /* Skeleton */
    .skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(220px,1fr)); gap: 1rem; margin-bottom: 1rem; }
    .skeleton-card { height: 110px; background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--border) 50%, var(--bg-secondary) 75%);
      background-size: 200% 100%; animation: shimmer 1.2s infinite; border-radius: 10px; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    /* KPI Grid */
    .kpi-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 1rem; margin-bottom: 1.25rem;
    }
    .kpi-card {
      display: flex; align-items: flex-start; gap: 1rem;
      padding: 1.1rem 1.25rem; border: 1px solid var(--border);
      border-radius: 10px; background: var(--bg-card);
    }
    .kpi-icon {
      width: 40px; height: 40px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; background: var(--bg-secondary); color: var(--text-secondary);
    }
    .accent-blue .kpi-icon  { background: var(--bg-secondary); color: var(--primary); }
    .accent-green .kpi-icon { background: var(--success-bg);   color: var(--success); }
    .accent-orange .kpi-icon{ background: var(--warning-bg);   color: var(--warning); }
    .accent-purple .kpi-icon{ background: var(--info-bg);      color: var(--info); }

    .kpi-body { display: flex; flex-direction: column; min-width: 0; }
    .kpi-label { font-size: 0.78rem; color: var(--text-secondary); font-weight: 500; text-transform: uppercase; letter-spacing: .03em; }
    .kpi-value { font-size: 1.4rem; font-weight: 700; color: var(--text); margin: 2px 0; line-height: 1.2; }
    .kpi-sub { font-size: 0.78rem; color: var(--text-secondary); }
    .trend-up   { color: var(--success); margin-left: 4px; }
    .trend-down { color: var(--danger);  margin-left: 4px; }

    /* Mid grid */
    .mid-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem; }
    @media (max-width: 768px) { .mid-grid { grid-template-columns: 1fr; } }

    .panel {
      padding: 1.1rem 1.25rem; border: 1px solid var(--border);
      border-radius: 10px; background: var(--bg-card);
    }
    .panel-title { margin: 0 0 1rem; font-size: 0.9rem; font-weight: 600; color: var(--text); }
    .panel-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
    .view-all { font-size: 0.8rem; color: var(--primary); text-decoration: none; }
    .view-all:hover { text-decoration: underline; }

    /* Error state */
    .error-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 0.75rem; padding: 4rem 2rem; text-align: center;
    }
    .error-state p { margin: 0; color: var(--text); font-size: 1rem; font-weight: 500; }
    .error-hint { color: var(--text-secondary) !important; font-size: 0.85rem !important; font-weight: 400 !important; }
    .error-icon { color: var(--danger); }
    .btn-retry {
      margin-top: 0.5rem; padding: 8px 20px; background: var(--primary); color: white;
      border: none; border-radius: 6px; font-size: 0.85rem; cursor: pointer;
    }
    .btn-retry:hover { background: var(--primary-dark); }

    /* Status list */
    .status-list { display: flex; flex-direction: column; gap: 0.6rem; }
    .status-row { display: flex; align-items: center; gap: 0.6rem; }
    .status-info { display: flex; align-items: center; gap: 0.4rem; min-width: 130px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .status-label { font-size: 0.8rem; color: var(--text); }
    .status-bar-wrap { flex: 1; height: 6px; background: var(--bg-secondary); border-radius: 3px; overflow: hidden; }
    .status-bar { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
    .status-count { font-size: 0.8rem; font-weight: 600; color: var(--text); min-width: 24px; text-align: right; }

    /* Catalog stats */
    .catalog-stats { display: flex; gap: 1.5rem; margin-bottom: 1rem; }
    .catalog-stat { display: flex; flex-direction: column; }
    .cs-value { font-size: 1.5rem; font-weight: 700; color: var(--text); }
    .cs-label { font-size: 0.75rem; color: var(--text-secondary); }

    /* Quick links */
    .quick-links { display: flex; flex-direction: column; gap: 0.4rem; }
    .quick-link {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.82rem; color: var(--text-secondary); text-decoration: none;
      padding: 0.4rem 0.5rem; border-radius: 6px; transition: background 0.12s;
      background: none; border: none; cursor: pointer; text-align: left; width: 100%;
    }
    .quick-link:hover { background: var(--bg-secondary); color: var(--primary); }
    .export-link { color: var(--primary); }

    /* Three-col grid */
    .three-col { grid-template-columns: 1fr 1fr 1fr; }
    @media (max-width: 900px) { .three-col { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 600px) { .three-col { grid-template-columns: 1fr; } }

    /* Sparkline */
    .sparkline { width: 100%; height: 60px; display: block; margin-bottom: 4px; }
    .spark-labels {
      display: flex; justify-content: space-between;
      font-size: 0.68rem; color: var(--text-secondary);
    }

    /* Low-stock alert */
    .alert-panel { border-color: var(--danger-border); background: var(--danger-bg); }
    .badge-red {
      background: var(--danger-bg); color: var(--danger); font-size: 0.72rem;
      font-weight: 700; padding: 2px 8px; border-radius: 12px;
      border: 1px solid var(--danger-border);
    }
    .alert-hint { font-size: 0.82rem; color: var(--danger); margin: 0; }
    .empty-hint  { font-size: 0.82rem; color: var(--success); margin: 0; }

    /* Orders table */
    .orders-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .orders-table thead th {
      padding: 0.5rem 0.75rem; text-align: left;
      font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);
      text-transform: uppercase; border-bottom: 1px solid var(--border);
    }
    .orders-table tbody td {
      padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--border);
    }
    .orders-table tbody tr:last-child td { border-bottom: none; }
    .order-id { font-family: monospace; font-weight: 600; color: var(--text); }
    .customer-cell { display: flex; flex-direction: column; }
    .customer-name { font-weight: 500; color: var(--text); }
    .customer-email { font-size: 0.75rem; color: var(--text-secondary); }
    .amount { font-weight: 600; color: var(--text); }
    .date { color: var(--text-secondary); white-space: nowrap; }

    /* Status badges — usan variables, dark mode automático */
    .status-badge {
      display: inline-block; font-size: 0.72rem; font-weight: 600;
      padding: 2px 8px; border-radius: 12px; border: 1px solid transparent;
    }
    .status-pending, .status-awaiting_payment {
      background: var(--warning-bg); color: var(--warning-text); border-color: var(--warning-border);
    }
    .status-paid      { background: var(--success-bg);    color: var(--success-text);  border-color: var(--success-border); }
    .status-preparing { background: var(--bg-secondary);  color: var(--primary);       border-color: var(--border); }
    .status-shipped   { background: var(--info-bg);       color: var(--info-text);     border-color: var(--info-border); }
    .status-delivered { background: var(--success-bg);    color: var(--success-text);  border-color: var(--success-border); }
    .status-cancelled { background: var(--danger-bg);     color: var(--danger-text);   border-color: var(--danger-border); }
    .status-refunded  { background: var(--bg-secondary);  color: var(--text-secondary); border-color: var(--border); }

    /* Sparkline */
    .spark-line { stroke: var(--primary); }
  `],
})
export class AdminDashboardComponent implements OnInit {
  private http = inject(HttpClient);

  stats: StatsResponse | null = null;
  stockAlerts: StockAlert[] = [];
  loading = true;
  error = false;
  readonly apiUrl = environment.apiUrl;

  dateFrom = '';
  dateTo = '';

  readonly statusList = [
    { key: 'PENDING',          label: 'Pendiente',     color: '#eab308' },
    { key: 'AWAITING_PAYMENT', label: 'Esp. pago',     color: '#f97316' },
    { key: 'PAID',             label: 'Pagado',        color: '#22c55e' },
    { key: 'PREPARING',        label: 'Preparando',    color: '#e020c8' },
    { key: 'SHIPPED',          label: 'Enviado',       color: '#8b5cf6' },
    { key: 'DELIVERED',        label: 'Entregado',     color: '#059669' },
    { key: 'CANCELLED',        label: 'Cancelado',     color: '#ef4444' },
    { key: 'REFUNDED',         label: 'Reembolsado',   color: '#9ca3af' },
  ];

  get revenueChange(): number | null {
    if (!this.stats || this.stats.lastMonthRevenue === 0) return null;
    return Math.round(((this.stats.monthRevenue - this.stats.lastMonthRevenue) / this.stats.lastMonthRevenue) * 100);
  }

  get absRevenueChange(): number {
    return Math.abs(this.revenueChange ?? 0);
  }

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.error = false;
    let params = new HttpParams();
    if (this.dateFrom) params = params.set('from', this.dateFrom);
    if (this.dateTo)   params = params.set('to',   this.dateTo);
    this.http.get<StatsResponse>(`${environment.apiUrl}/admin/stats`, { params }).subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
        if (data.lowStockCount > 0) this.loadStockAlerts();
      },
      error: () => { this.loading = false; this.error = true; },
    });
  }

  loadStockAlerts(): void {
    this.http.get<StockAlert[]>(`${environment.apiUrl}/admin/stats/stock-alerts`).subscribe({
      next: (data) => this.stockAlerts = data,
      error: () => {},
    });
  }

  clearDateFilter(): void {
    this.dateFrom = '';
    this.dateTo = '';
    this.loadStats();
  }

  downloadCsv(filename: string, url: string): void {
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      },
      error: () => alert('No se pudo descargar el archivo. Verificá que tenés permisos de administrador.'),
    });
  }

  getStatusCount(key: string): number {
    return this.stats?.ordersByStatus?.[key] ?? 0;
  }

  getStatusPct(key: string): number {
    const total = this.stats?.totalOrders ?? 1;
    return total === 0 ? 0 : Math.round((this.getStatusCount(key) / total) * 100);
  }

  statusLabel(status: string): string {
    return this.statusList.find(s => s.key === status.toUpperCase())?.label ?? status;
  }

  /** Compute SVG polyline points for the daily-revenue sparkline (280×60 viewBox). */
  get sparklinePoints(): string {
    const pts = this.stats?.dailyRevenue ?? [];
    if (pts.length < 2) return '';
    const maxVal = Math.max(...pts.map(p => p.total), 1);
    const w = 280; const h = 56; const pad = 2;
    return pts.map((p, i) => {
      const x = pad + (i / (pts.length - 1)) * (w - pad * 2);
      const y = h - pad - (p.total / maxVal) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  /** Filled area below the sparkline. */
  get sparklineAreaPoints(): string {
    const pts = this.stats?.dailyRevenue ?? [];
    if (pts.length < 2) return '';
    const maxVal = Math.max(...pts.map(p => p.total), 1);
    const w = 280; const h = 56; const pad = 2;
    const line = pts.map((p, i) => {
      const x = pad + (i / (pts.length - 1)) * (w - pad * 2);
      const y = h - pad - (p.total / maxVal) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const firstX = pad.toFixed(1);
    const lastX  = (w - pad).toFixed(1);
    return [...line, `${lastX},${(h - pad).toFixed(1)}`, `${firstX},${(h - pad).toFixed(1)}`].join(' ');
  }

  /** Short day label: Mon, Tue… */
  formatSparkLabel(day: string): string {
    const d = new Date(day + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { weekday: 'short' });
  }
}
