import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WishlistService } from '@core/services/wishlist.service';
import { Product } from '@core/models/product.model';
import { PricePipe } from '@shared/pipes/price.pipe';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, RouterLink, PricePipe],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Lista de favoritos</h1>
        <span class="count">{{ products().length }} producto{{ products().length !== 1 ? 's' : '' }}</span>
      </div>

      @if (loading()) {
        <div class="state">
          <div class="spinner"></div>
          <p>Cargando favoritos...</p>
        </div>
      } @else if (products().length === 0) {
        <div class="empty">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <h2>Tu lista está vacía</h2>
          <p>Guardá los productos que te gusten para comprarlos después.</p>
          <a routerLink="/" class="btn-primary">Explorar catálogo</a>
        </div>
      } @else {
        <div class="product-grid">
          @for (p of products(); track p.id) {
            <div class="product-card">
              <a [routerLink]="['/product', p.slug]" class="card-image">
                @if (p.images.length > 0) {
                  <img [src]="p.images[0].imageUrl" [alt]="p.name" loading="lazy" />
                } @else {
                  <div class="img-placeholder">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                }
              </a>
              <div class="card-body">
                <a [routerLink]="['/product', p.slug]" class="card-name">{{ p.name }}</a>
                @if (p.variants.length > 0) {
                  <p class="card-price">{{ p.variants[0].priceAmount | price }}</p>
                }
                <button class="btn-remove" (click)="remove(p)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  Quitar de favoritos
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 1200px; margin: 0 auto; padding: 2rem 1.25rem; }
    .page-header { display: flex; align-items: baseline; gap: 1rem; margin-bottom: 2rem; }
    h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
    .count { color: var(--text-secondary); font-size: 0.9rem; }

    .state { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 4rem; color: var(--text-secondary); }
    .spinner { width: 32px; height: 32px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 4rem; text-align: center; }
    .empty h2 { font-size: 1.2rem; font-weight: 600; margin: 0; }
    .empty p { color: var(--text-secondary); margin: 0; }
    .btn-primary { padding: 0.65rem 1.5rem; background: var(--primary); color: white; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem; }

    .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.25rem; }

    .product-card { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
    .card-image { display: block; aspect-ratio: 1; overflow: hidden; background: var(--bg-secondary); }
    .card-image img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s; }
    .card-image:hover img { transform: scale(1.04); }
    .img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }

    .card-body { padding: 0.85rem; flex: 1; display: flex; flex-direction: column; gap: 0.4rem; }
    .card-name { font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--text); line-height: 1.3; }
    .card-name:hover { color: var(--primary); }
    .card-price { font-size: 0.95rem; font-weight: 700; color: var(--primary); margin: 0; }
    .btn-remove {
      margin-top: auto; display: flex; align-items: center; gap: 0.35rem;
      padding: 0.4rem 0; background: none; border: none; cursor: pointer;
      font-size: 0.78rem; color: var(--danger); font-weight: 500;
    }
    .btn-remove:hover { text-decoration: underline; }
  `],
})
export class WishlistComponent implements OnInit {
  private wishlistService = inject(WishlistService);

  products = signal<Product[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.wishlistService.getWishlist().subscribe({
      next: products => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  remove(product: Product): void {
    this.wishlistService.toggle(product.id).subscribe({
      next: () => {
        this.products.update(list => list.filter(p => p.id !== product.id));
      },
    });
  }
}
