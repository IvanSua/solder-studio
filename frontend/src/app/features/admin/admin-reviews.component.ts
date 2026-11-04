import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReviewService, ProductReview } from '@core/services/review.service';

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Moderación de Reseñas</h1>
          <p class="subtitle">Aprobá o rechazá reseñas antes de que sean públicas</p>
        </div>
      </div>

      <div class="tabs">
        <button class="tab" [class.active]="activeTab() === 'PENDING'" (click)="switchTab('PENDING')">
          Pendientes
        </button>
        <button class="tab" [class.active]="activeTab() === 'APPROVED'" (click)="switchTab('APPROVED')">
          Aprobadas
        </button>
        <button class="tab" [class.active]="activeTab() === 'REJECTED'" (click)="switchTab('REJECTED')">
          Rechazadas
        </button>
      </div>

      @if (loading()) {
        <div class="loading">Cargando reseñas...</div>
      } @else if (reviews().length === 0) {
        <div class="empty">No hay reseñas en este estado.</div>
      } @else {
        <div class="table-wrap">
          <table class="reviews-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Autor</th>
                <th>Rating</th>
                <th>Título</th>
                <th>Contenido</th>
                <th>Verificado</th>
                <th>Fecha</th>
                @if (activeTab() === 'PENDING') {
                  <th>Acciones</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (review of reviews(); track review.id) {
                <tr>
                  <td class="slug-cell">{{ review.productSlug }}</td>
                  <td>{{ review.authorName }}</td>
                  <td class="rating">{{ starsText(review.rating) }}</td>
                  <td>{{ review.title || '—' }}</td>
                  <td class="body-cell">{{ truncate(review.body, 80) }}</td>
                  <td>
                    <span [class]="review.verifiedPurchase ? 'badge-yes' : 'badge-no'">
                      {{ review.verifiedPurchase ? 'Sí' : 'No' }}
                    </span>
                  </td>
                  <td class="date">{{ review.createdAt | date:'dd/MM/yy' }}</td>
                  @if (activeTab() === 'PENDING') {
                    <td class="actions">
                      <button class="btn-approve" (click)="approve(review.id)" [disabled]="processingId() === review.id">
                        Aprobar
                      </button>
                      <button class="btn-reject" (click)="reject(review.id)" [disabled]="processingId() === review.id">
                        Rechazar
                      </button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (totalPages() > 1 || reviews().length > 0) {
          <div class="pagination-bar">
            <div class="page-size-btns">
              <span style="font-size:0.78rem;color:var(--text-secondary);margin-right:4px">Mostrar:</span>
              @for (n of [5,10,15,20]; track n) {
                <button class="size-btn" [class.active]="pageSize() === n" (click)="changePageSize(n)">{{ n }}</button>
              }
            </div>
            <div class="page-controls">
              <button class="btn-page" (click)="prevPage()" [disabled]="currentPage() === 0">← Anterior</button>
              <span class="page-info">Página {{ currentPage()+1 }} de {{ totalPages() }} ({{ totalElements() }} total)</span>
              <button class="btn-page" (click)="nextPage()" [disabled]="currentPage() >= totalPages()-1">Siguiente →</button>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .page { padding: 1.5rem; }
    .page-header { margin-bottom: 1.25rem; }
    .page-header h1 { margin: 0 0 4px; font-size: 1.4rem; color: var(--text); }
    .subtitle { margin: 0; font-size: 0.85rem; color: var(--text-secondary); }

    .tabs { display: flex; gap: 0; border-bottom: 2px solid var(--border); margin-bottom: 1.5rem; }
    .tab {
      padding: 0.55rem 1.25rem; border: none; background: none; cursor: pointer;
      font-size: 0.875rem; color: var(--text-secondary);
      border-bottom: 2px solid transparent; margin-bottom: -2px;
      transition: color 0.15s, border-color 0.15s;
    }
    .tab.active { color: var(--text); border-bottom-color: var(--text); font-weight: 600; }
    .tab:hover:not(.active) { color: var(--text); }

    .loading, .empty { padding: 3rem; text-align: center; color: var(--text-secondary); }

    .table-wrap { overflow-x: auto; }
    .reviews-table {
      width: 100%; border-collapse: collapse; font-size: 0.875rem;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden;
    }
    .reviews-table thead th {
      padding: 0.65rem 1rem; text-align: left;
      font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);
      text-transform: uppercase; letter-spacing: 0.04em;
      background: var(--bg-secondary); border-bottom: 1px solid var(--border);
    }
    .reviews-table tbody td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
    .reviews-table tbody tr:last-child td { border-bottom: none; }
    .reviews-table tbody tr:hover { background: var(--bg-secondary); }

    .slug-cell { font-family: monospace; font-size: 0.8rem; color: var(--text-secondary); }
    .rating { font-size: 1rem; letter-spacing: 0.05em; }
    .body-cell { max-width: 200px; color: var(--text-secondary); font-size: 0.83rem; }
    .date { white-space: nowrap; color: var(--text-secondary); font-size: 0.8rem; }

    .badge-yes { background: var(--success-bg); color: var(--success-text); padding: 2px 8px; border-radius: 10px; font-size: 0.72rem; font-weight: 700; }
    .badge-no  { background: var(--bg-secondary); color: var(--text-secondary); padding: 2px 8px; border-radius: 10px; font-size: 0.72rem; font-weight: 700; }

    .actions { display: flex; gap: 0.4rem; }
    .btn-approve, .btn-reject {
      padding: 0.3rem 0.75rem; border: none; border-radius: 6px;
      font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
    }
    .btn-approve { background: var(--success-bg); color: var(--success-text); }
    .btn-approve:hover:not(:disabled) { background: var(--success-bg); }
    .btn-reject  { background: var(--danger-bg); color: var(--danger); }
    .btn-reject:hover:not(:disabled)  { background: var(--danger-bg); }
    .btn-approve:disabled, .btn-reject:disabled { opacity: 0.5; cursor: not-allowed; }

    .pagination-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.85rem 1rem; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: 10px; margin-top: 1rem;
    }
    .page-size-btns { display: flex; gap: 0.4rem; align-items: center; }
    .size-btn {
      padding: 0.3rem 0.65rem; border: 1px solid var(--border);
      background: var(--bg-secondary); color: var(--text-secondary);
      border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer;
    }
    .size-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
    .page-controls { display: flex; align-items: center; gap: 0.75rem; }
    .page-info { font-size: 0.82rem; color: var(--text-secondary); }
    .btn-page {
      padding: 0.3rem 0.65rem; border: 1px solid var(--border);
      background: var(--bg-secondary); color: var(--text);
      border-radius: 6px; font-size: 0.78rem; cursor: pointer;
    }
    .btn-page:disabled { opacity: 0.4; cursor: not-allowed; }
  `],
})
export class AdminReviewsComponent implements OnInit {
  private reviewService = inject(ReviewService);

  reviews       = signal<ProductReview[]>([]);
  activeTab     = signal<Tab>('PENDING');
  loading       = signal(false);
  processingId  = signal<number | null>(null);
  currentPage   = signal(0);
  pageSize      = signal(20);
  totalElements = signal(0);
  totalPages    = signal(0);

  ngOnInit(): void {
    this.loadReviews();
  }

  switchTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.currentPage.set(0);
    this.loadReviews();
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages() - 1) {
      this.currentPage.update(p => p + 1);
      this.loadReviews();
    }
  }

  prevPage(): void {
    if (this.currentPage() > 0) {
      this.currentPage.update(p => p - 1);
      this.loadReviews();
    }
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(0);
    this.loadReviews();
  }

  approve(id: number): void {
    this.processingId.set(id);
    this.reviewService.approveReview(id).subscribe({
      next: () => {
        this.reviews.update(list => list.filter(r => r.id !== id));
        this.processingId.set(null);
      },
      error: () => this.processingId.set(null),
    });
  }

  reject(id: number): void {
    this.processingId.set(id);
    this.reviewService.rejectReview(id).subscribe({
      next: () => {
        this.reviews.update(list => list.filter(r => r.id !== id));
        this.processingId.set(null);
      },
      error: () => this.processingId.set(null),
    });
  }

  starsText(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  truncate(text: string | null, max: number): string {
    if (!text) return '—';
    return text.length > max ? text.slice(0, max) + '...' : text;
  }

  private loadReviews(): void {
    this.loading.set(true);
    this.reviewService.getAdminReviews(this.activeTab(), this.currentPage(), this.pageSize()).subscribe({
      next: page => {
        this.reviews.set(page.content);
        this.totalElements.set(page.totalElements);
        this.totalPages.set(page.totalPages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
