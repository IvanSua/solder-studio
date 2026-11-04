import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';
import { ToastService } from '@core/services/toast.service';

interface GiftCard {
  id: number;
  code: string;
  initialAmount: number;
  remainingAmount: number;
  currencyCode: string;
  purchasedByUserId: number | null;
  redeemedByUserId: number | null;
  expiresAt: string;
  active: boolean;
  expired: boolean;
  usable: boolean;
  createdAt: string;
  redeemedAt: string | null;
}

interface GiftCardStats {
  totalCards: number;
  totalValue: number;
}

@Component({
  selector: 'app-admin-gift-cards',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <h2>🎁 Gift Cards</h2>
          <span class="count-badge">{{ totalCards() }}</span>
        </div>
        <button class="btn-primary" (click)="showCreateForm.set(true)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Crear Gift Card
        </button>
      </div>

      <!-- Create Form Modal -->
      @if (showCreateForm()) {
        <div class="modal-overlay" (click)="showCreateForm.set(false)">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Crear Gift Card manualmente</h3>
              <button class="modal-close" (click)="showCreateForm.set(false)">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label for="createAmount">Monto (ARS)</label>
                <input
                  type="number"
                  id="createAmount"
                  [(ngModel)]="createAmount"
                  min="100"
                  max="50000"
                  placeholder="100 - 50.000" />
              </div>
              <div class="form-group">
                <label for="createUserId">ID de Usuario (opcional)</label>
                <input
                  type="number"
                  id="createUserId"
                  [(ngModel)]="createUserId"
                  placeholder="Dejar vacío para crear sin asignar" />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" (click)="showCreateForm.set(false)">Cancelar</button>
              <button 
                class="btn-primary" 
                (click)="createGiftCard()"
                [disabled]="creating() || !createAmount">
                @if (creating()) {
                  <span class="spinner-sm"></span>
                  Creando...
                } @else {
                  Crear Gift Card
                }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🎁</div>
          <div class="stat-content">
            <span class="stat-value">{{ totalCards() }}</span>
            <span class="stat-label">Total de Gift Cards</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-content">
            <span class="stat-value">{{ formatCurrency(stats()?.totalValue || 0) }}</span>
            <span class="stat-label">Valor total pendiente</span>
          </div>
        </div>
      </div>

      @if (errorMessage()) {
        <div class="alert-error">{{ errorMessage() }}</div>
      }

      <!-- Table -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Valor inicial</th>
              <th>Saldo restante</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>Comprador</th>
              <th>Canjeada por</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              @for (i of [1,2,3,4,5]; track i) {
                <tr class="skeleton-row">
                  <td><div class="skel w-24"></div></td>
                  <td><div class="skel w-20"></div></td>
                  <td><div class="skel w-20"></div></td>
                  <td><div class="skel w-24"></div></td>
                  <td><div class="skel w-16"></div></td>
                  <td><div class="skel w-24"></div></td>
                  <td><div class="skel w-24"></div></td>
                  <td><div class="skel w-16"></div></td>
                </tr>
              }
            } @else if (giftCards.length === 0) {
              <tr><td colspan="8" class="empty-cell">
                <div class="empty-state">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                  </svg>
                  <p>No hay Gift Cards aún.</p>
                </div>
              </td></tr>
            }
            @for (card of giftCards; track card.id) {
              <tr>
                <td>
                  <code class="gift-card-code">{{ card.code }}</code>
                </td>
                <td class="amount-cell">
                  {{ formatCurrency(card.initialAmount) }}
                </td>
                <td class="amount-cell" [class.low-balance]="card.remainingAmount < card.initialAmount">
                  {{ formatCurrency(card.remainingAmount) }}
                </td>
                <td class="date-cell">
                  {{ card.expiresAt | date: 'dd/MM/yyyy' }}
                </td>
                <td>
                  <span class="status-badge" [class]="getStatusClass(card)">
                    {{ getStatusText(card) }}
                  </span>
                </td>
                <td class="user-cell">
                  @if (card.purchasedByUserId) {
                    <span class="user-id">#{{ card.purchasedByUserId }}</span>
                  } @else {
                    <span class="text-muted">—</span>
                  }
                </td>
                <td class="user-cell">
                  @if (card.redeemedByUserId) {
                    <span class="user-id">#{{ card.redeemedByUserId }}</span>
                  } @else {
                    <span class="text-muted">—</span>
                  }
                </td>
                <td>
                  @if (card.active && !card.expired) {
                    <button 
                      class="btn-danger btn-sm"
                      (click)="deactivateCard(card)"
                      [disabled]="deactivating() === card.id">
                      @if (deactivating() === card.id) {
                        <span class="spinner-sm"></span>
                      } @else {
                        Desactivar
                      }
                    </button>
                  } @else {
                    <span class="text-muted">—</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      @if (totalPages() > 1) {
        <div class="pagination">
          <button (click)="goToPage(currentPage() - 1)" [disabled]="currentPage() === 0">
            ← Anterior
          </button>
          <span class="page-info">Página {{ currentPage() + 1 }} de {{ totalPages() }}</span>
          <button (click)="goToPage(currentPage() + 1)" [disabled]="currentPage() >= totalPages() - 1">
            Siguiente →
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

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .header-left h2 { margin: 0; }
    .count-badge {
      background: var(--bg-secondary);
      color: var(--text-secondary);
      font-size: 0.875rem;
      font-weight: 600;
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--overlay);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal {
      background: var(--bg-card);
      border-radius: 16px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    .modal-header h3 { margin: 0; font-size: 1.1rem; font-weight: 600; }
    .modal-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    .modal-close:hover { color: var(--text); }
    .modal-body { padding: 1.5rem; }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border);
    }
    .form-group { margin-bottom: 1rem; }
    .form-group:last-child { margin-bottom: 0; }
    .form-group label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text);
      margin-bottom: 0.375rem;
    }
    .form-group input {
      width: 100%;
      padding: 0.625rem 0.875rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.9rem;
    }
    .form-group input:focus {
      outline: none;
      border-color: var(--info);
    }

    .btn-primary {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      background: var(--info);
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-primary:hover:not(:disabled) { background: var(--info-text); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      padding: 0.625rem 1.25rem;
      background: var(--bg-card);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-weight: 500;
      font-size: 0.9rem;
      cursor: pointer;
    }
    .btn-secondary:hover { background: var(--bg-secondary); }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .stat-icon {
      font-size: 2rem;
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, var(--info) 0%, var(--info-text) 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stat-content {
      display: flex;
      flex-direction: column;
    }
    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text);
    }
    .stat-label {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .table-wrap {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: var(--bg-secondary);
      padding: 0.875rem 1rem;
      text-align: left;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 1rem;
      border-bottom: 1px solid var(--border);
      font-size: 0.875rem;
    }
    tr:last-child td {
      border-bottom: none;
    }
    tr:hover {
      background: var(--bg-secondary);
    }

    .gift-card-code {
      background: var(--bg-secondary);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--info);
      letter-spacing: 1px;
    }
    .amount-cell {
      font-weight: 600;
    }
    .amount-cell.low-balance {
      color: var(--warning);
    }
    .date-cell {
      color: var(--text-secondary);
      white-space: nowrap;
    }
    .user-cell {
      color: var(--text-secondary);
    }
    .user-id {
      font-family: monospace;
      background: var(--bg-secondary);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
    }
    .text-muted {
      color: var(--text-secondary);
    }

    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.625rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .status-badge.active {
      background: var(--success-bg);
      color: var(--success);
    }
    .status-badge.expired {
      background: var(--danger-bg);
      color: var(--danger);
    }
    .status-badge.used {
      background: var(--warning-bg);
      color: var(--warning);
    }
    .status-badge.inactive {
      background: var(--bg-secondary);
      color: var(--text-secondary);
    }

    .btn-danger {
      padding: 0.375rem 0.75rem;
      background: var(--danger-bg);
      color: var(--danger);
      border: 1px solid var(--danger-border);
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-danger:hover:not(:disabled) {
      background: var(--danger);
      color: white;
      border-color: var(--danger);
    }
    .btn-danger:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      margin-top: 1.5rem;
    }
    .pagination button {
      padding: 0.5rem 1rem;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .pagination button:hover:not(:disabled) {
      background: var(--bg-secondary);
    }
    .pagination button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .page-info {
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    .spinner-sm {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: currentColor;
      border-radius: 50%;
    }

    .empty-cell {
      padding: 3rem !important;
      text-align: center;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      color: var(--text-secondary);
    }
    .empty-state p {
      margin: 0;
      color: var(--text-secondary);
    }

    .skeleton-row td {
      padding: 1rem;
    }
    .skel {
      height: 16px;
      background: var(--bg-secondary);
      border-radius: 4px;
    }
    .w-16 { width: 80px; }
    .w-20 { width: 100px; }
    .w-24 { width: 120px; }
  `],
})
export class AdminGiftCardsComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private readonly apiUrl = environment.apiUrl;

  giftCards: GiftCard[] = [];
  stats = signal<GiftCardStats | null>(null);
  loading = signal(true);
  errorMessage = signal('');
  deactivating = signal<number | null>(null);
  showCreateForm = signal(false);
  creating = signal(false);
  createAmount: number | null = null;
  createUserId: number | null = null;

  currentPage = signal(0);
  totalPages = signal(0);
  totalCards = signal(0);

  ngOnInit(): void {
    this.loadGiftCards();
    this.loadStats();
  }

  createGiftCard(): void {
    if (!this.createAmount || this.createAmount < 100 || this.createAmount > 50000) {
      this.toast.error('El monto debe ser entre $100 y $50.000');
      return;
    }

    this.creating.set(true);
    const request = { amount: this.createAmount };

    let endpoint = `${this.apiUrl}/admin/gift-cards`;
    if (this.createUserId) {
      endpoint += `?userId=${this.createUserId}`;
    }

    this.http.post<GiftCard>(endpoint, request).subscribe({
      next: (card) => {
        this.creating.set(false);
        this.showCreateForm.set(false);
        this.createAmount = null;
        this.createUserId = null;
        this.giftCards = [card, ...this.giftCards];
        this.totalCards.update(t => t + 1);
        this.loadStats();
        this.toast.success(`Gift Card ${card.code} creada`);
      },
      error: (err) => {
        this.creating.set(false);
        this.toast.error(err.error?.error || 'Error al crear Gift Card');
      },
    });
  }

  private loadGiftCards(): void {
    this.loading.set(true);
    const params = new HttpParams()
      .set('page', this.currentPage())
      .set('size', 20)
      .set('sort', 'createdAt,desc');

    this.http.get<{ content: GiftCard[]; totalElements: number; totalPages: number }>(
      `${this.apiUrl}/admin/gift-cards`, { params }
    ).subscribe({
      next: (page) => {
        this.giftCards = page.content;
        this.totalCards.set(page.totalElements);
        this.totalPages.set(page.totalPages);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.error || 'Error al cargar Gift Cards');
      },
    });
  }

  private loadStats(): void {
    this.http.get<GiftCardStats>(`${this.apiUrl}/admin/gift-cards/stats`).subscribe({
      next: (stats) => this.stats.set(stats),
      error: () => {},
    });
  }

  deactivateCard(card: GiftCard): void {
    if (!confirm(`¿Desactivar la Gift Card ${card.code}?`)) return;

    this.deactivating.set(card.id);
    this.http.put<GiftCard>(`${this.apiUrl}/admin/gift-cards/${card.id}/deactivate`, {}).subscribe({
      next: (updated) => {
        this.deactivating.set(null);
        // Update in list
        const idx = this.giftCards.findIndex(g => g.id === updated.id);
        if (idx !== -1) {
          this.giftCards[idx] = updated;
          this.giftCards = [...this.giftCards];
        }
        this.loadStats();
        this.toast.success('Gift Card desactivada');
      },
      error: (err) => {
        this.deactivating.set(null);
        this.toast.error(err.error?.error || 'Error al desactivar');
      },
    });
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.currentPage.set(page);
    this.loadGiftCards();
  }

  getStatusClass(card: GiftCard): string {
    if (!card.active) return 'inactive';
    if (card.expired) return 'expired';
    if (!card.usable) return 'used';
    return 'active';
  }

  getStatusText(card: GiftCard): string {
    if (!card.active) return 'Inactiva';
    if (card.expired) return 'Expirada';
    if (!card.usable) return 'Canjeada';
    return 'Activa';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  }
}
