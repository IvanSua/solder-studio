import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DesignService } from '@core/services/design.service';
import { ToastService } from '@core/services/toast.service';
import { CustomDesign } from '@core/models/design.model';

@Component({
  selector: 'app-designs',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="designs-page">
      <div class="page-header">
        <h1>Mis diseños guardados</h1>
        <p class="subtitle">Todos los diseños personalizados que creaste</p>
      </div>

      @if (loading()) {
        <div class="grid">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="design-card skeleton-card">
              <div class="skeleton-img"></div>
              <div class="skeleton-body">
                <div class="skel w-60"></div>
                <div class="skel w-40"></div>
                <div class="skel w-30"></div>
              </div>
            </div>
          }
        </div>
      } @else if (designs().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </div>
          <h2>Todavía no tenés diseños</h2>
          <p>Explorá el catálogo y personalizá los productos que tengan la opción de diseño.</p>
          <a routerLink="/" class="btn-primary">Ver productos</a>
        </div>
      } @else {
        <div class="grid">
          @for (design of designs(); track design.designId) {
            <div class="design-card" [class.draft]="design.status === 'draft'">
              <!-- Preview image -->
              <div class="card-image">
                @if (design.previewUrl) {
                  <img [src]="design.previewUrl" [alt]="'Diseño #' + design.designId" loading="lazy" />
                } @else if (design.productImageUrl) {
                  <img [src]="design.productImageUrl" [alt]="design.productName ?? ''" loading="lazy" />
                  <div class="no-preview-overlay">
                    <span>Vista previa no disponible</span>
                  </div>
                } @else {
                  <div class="image-placeholder">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                  </div>
                }
                <div class="status-pill" [attr.data-status]="design.status">
                  {{ statusLabel(design.status) }}
                </div>
              </div>

              <!-- Card body -->
              <div class="card-body">
                <div class="card-info">
                  @if (design.productName) {
                    <a
                      [routerLink]="design.productSlug ? ['/product', design.productSlug] : null"
                      class="product-name">
                      {{ design.productName }}
                    </a>
                  }
                  @if (design.variantColor || design.variantSize) {
                    <div class="variant-chips">
                      @if (design.variantColor) {
                        <span class="chip">{{ design.variantColor }}</span>
                      }
                      @if (design.variantSize) {
                        <span class="chip">Talle {{ design.variantSize }}</span>
                      }
                    </div>
                  }
                  @if (design.createdAt) {
                    <span class="date">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {{ design.createdAt | date: 'dd/MM/yyyy' }}
                    </span>
                  }
                </div>

                <div class="card-actions">
                  @if (design.status === 'saved' && design.variantId) {
                    <a
                      [routerLink]="['/customizer', design.variantId]"
                      class="action-btn edit">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      Editar
                    </a>
                  }
                  <button
                    class="action-btn delete"
                    (click)="confirmDelete(design)"
                    [disabled]="deletingId() === design.designId">
                    @if (deletingId() === design.designId) {
                      <span class="mini-spinner"></span>
                    } @else {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    }
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Delete confirmation modal -->
      @if (confirmingDelete()) {
        <div class="modal-backdrop" (click)="cancelDelete()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>¿Eliminar diseño?</h3>
            <p>Esta acción no se puede deshacer. El diseño será eliminado permanentemente.</p>
            <div class="modal-actions">
              <button class="btn-secondary" (click)="cancelDelete()">Cancelar</button>
              <button class="btn-danger" (click)="executeDelete()">Sí, eliminar</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .designs-page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    .page-header { margin-bottom: 2rem; }
    h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.35rem; }
    .subtitle { color: var(--text-muted); margin: 0; }

    /* Grid */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1.25rem;
    }

    /* Design card */
    .design-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      transition: box-shadow 0.2s, transform 0.2s;
    }
    .design-card:hover {
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      transform: translateY(-2px);
    }
    .design-card.draft { opacity: 0.8; }

    /* Card image */
    .card-image {
      position: relative;
      aspect-ratio: 1;
      background: var(--bg-secondary);
      overflow: hidden;
    }
    .card-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .image-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
    }
    .no-preview-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0,0,0,0.55);
      color: white;
      font-size: 0.7rem;
      text-align: center;
      padding: 0.4rem;
    }

    /* Status pill */
    .status-pill {
      position: absolute;
      top: 0.5rem;
      left: 0.5rem;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 3px 8px;
      border-radius: 20px;
    }
    .status-pill[data-status="saved"]   { background: var(--success-bg); color: var(--success-text); }
    .status-pill[data-status="draft"]   { background: var(--warning-bg); color: var(--warning-text); }
    .status-pill[data-status="ordered"] { background: rgba(var(--primary-rgb, 224,32,200),0.12); color: var(--primary); }

    /* Card body */
    .card-body {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
    }
    .card-info { display: flex; flex-direction: column; gap: 0.35rem; }
    .product-name {
      font-weight: 600;
      font-size: 0.9375rem;
      color: var(--text);
      text-decoration: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .product-name:hover { color: var(--primary); }
    .variant-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
    .chip {
      background: var(--bg-secondary);
      border-radius: 4px;
      font-size: 0.75rem;
      padding: 2px 8px;
      color: var(--text-muted);
    }
    .date {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.775rem;
      color: var(--text-muted);
    }

    /* Actions */
    .card-actions { display: flex; gap: 0.5rem; }
    .action-btn {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.45rem 0.875rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      border: 1px solid transparent;
      transition: all 0.15s;
    }
    .action-btn.edit {
      background: var(--bg-secondary);
      color: var(--text);
      border-color: var(--border);
      flex: 1;
      justify-content: center;
    }
    .action-btn.edit:hover { background: var(--border); }
    .action-btn.delete {
      background: none;
      color: var(--text-muted);
      border-color: var(--border);
      flex: 1;
      justify-content: center;
    }
    .action-btn.delete:hover:not(:disabled) { color: var(--danger); border-color: var(--danger-border); background: var(--danger-bg); }
    .action-btn.delete:disabled { opacity: 0.5; cursor: not-allowed; }
    .mini-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Empty state */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 5rem 2rem;
      text-align: center;
    }
    .empty-icon { color: var(--text-muted); opacity: 0.4; margin-bottom: 1.5rem; }
    .empty-state h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
    .empty-state p { color: var(--text-muted); margin-bottom: 1.5rem; max-width: 360px; }
    .btn-primary {
      padding: 0.75rem 2rem;
      background: var(--primary);
      color: white;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      transition: opacity 0.15s;
    }
    .btn-primary:hover { opacity: 0.9; }

    /* Skeleton */
    .skeleton-card { cursor: default; }
    .skeleton-img {
      aspect-ratio: 1;
      background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--border) 50%, var(--bg-secondary) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    .skeleton-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .skel {
      height: 12px;
      border-radius: 4px;
      background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--border) 50%, var(--bg-secondary) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    .w-60 { width: 60%; } .w-40 { width: 40%; } .w-30 { width: 30%; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Confirm modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .modal {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 1.75rem;
      max-width: 380px;
      width: 100%;
    }
    .modal h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
    .modal p { font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1.5rem; }
    .modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
    .btn-secondary {
      padding: 0.6rem 1.25rem;
      background: var(--bg-card);
      border: 1.5px solid var(--border);
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
    }
    .btn-secondary:hover { background: var(--bg-secondary); }
    .btn-danger {
      padding: 0.6rem 1.25rem;
      background: var(--danger);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }
    .btn-danger:hover { background: var(--danger-text); }
  `],
})
export class DesignsComponent implements OnInit {
  private designService = inject(DesignService);
  private toast = inject(ToastService);

  designs = signal<CustomDesign[]>([]);
  loading = signal(true);
  deletingId = signal<number | null>(null);
  confirmingDelete = signal(false);
  private pendingDeleteId: number | null = null;

  ngOnInit(): void {
    this.loadDesigns();
  }

  private loadDesigns(): void {
    this.loading.set(true);
    this.designService.list().subscribe({
      next: designs => {
        this.designs.set(designs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  confirmDelete(design: CustomDesign): void {
    this.pendingDeleteId = design.designId;
    this.confirmingDelete.set(true);
  }

  cancelDelete(): void {
    this.pendingDeleteId = null;
    this.confirmingDelete.set(false);
  }

  executeDelete(): void {
    const id = this.pendingDeleteId;
    if (!id) return;

    this.confirmingDelete.set(false);
    this.deletingId.set(id);

    this.designService.delete(id).subscribe({
      next: () => {
        this.designs.update(list => list.filter(d => d.designId !== id));
        this.deletingId.set(null);
        this.toast.success('Diseño eliminado correctamente');
      },
      error: () => {
        this.deletingId.set(null);
        this.toast.error('No se pudo eliminar el diseño. Intentá de nuevo.');
      },
    });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      draft: 'Borrador',
      saved: 'Guardado',
      ordered: 'Pedido',
    };
    return map[status] ?? status;
  }
}
