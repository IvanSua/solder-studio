import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SeoService } from '@core/services/seo.service';
import { Product } from '@core/models/product.model';

const STORAGE_KEY = 'compare_products';

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="compare-page">
      <div class="compare-container">
        <div class="compare-header">
          <h1>Comparar Productos</h1>
          @if (products().length > 0) {
            <button class="btn-clear" (click)="clearAll()">
              Limpiar todo
            </button>
          }
        </div>

        @if (products().length === 0) {
          <div class="empty-state">
            <div class="empty-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
              </svg>
            </div>
            <h2>No hay productos para comparar</h2>
            <p>Agrega productos desde el catálogo para poder compararlos.</p>
            <a routerLink="/" class="btn-primary">Ir al catálogo</a>
          </div>
        } @else {
          <div class="compare-table-wrapper">
            <table class="compare-table">
              <!-- Product Images Row -->
              <tr class="image-row">
                <td class="label-cell"></td>
                @for (product of products(); track product.id) {
                  <td class="product-cell">
                    <button class="remove-btn" (click)="removeProduct(product.id)" title="Quitar">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                    <div class="product-image">
                      @if (getPrimaryImage(product); as img) {
                        <img [src]="img.imageUrl" [alt]="product.name" loading="lazy" />
                      } @else {
                        <div class="no-image">Sin imagen</div>
                      }
                    </div>
                  </td>
                }
                @if (products().length < 3) {
                  @for (i of emptySlots(); track i) {
                    <td class="product-cell empty-slot">
                      <div class="empty-slot-content">
                        <span>Vacío</span>
                      </div>
                    </td>
                  }
                }
              </tr>

              <!-- Product Name Row -->
              <tr class="name-row">
                <td class="label-cell">Producto</td>
                @for (product of products(); track product.id) {
                  <td class="product-cell">
                    <a [routerLink]="['/product', product.slug]" class="product-name">
                      {{ product.name }}
                    </a>
                    @if (product.categoryName) {
                      <span class="category">{{ product.categoryName }}</span>
                    }
                  </td>
                }
                @if (products().length < 3) {
                  @for (i of emptySlots(); track i) {
                    <td class="product-cell empty-slot"></td>
                  }
                }
              </tr>

              <!-- Price Row -->
              <tr class="price-row">
                <td class="label-cell">Precio</td>
                @for (product of products(); track product.id) {
                  <td class="product-cell">
                    <span class="price">
                      {{ formatPrice(getMinPrice(product), getCurrency(product)) }}
                    </span>
                    @if (hasPriceRange(product)) {
                      <span class="price-range">
                        - {{ formatPrice(getMaxPrice(product), getCurrency(product)) }}
                      </span>
                    }
                  </td>
                }
                @if (products().length < 3) {
                  @for (i of emptySlots(); track i) {
                    <td class="product-cell empty-slot"></td>
                  }
                }
              </tr>

              <!-- Stock Row -->
              <tr class="stock-row">
                <td class="label-cell">Disponibilidad</td>
                @for (product of products(); track product.id) {
                  <td class="product-cell">
                    @if (isInStock(product)) {
                      <span class="stock in-stock">En stock</span>
                    } @else {
                      <span class="stock out-of-stock">Sin stock</span>
                    }
                  </td>
                }
                @if (products().length < 3) {
                  @for (i of emptySlots(); track i) {
                    <td class="product-cell empty-slot"></td>
                  }
                }
              </tr>

              <!-- Sizes Row -->
              <tr class="sizes-row">
                <td class="label-cell">Talles</td>
                @for (product of products(); track product.id) {
                  <td class="product-cell">
                    <div class="sizes-list">
                      @for (size of getUniqueSizes(product); track size) {
                        <span class="size-badge" [class.out-of-stock]="!hasSizeInStock(product, size)">
                          {{ size }}
                        </span>
                      }
                    </div>
                  </td>
                }
                @if (products().length < 3) {
                  @for (i of emptySlots(); track i) {
                    <td class="product-cell empty-slot"></td>
                  }
                }
              </tr>

              <!-- Colors Row -->
              <tr class="colors-row">
                <td class="label-cell">Colores</td>
                @for (product of products(); track product.id) {
                  <td class="product-cell">
                    <div class="colors-list">
                      @for (color of getUniqueColors(product); track color) {
                        <span class="color-badge" [style.background-color]="color" [title]="color">
                        </span>
                      }
                    </div>
                  </td>
                }
                @if (products().length < 3) {
                  @for (i of emptySlots(); track i) {
                    <td class="product-cell empty-slot"></td>
                  }
                }
              </tr>

              <!-- Customizable Row -->
              <tr class="customizable-row">
                <td class="label-cell">Personalizable</td>
                @for (product of products(); track product.id) {
                  <td class="product-cell">
                    @if (product.customizable) {
                      <span class="badge customizable">Sí</span>
                    } @else {
                      <span class="badge not-customizable">No</span>
                    }
                  </td>
                }
                @if (products().length < 3) {
                  @for (i of emptySlots(); track i) {
                    <td class="product-cell empty-slot"></td>
                  }
                }
              </tr>

              <!-- Actions Row -->
              <tr class="actions-row">
                <td class="label-cell"></td>
                @for (product of products(); track product.id) {
                  <td class="product-cell">
                    <a [routerLink]="['/product', product.slug]" class="btn-details">
                      Ver detalles
                    </a>
                  </td>
                }
                @if (products().length < 3) {
                  @for (i of emptySlots(); track i) {
                    <td class="product-cell empty-slot"></td>
                  }
                }
              </tr>
            </table>
          </div>

          <div class="compare-actions">
            <a routerLink="/" class="btn-continue">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              Continuar comprando
            </a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .compare-page {
      min-height: 100vh;
      background: var(--bg-secondary);
      padding: 2rem 1rem;
    }

    .compare-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .compare-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .compare-header h1 {
      font-size: 1.75rem;
      font-weight: 600;
      color: var(--text);
      margin: 0;
    }

    .btn-clear {
      padding: 0.5rem 1rem;
      background: var(--danger-bg);
      color: var(--danger);
      border: none;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-clear:hover {
      background: var(--danger-border);
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      background: var(--bg-card);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .empty-icon {
      margin-bottom: 1.5rem;
      color: var(--text-muted);
    }

    .empty-state h2 {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text);
      margin: 0 0 0.5rem;
    }

    .empty-state p {
      color: var(--text-secondary);
      margin: 0 0 1.5rem;
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: var(--primary);
      color: white;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
      transition: background 0.2s;
    }

    .btn-primary:hover {
      background: var(--primary-dark);
    }

    /* Compare Table */
    .compare-table-wrapper {
      overflow-x: auto;
      background: var(--bg-card);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .compare-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 700px;
    }

    .compare-table tr {
      border-bottom: 1px solid var(--border);
    }

    .compare-table tr:last-child {
      border-bottom: none;
    }

    .label-cell {
      width: 140px;
      padding: 1rem;
      font-weight: 600;
      color: var(--text-secondary);
      background: var(--bg-secondary);
      vertical-align: middle;
      text-align: left;
    }

    .product-cell {
      padding: 1rem;
      vertical-align: middle;
      text-align: center;
      position: relative;
    }

    .product-cell.empty-slot {
      background: var(--bg-secondary);
    }

    .empty-slot-content {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 80px;
      color: var(--text-muted);
      font-style: italic;
    }

    /* Image Row */
    .image-row .product-cell {
      padding-top: 1.5rem;
      padding-bottom: 1rem;
    }

    .remove-btn {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background: var(--danger-bg);
      border: none;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--danger);
      transition: all 0.2s;
    }

    .remove-btn:hover {
      background: var(--danger-border);
      transform: scale(1.1);
    }

    .product-image {
      width: 160px;
      height: 160px;
      margin: 0 auto;
      border-radius: 8px;
      overflow: hidden;
      background: var(--bg-secondary);
    }

    .product-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .no-image {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    /* Name Row */
    .product-name {
      display: block;
      font-weight: 600;
      color: var(--text);
      text-decoration: none;
      margin-bottom: 0.25rem;
      transition: color 0.2s;
    }

    .product-name:hover {
      color: var(--primary);
    }

    .category {
      display: block;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    /* Price */
    .price {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text);
    }

    .price-range {
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    /* Stock */
    .stock {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .stock.in-stock {
      background: var(--success-bg);
      color: var(--success-text);
    }

    .stock.out-of-stock {
      background: var(--danger-bg);
      color: var(--danger-text);
    }

    /* Sizes */
    .sizes-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      justify-content: center;
    }

    .size-badge {
      padding: 0.25rem 0.5rem;
      background: var(--bg-secondary);
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .size-badge.out-of-stock {
      background: var(--danger-bg);
      color: var(--danger-text);
      text-decoration: line-through;
    }

    /* Colors */
    .colors-list {
      display: flex;
      gap: 0.375rem;
      justify-content: center;
    }

    .color-badge {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid var(--border);
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .badge.customizable {
      background: rgba(var(--primary-rgb, 224,32,200),0.12);
      color: var(--primary);
    }

    .badge.not-customizable {
      background: var(--bg-secondary);
      color: var(--text-secondary);
    }

    /* Actions */
    .btn-details {
      display: inline-block;
      padding: 0.5rem 1rem;
      background: var(--primary);
      color: white;
      border-radius: 6px;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: background 0.2s;
    }

    .btn-details:hover {
      background: var(--primary-dark);
    }

    /* Bottom Actions */
    .compare-actions {
      margin-top: 1.5rem;
    }

    .btn-continue {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: var(--bg-card);
      color: var(--text-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s;
    }

    .btn-continue:hover {
      background: var(--bg-secondary);
      border-color: var(--border);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .compare-page {
        padding: 1rem 0.5rem;
      }

      .compare-header h1 {
        font-size: 1.5rem;
      }

      .label-cell {
        width: 100px;
        padding: 0.75rem 0.5rem;
        font-size: 0.875rem;
      }

      .product-cell {
        padding: 0.75rem 0.5rem;
      }

      .product-image {
        width: 120px;
        height: 120px;
      }
    }
  `],
})
export class CompareComponent implements OnInit {
  private seo = inject(SeoService);
  private router = inject(Router);

  products = signal<Product[]>([]);

  emptySlots = computed(() => {
    return Array.from({ length: 3 - this.products().length }, (_, i) => i);
  });

  ngOnInit(): void {
    this.seo.set({
      title: 'Comparar Productos',
      description: 'Compará productos de Solder Studio. Analizá precios, talles, colores y más para tomar la mejor decisión de compra.',
      canonicalPath: '/compare',
    });

    // Load products from localStorage
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const _ids = JSON.parse(stored) as number[];
        // We need to load the actual products
        // For now, just store the IDs and let the catalog handle it
        // This is a simple implementation - could be enhanced with API calls
      }
    } catch (e) {
      console.error('Error loading compare list:', e);
    }
  }

  getPrimaryImage(product: Product): Product['images'][0] | null {
    return product.images.find(img => img.primary) ?? product.images[0] ?? null;
  }

  getMinPrice(product: Product): number {
    if (!product.variants.length) return 0;
    return Math.min(...product.variants.map(v => v.priceAmount));
  }

  getMaxPrice(product: Product): number {
    if (!product.variants.length) return 0;
    return Math.max(...product.variants.map(v => v.priceAmount));
  }

  hasPriceRange(product: Product): boolean {
    return this.getMinPrice(product) !== this.getMaxPrice(product);
  }

  getCurrency(product: Product): string {
    return product.variants[0]?.currencyCode ?? 'ARS';
  }

  formatPrice(amount: number, currency: string | undefined): string {
    if (currency === 'ARS') {
      return '$' + amount.toLocaleString('es-AR');
    }
    return amount.toLocaleString('es-AR', { style: 'currency', currency: currency ?? 'ARS' });
  }

  isInStock(product: Product): boolean {
    return product.variants.some(v => v.stockAvailable > 0);
  }

  getUniqueSizes(product: Product): string[] {
    return Array.from(new Set(product.variants.map(v => v.size).filter(Boolean)));
  }

  getUniqueColors(product: Product): string[] {
    return Array.from(new Set(product.variants.map(v => v.color).filter(Boolean)));
  }

  hasSizeInStock(product: Product, size: string): boolean {
    return product.variants.some(v => v.size === size && v.stockAvailable > 0);
  }

  removeProduct(productId: number): void {
    const current = this.products();
    this.products.set(current.filter(p => p.id !== productId));
    this.saveToStorage();
  }

  clearAll(): void {
    this.products.set([]);
    localStorage.removeItem(STORAGE_KEY);
    // Also clear in catalog component if it's loaded
    localStorage.removeItem('compare_products_catalog');
  }

  private saveToStorage(): void {
    try {
      const ids = this.products().map(p => p.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      // Also trigger catalog to update its list
      localStorage.setItem('compare_products_catalog', JSON.stringify(this.products()));
    } catch (e) {
      console.error('Error saving compare list:', e);
    }
  }
}
