import {
  Component, OnInit, DestroyRef, inject, signal, computed,
  ChangeDetectionStrategy, PLATFORM_ID,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ProductService, FilterOptions } from '@core/services/product.service';
import { CategoryService, Category } from '@core/services/category.service';
import { SeoService } from '@core/services/seo.service';
import { CartService } from '@core/services/cart.service';
import { AuthService } from '@core/services/auth.service';
import { WishlistService } from '@core/services/wishlist.service';
import { RecentlyViewedService } from '@core/services/recently-viewed.service';
import { Product } from '@core/models/product.model';
import { PricePipe } from '@shared/pipes/price.pipe';
import { QuickBuyModalComponent } from '@shared/components/quick-buy-modal/quick-buy-modal.component';

const SORT_OPTIONS = [
  { value: '',               label: 'Relevancia' },
  { value: 'name,asc',       label: 'Nombre A→Z' },
  { value: 'name,desc',      label: 'Nombre Z→A' },
  { value: 'createdAt,desc', label: 'Más nuevos' },
];

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PricePipe, QuickBuyModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="catalog-page">

      <!-- Recently Viewed Bar (for authenticated users) -->
      @if (isAuthenticated() && recentlyViewedProducts().length > 0) {
        <div class="recently-viewed-bar">
          <div class="recently-viewed-container">
            <label class="recently-viewed-label">Vistos recientemente</label>
            <div class="recently-viewed-scroll">
              @for (product of recentlyViewedProducts(); track product.id) {
                <a [routerLink]="['/product', product.slug]" class="recently-viewed-item">
                  @if (product.images.length > 0) {
                    <img [src]="product.images[0].imageUrl" [alt]="product.name" loading="lazy" />
                  } @else {
                    <div class="rv-placeholder">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </div>
                  }
                  <p class="rv-name">{{ product.name }}</p>
                </a>
              }
            </div>
          </div>
        </div>
      }

      <!-- Filters bar (top bar with search, category, sort) -->
      <div class="filters-bar">
        <div class="filters-inner">

          <div class="search-wrap">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              class="search-input"
              type="text"
              placeholder="Buscar productos..."
              [ngModel]="searchText()" (ngModelChange)="onSearchChange($event)"
            />
            @if (searchText()) {
              <button class="clear-btn" (click)="clearSearch()">✕</button>
            }
          </div>

          <select class="filter-select" [ngModel]="selectedCategoryId()" (ngModelChange)="selectedCategoryId.set($event); onFilterChange()">
            <option [ngValue]="null">Todas las categorías</option>
            @for (cat of categories(); track cat.id) {
              <option [ngValue]="cat.id">{{ cat.name }}</option>
              @for (child of cat.children; track child.id) {
                <option [ngValue]="child.id">&nbsp;&nbsp;{{ child.name }}</option>
              }
            }
          </select>

          <select class="filter-select" [ngModel]="selectedSort()" (ngModelChange)="selectedSort.set($event); onFilterChange()">
            @for (opt of sortOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>

          <span class="results-count">
            @if (!loading()) {
              {{ totalElements() }} producto{{ totalElements() !== 1 ? 's' : '' }}
            }
          </span>

          @if (hasActiveFilters()) {
            <button class="clear-all-btn" (click)="clearAllFilters()">Limpiar filtros</button>
          }

          <!-- Mobile sidebar toggle -->
          <button class="mobile-filter-toggle" (click)="toggleSidebar()">
            ☰ Filtros
            @if (filterCountBadge() > 0) {
              <span class="filter-badge">{{ filterCountBadge() }}</span>
            }
          </button>
        </div>
      </div>

      <!-- Active Filter Chips -->
      @if (hasAdvancedFiltersActive()) {
        <div class="active-filters">
          <span class="active-filters-label">Filtros activos:</span>
          <div class="filter-chips">
            @if (priceMin() !== null) {
              <button class="filter-chip" (click)="priceMin.set(null); onFilterChange()">
                Mín: {{ '$' + (priceMin() | number:'1.0-0') }}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            }
            @if (priceMax() !== null) {
              <button class="filter-chip" (click)="priceMax.set(null); onFilterChange()">
                Máx: {{ '$' + (priceMax() | number:'1.0-0') }}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            }
            @for (size of selectedSizes(); track size) {
              <button class="filter-chip" (click)="removeSize(size)">
                Talle: {{ size }}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            }
            @for (color of selectedColors(); track color) {
              <button class="filter-chip" (click)="removeColor(color)">
                Color: {{ color }}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            }
            @if (inStockOnly()) {
              <button class="filter-chip" (click)="inStockOnly.set(false); onFilterChange()">
                Solo disponible
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            }
            <button class="filter-chip clear-all" (click)="clearAdvancedFilters()">
              Limpiar todos
            </button>
          </div>
        </div>
      }

      <!-- Main layout: sidebar + content -->
      <div class="catalog-layout">

        <!-- Sidebar Filters (left side) -->
        <aside class="filters-sidebar" [class.open]="sidebarOpen()">
          <div class="sidebar-header">
            <h3>Filtros</h3>
            <button class="sidebar-close" (click)="toggleSidebar()">✕</button>
          </div>

          <!-- Price Range Filter -->
          <div class="filter-section">
            <h4 class="filter-title">Rango de precio</h4>
            <div class="price-inputs">
              <input
                type="number"
                placeholder="Mín ($)"
                [ngModel]="priceMin()" (ngModelChange)="priceMin.set($event ? +$event : null); onFilterChange()"
                class="price-input"
              />
              <span class="price-sep">–</span>
              <input
                type="number"
                placeholder="Máx ($)"
                [ngModel]="priceMax()" (ngModelChange)="priceMax.set($event ? +$event : null); onFilterChange()"
                class="price-input"
              />
            </div>
            @if (filterOptions()) {
              <p class="filter-hint">
                Rango: {{ (filterOptions()!.minPrice / 100) | number:'1.0-0' }} - {{ (filterOptions()!.maxPrice / 100) | number:'1.0-0' }} ARS
              </p>
            }
          </div>

          <!-- Size Filter -->
          <div class="filter-section">
            <h4 class="filter-title">Talles</h4>
            @if (filterOptions() && filterOptions()!.sizes.length > 0) {
              <div class="checkbox-group">
                @for (size of filterOptions()!.sizes; track size) {
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      [checked]="selectedSizes().includes(size)"
                      (change)="toggleSize(size)"
                    />
                    <span>{{ size }}</span>
                  </label>
                }
              </div>
            } @else {
              <p class="filter-hint">Sin opciones disponibles</p>
            }
          </div>

          <!-- Color Filter -->
          <div class="filter-section">
            <h4 class="filter-title">Colores</h4>
            @if (filterOptions() && filterOptions()!.colors.length > 0) {
              <div class="checkbox-group">
                @for (color of filterOptions()!.colors; track color) {
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      [checked]="selectedColors().includes(color)"
                      (change)="toggleColor(color)"
                    />
                    <span>{{ color }}</span>
                  </label>
                }
              </div>
            } @else {
              <p class="filter-hint">Sin opciones disponibles</p>
            }
          </div>

          <!-- In-Stock Only Toggle -->
          <div class="filter-section">
            <label class="checkbox-label large">
              <input
                type="checkbox"
                [ngModel]="inStockOnly()" (ngModelChange)="inStockOnly.set($event); onFilterChange()"
              />
              <span>Solo en stock</span>
            </label>
          </div>

          <!-- Sidebar Footer -->
          <div class="sidebar-footer">
            @if (hasAdvancedFiltersActive()) {
              <button class="clear-filters-btn" (click)="clearAdvancedFilters()">Limpiar filtros avanzados</button>
            }
          </div>
        </aside>

        <!-- Overlay (mobile) -->
        @if (sidebarOpen()) {
          <div class="sidebar-overlay" (click)="toggleSidebar()"></div>
        }

        <!-- Main Content -->
        <main class="catalog-content">

          @if (loading()) {
            <div class="state-msg">
              <div class="spinner"></div>
              <p>Cargando productos...</p>
            </div>
          } @else if (error()) {
            <p class="state-msg error">{{ error() }}</p>
          } @else if (products().length === 0) {
            <div class="empty-state">
              <p class="empty-title">Sin resultados</p>
              <p class="empty-sub">
                @if (hasActiveFilters()) {
                  No encontramos productos con esos filtros.
                  <button class="clear-all-btn" (click)="clearAllFilters()">Limpiar filtros</button>
                } @else {
                  No hay productos disponibles.
                }
              </p>
            </div>
          } @else {
            <div class="product-grid">
              @for (product of products(); track product.id) {
                <div class="product-card-wrapper">
                  <!-- Comparador Checkbox -->
                  <div class="compare-checkbox-wrapper">
                    <label class="compare-checkbox-label">
                      <input
                        type="checkbox"
                        [checked]="isInCompareList(product)"
                        [disabled]="isCompareDisabled(product)"
                        (change)="toggleCompare(product)"
                      />
                      <span class="compare-label-text">Comparar</span>
                    </label>
                  </div>

                  <a [routerLink]="['/product', product.slug]" class="product-card">
                    <div class="card-image">
                      @if (product.images.length > 0) {
                        <img [src]="product.images[0].imageUrl" [alt]="product.images[0].altText || product.name" loading="lazy" />
                      } @else {
                        <div class="img-placeholder">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                          </svg>
                        </div>
                      }

                      <!-- Wishlist Button -->
                      <button class="wishlist-btn" (click)="toggleWishlist($event, product)" [class.wishlisted]="isWishlisted(product.id)" title="Agregar a lista de deseos">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                      </button>

                      @if (product.customizable) {
                        <span class="badge-custom">Personalizable</span>
                      }
                      @if (product.categoryName) {
                        <span class="badge-category">{{ product.categoryName }}</span>
                      }
                    </div>
                    <div class="card-body">
                      <h3 class="card-name">{{ product.name }}</h3>
                      @if (product.variants.length > 0) {
                        <p class="card-price">{{ product.variants[0].priceAmount | price }}</p>
                      }
                    </div>

                    <!-- Quick Buy Button (on hover) -->
                    <button class="quick-buy-btn" (click)="openQuickBuy($event, product)">Compra rápida</button>
                  </a>
                </div>
              }
            </div>

            @if (totalPages() > 1) {
              <div class="pagination">
                <button (click)="goToPage(currentPage() - 1)" [disabled]="currentPage() === 0">← Anterior</button>
                @for (p of pageNumbers(); track p) {
                  <button [class.active]="p === currentPage()" (click)="goToPage(p)">{{ p + 1 }}</button>
                }
                  <button (click)="goToPage(currentPage() + 1)" [disabled]="currentPage() >= totalPages() - 1">Siguiente →</button>
                </div>
              }
            }
          </main>
        </div>

        <!-- Quick Buy Modal -->
    <app-quick-buy-modal
      [product]="quickBuyProduct()"
      (close)="closeQuickBuy()"
      (addToCart)="onQuickBuyAddToCart($event)"
    />

    <!-- Compare Floating Bar -->
    @if (compareList().length > 0) {
      <div class="compare-floating-bar">
        <div class="compare-bar-content">
          <span class="compare-bar-label">Comparando ({{ compareList().length }}/3)</span>
          <div class="compare-thumbnails">
            @for (product of compareList(); track product.id) {
              <div class="compare-thumb">
                @if (product.images.length > 0) {
                  <img [src]="product.images[0].imageUrl" [alt]="product.name" loading="lazy" />
                } @else {
                  <div class="thumb-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                }
                <button class="thumb-remove" (click)="toggleCompare(product)">✕</button>
              </div>
            }
          </div>
          <button class="compare-btn" (click)="goToCompare()">Comparar</button>
        </div>
      </div>
    }

    <!-- Comparador Modal -->
    @if (showComparadorModal()) {
      <div class="modal-overlay" (click)="closeComparador()">
        <div class="comparador-modal-content" (click)="$event.stopPropagation()">
          <button class="modal-close" (click)="closeComparador()">✕</button>
          <h2 class="comparador-title">Comparación de productos</h2>
          <div class="comparador-table">
            <div class="comp-row comp-header">
              <div class="comp-col comp-label">Atributo</div>
              @for (product of compareList(); track product.id) {
                <div class="comp-col">{{ product.name }}</div>
              }
            </div>

            <!-- Product Images -->
            <div class="comp-row">
              <div class="comp-col comp-label">Imagen</div>
              @for (product of compareList(); track product.id) {
                <div class="comp-col comp-image">
                  @if (product.images.length > 0) {
                    <img [src]="product.images[0].imageUrl" [alt]="product.name" loading="lazy" />
                  } @else {
                    <div class="comp-img-placeholder">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Price -->
            <div class="comp-row">
              <div class="comp-col comp-label">Precio</div>
              @for (product of compareList(); track product.id) {
                <div class="comp-col">
                  @if (product.variants.length > 0) {
                    {{ product.variants[0].priceAmount | price }}
                  } @else {
                    —
                  }
                </div>
              }
            </div>

            <!-- Category -->
            <div class="comp-row">
              <div class="comp-col comp-label">Categoría</div>
              @for (product of compareList(); track product.id) {
                <div class="comp-col">{{ product.categoryName || '—' }}</div>
              }
            </div>

            <!-- Available Colors -->
            <div class="comp-row">
              <div class="comp-col comp-label">Colores</div>
              @for (product of compareList(); track product.id) {
                <div class="comp-col comp-list">
                  @if (getProductColors(product).length > 0) {
                    @for (color of getProductColors(product); track color) {
                      <span class="comp-tag">{{ color }}</span>
                    }
                  } @else {
                    —
                  }
                </div>
              }
            </div>

            <!-- Available Sizes -->
            <div class="comp-row">
              <div class="comp-col comp-label">Talles</div>
              @for (product of compareList(); track product.id) {
                <div class="comp-col comp-list">
                  @if (getProductSizes(product).length > 0) {
                    @for (size of getProductSizes(product); track size) {
                      <span class="comp-tag">{{ size }}</span>
                    }
                  } @else {
                    —
                  }
                </div>
              }
            </div>

            <!-- In Stock -->
            <div class="comp-row">
              <div class="comp-col comp-label">Disponibilidad</div>
              @for (product of compareList(); track product.id) {
                <div class="comp-col">
                  @if (getProductInStock(product)) {
                    <span class="stock-badge in-stock">En stock</span>
                  } @else {
                    <span class="stock-badge out-of-stock">Sin stock</span>
                  }
                </div>
              }
            </div>

            <!-- Actions -->
            <div class="comp-row">
              <div class="comp-col comp-label">Acciones</div>
              @for (product of compareList(); track product.id) {
                <div class="comp-col">
                  <a [routerLink]="['/product', product.slug]" class="comp-action-btn">Ver producto</a>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    }
  </div>
  `,
  styles: [`
    .catalog-page { min-height: calc(100vh - 60px); }

    /* Recently Viewed Bar */
    .recently-viewed-bar {
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
      padding: 1rem 0;
    }
    .recently-viewed-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 1.25rem;
    }
    .recently-viewed-label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .recently-viewed-scroll {
      display: flex;
      gap: 1rem;
      overflow-x: auto;
      scroll-behavior: smooth;
      padding-bottom: 0.5rem;
    }
    .recently-viewed-scroll::-webkit-scrollbar { height: 6px; }
    .recently-viewed-scroll::-webkit-scrollbar-track { background: transparent; }
    .recently-viewed-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    .recently-viewed-item {
      flex: 0 0 100px;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      text-decoration: none;
      color: inherit;
      text-align: center;
    }
    .recently-viewed-item img {
      width: 100px;
      height: 100px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid var(--border);
      transition: transform 0.2s;
    }
    .recently-viewed-item:hover img { transform: scale(1.05); }
    .rv-placeholder {
      width: 100px;
      height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-secondary);
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    .rv-name {
      font-size: 0.7rem;
      font-weight: 500;
      color: var(--text-secondary);
      margin: 0;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    /* Filters Bar (top) */
    .filters-bar {
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 60px;
      z-index: 50;
      transition: background 0.2s, border-color 0.2s;
    }
    .filters-inner {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0.75rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .search-wrap {
      position: relative;
      flex: 1 1 220px;
      max-width: 360px;
    }
    .search-icon {
      position: absolute;
      left: 0.65rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-secondary);
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      padding: 0.5rem 2.2rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.875rem;
      outline: none;
      box-sizing: border-box;
      background: var(--bg-secondary);
      color: var(--text);
      transition: border-color 0.15s, background 0.2s;
    }
    .search-input:focus { border-color: var(--primary); background: var(--bg); }
    .search-input::placeholder { color: var(--text-secondary); opacity: 0.6; }
    .clear-btn {
      position: absolute;
      right: 0.6rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-secondary);
      font-size: 0.8rem;
      transition: color 0.15s;
    }
    .clear-btn:hover { color: var(--text); }

    .filter-select {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.875rem;
      background: var(--bg-card);
      color: var(--text);
      cursor: pointer;
      outline: none;
      min-width: 150px;
      transition: border-color 0.15s, background 0.2s;
    }
    .filter-select:focus { border-color: var(--primary); }

    .results-count {
      font-size: 0.825rem;
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .clear-all-btn {
      padding: 0.4rem 0.75rem;
      background: var(--danger-bg);
      color: var(--danger);
      border: 1px solid var(--danger-border);
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: background 0.15s;
    }
    .clear-all-btn:hover { background: var(--danger-bg); }

    .mobile-filter-toggle {
      display: none;
      padding: 0.5rem 0.75rem;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text);
      position: relative;
    }
    .mobile-filter-toggle:hover { background: var(--bg-secondary); }
    .filter-badge {
      position: absolute;
      top: -8px;
      right: -8px;
      background: var(--danger);
      color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      font-weight: 700;
    }

    /* Active Filter Chips */
    .active-filters {
      background: var(--success-bg);
      border-bottom: 1px solid var(--success-border);
      padding: 0.75rem 0;
    }
    .active-filters .active-filters-label {
      font-size: 0.8rem;
      color: var(--success-text);
      font-weight: 600;
      margin-right: 0.5rem;
    }
    .filter-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 1.25rem;
    }
    .filter-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.75rem;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--text);
      cursor: pointer;
      transition: all 0.15s;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    .filter-chip:hover {
      background: var(--danger-bg);
      border-color: var(--danger-border);
      color: var(--danger);
    }
    .filter-chip svg {
      flex-shrink: 0;
      opacity: 0.7;
    }
    .filter-chip:hover svg {
      opacity: 1;
    }
    .filter-chip.clear-all {
      background: var(--danger-bg);
      border-color: var(--danger-border);
      color: var(--danger);
    }
    .filter-chip.clear-all:hover {
      background: var(--danger-bg);
    }

    /* Catalog Layout: Sidebar + Content */
    .catalog-layout {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      gap: 1.5rem;
      padding: 1.5rem 1.25rem;
      position: relative;
    }

    /* Filters Sidebar */
    .filters-sidebar {
      flex: 0 0 260px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      height: fit-content;
      position: sticky;
      top: 150px;
      max-height: calc(100vh - 180px);
      overflow-y: auto;
      transition: background 0.2s, border-color 0.2s;
    }
    .filters-sidebar::-webkit-scrollbar { width: 6px; }
    .filters-sidebar::-webkit-scrollbar-track { background: transparent; }
    .filters-sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }
    .sidebar-header h3 {
      font-size: 1.125rem;
      font-weight: 700;
      margin: 0;
      color: var(--text);
    }
    .sidebar-close {
      display: none;
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--text-secondary);
    }

    .filter-section {
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    .filter-section:last-of-type {
      border-bottom: none;
      margin-bottom: 1rem;
      padding-bottom: 0;
    }

    .filter-title {
      font-size: 0.95rem;
      font-weight: 700;
      margin: 0 0 0.75rem;
      color: var(--text);
      text-transform: capitalize;
    }

    .price-inputs {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .price-input {
      flex: 1;
      padding: 0.5rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.875rem;
      outline: none;
      background: var(--bg-secondary);
      color: var(--text);
      transition: border-color 0.15s, background 0.2s;
    }
    .price-input:focus { border-color: var(--primary); background: var(--bg); }
    .price-sep {
      color: var(--text-secondary);
      font-weight: 600;
    }

    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      font-size: 0.875rem;
      color: var(--text);
      user-select: none;
    }
    .checkbox-label.large { font-size: 0.95rem; font-weight: 500; }
    .checkbox-label input {
      accent-color: var(--primary);
      cursor: pointer;
      width: 16px;
      height: 16px;
    }
    .checkbox-label:hover {
      color: var(--primary);
    }

    .filter-hint {
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin: 0.5rem 0 0;
    }

    .sidebar-footer {
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }
    .clear-filters-btn {
      width: 100%;
      padding: 0.6rem 0;
      background: var(--danger-bg);
      color: var(--danger);
      border: 1px solid var(--danger-border);
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }
    .clear-filters-btn:hover { background: var(--danger-bg); }

    .sidebar-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 99;
    }

    /* Main Content */
    .catalog-content {
      flex: 1;
      min-width: 0;
    }

    .state-msg {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 4rem;
      color: var(--text-secondary);
      text-align: center;
    }
    .state-msg.error { color: var(--danger); }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
    }
    .empty-title {
      font-size: 1.15rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .empty-sub {
      color: var(--text-secondary);
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1.25rem;
      width: 100%;
    }

    .product-card-wrapper {
      position: relative;
    }

    .compare-checkbox-wrapper {
      position: absolute;
      top: 8px;
      left: 8px;
      background: var(--bg-card);
      border-radius: 6px;
      padding: 0.35rem 0.5rem;
      z-index: 10;
      border: 1px solid var(--border);
    }
    .compare-checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      user-select: none;
    }
    .compare-checkbox-label input {
      accent-color: var(--primary);
      cursor: pointer;
      width: 14px;
      height: 14px;
    }
    .compare-checkbox-label input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .compare-label-text { text-transform: capitalize; }

    .product-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      transition: box-shadow 0.2s, transform 0.15s;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .product-card:hover {
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }

    .card-image {
      position: relative;
      aspect-ratio: 1;
      overflow: hidden;
      background: var(--bg-secondary);
    }
    .card-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }
    .product-card:hover .card-image img { transform: scale(1.04); }
    .img-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .wishlist-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      background: var(--bg-card);
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-muted);
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      z-index: 10;
    }
    .wishlist-btn:hover {
      color: var(--danger);
      transform: scale(1.1);
    }
    .wishlist-btn.wishlisted {
      color: var(--danger);
      background: var(--danger-bg);
    }

    .badge-custom {
      position: absolute;
      top: 8px;
      left: 8px;
      background: var(--primary);
      color: white;
      font-size: 0.68rem;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .badge-category {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.45);
      color: white;
      font-size: 0.68rem;
      padding: 2px 7px;
      border-radius: 4px;
    }

    .card-body {
      padding: 0.85rem;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .card-name {
      font-size: 0.95rem;
      font-weight: 600;
      margin: 0 0 0.35rem;
      line-height: 1.3;
      flex: 1;
    }
    .card-price {
      font-size: 1rem;
      font-weight: 700;
      color: var(--primary);
      margin: 0;
    }

    .quick-buy-btn {
      width: 100%;
      padding: 0.6rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 0 0 11px 11px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      transition: background 0.2s;
      opacity: 0;
      max-height: 0;
      overflow: hidden;
    }
    .product-card:hover .quick-buy-btn {
      opacity: 1;
      max-height: 40px;
    }
    .quick-buy-btn:hover { background: var(--primary-dark); }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      margin-top: 2rem;
      flex-wrap: wrap;
    }
    .pagination button {
      padding: 0.45rem 0.85rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg-card);
      cursor: pointer;
      font-size: 0.875rem;
      transition: background 0.15s;
    }
    .pagination button:hover:not(:disabled) { background: var(--bg-secondary); }
    .pagination button.active {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
    }
    .pagination button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* Compare Floating Bar */
    .compare-floating-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--bg-card);
      border-top: 1px solid var(--border);
      z-index: 90;
      animation: slideUp 0.3s ease;
    }

    .compare-bar-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    .compare-bar-label {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text);
      white-space: nowrap;
    }

    .compare-thumbnails {
      display: flex;
      gap: 0.75rem;
      flex: 1;
    }
    .compare-thumb {
      position: relative;
      flex: 0 0 70px;
      height: 70px;
      border-radius: 8px;
      overflow: hidden;
      border: 2px solid var(--border);
      background: var(--bg-secondary);
    }
    .compare-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .thumb-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .thumb-remove {
      position: absolute;
      top: 2px;
      right: 2px;
      background: rgba(0, 0, 0, 0.6);
      color: white;
      border: none;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      cursor: pointer;
      font-size: 0.8rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .thumb-remove:hover { background: rgba(0, 0, 0, 0.8); }

    .compare-btn {
      padding: 0.6rem 1.5rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.9rem;
      transition: background 0.2s;
      white-space: nowrap;
    }
    .compare-btn:hover { background: var(--primary-dark); }

    /* Modal Overlay */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
      animation: fadeIn 0.2s;
    }

    /* Quick Buy Modal */
    .comparador-modal-content {
      background: var(--bg-card);
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
      max-width: 1100px;
      width: 100%;
      max-height: 90vh;
      overflow: auto;
      position: relative;
      animation: scaleIn 0.3s ease;
    }

    .comparador-title {
      font-size: 1.5rem;
      font-weight: 700;
      padding: 1.5rem;
      margin: 0;
      border-bottom: 1px solid var(--border);
    }

    .comparador-table {
      display: flex;
      flex-direction: column;
    }

    .comp-row {
      display: grid;
      border-bottom: 1px solid var(--border);
    }
    .comp-row.comp-header {
      background: var(--bg-secondary);
      font-weight: 700;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .comp-col {
      padding: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 0.9rem;
    }

    .comp-label {
      text-align: left;
      justify-content: flex-start;
      font-weight: 600;
      color: var(--text);
      background: var(--bg-secondary);
    }

    .comp-image {
      aspect-ratio: 1;
      padding: 1rem;
    }
    .comp-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
    }
    .comp-img-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-secondary);
      border-radius: 8px;
    }

    .comp-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      align-items: center;
    }

    .comp-tag {
      display: inline-block;
      background: var(--border);
      color: var(--text);
      padding: 0.35rem 0.75rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .stock-badge {
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .stock-badge.in-stock {
      background: var(--success-bg);
      color: var(--success-text);
    }
    .stock-badge.out-of-stock {
      background: var(--danger-bg);
      color: var(--danger-text);
    }

    .comp-action-btn {
      display: inline-block;
      padding: 0.5rem 1rem;
      background: var(--primary);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      transition: background 0.2s;
    }
    .comp-action-btn:hover { background: var(--primary-dark); }

    .modal-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--text-muted);
      z-index: 10;
      transition: color 0.2s;
    }
    .modal-close:hover { color: var(--text); }

    /* Responsive */
    @media (max-width: 768px) {
      .mobile-filter-toggle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .filters-sidebar {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        max-width: 320px;
        height: 100vh;
        z-index: 100;
        transform: translateX(-100%);
        transition: transform 0.3s;
        border-radius: 0;
        max-height: none;
      }
      .filters-sidebar.open {
        transform: translateX(0);
      }

      .sidebar-close { display: block; }
      .sidebar-overlay.open { display: block; }

      .catalog-layout {
        flex-direction: column;
        gap: 0;
        padding: 0;
      }

      .catalog-content {
        padding: 1.5rem 1.25rem;
      }

      .product-grid {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 0.75rem;
      }

      .comp-row {
        font-size: 0.85rem;
      }
      .comp-col {
        padding: 0.75rem;
      }

      .compare-bar-content {
        padding: 0.75rem;
        gap: 1rem;
      }
      .compare-bar-label {
        font-size: 0.85rem;
      }
      .compare-thumbnails {
        gap: 0.5rem;
      }
      .compare-thumb {
        flex: 0 0 50px;
        height: 50px;
      }
      .compare-btn {
        padding: 0.5rem 1rem;
        font-size: 0.8rem;
      }
    }
  `],
})
export class CatalogComponent implements OnInit {
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private wishlistService = inject(WishlistService);
  private recentlyViewedService = inject(RecentlyViewedService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private seo = inject(SeoService);
  private readonly platformId = inject(PLATFORM_ID);

  // Data
  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);

  // Loading and errors
  loading = signal(true);
  error = signal('');

  // Pagination
  totalElements = signal(0);
  totalPages = signal(0);
  currentPage = signal(0);
  pageSize = 12;

  // Search and basic filters
  searchText = signal('');
  selectedCategoryId = signal<number | null>(null);
  selectedSort = signal('');
  sortOptions = SORT_OPTIONS;

  // Advanced filters (signals)
  priceMin = signal<number | null>(null);
  priceMax = signal<number | null>(null);
  selectedSizes = signal<string[]>([]);
  selectedColors = signal<string[]>([]);
  inStockOnly = signal(false);
  filterOptions = signal<FilterOptions | null>(null);

  // Sidebar
  sidebarOpen = signal(false);

  // Wishlist
  isAuthenticated = this.authService.isAuthenticated;
  wishlistedItems = signal<Set<number>>(new Set());
  recentlyViewedProducts = signal<Product[]>([]);

  // Quick buy modal
  showQuickBuyModal = signal(false);
  quickBuyProduct = signal<Product | null>(null);

  // Comparador
  compareList = signal<Product[]>([]);
  showComparadorModal = signal(false);

  // Observables management
  private searchSubject = new Subject<string>();
  private destroyRef = inject(DestroyRef);

  // Computed properties
  hasActiveFilters = computed(() => {
    return !!(
      this.searchText().trim() ||
      this.selectedCategoryId() ||
      this.selectedSort()
    );
  });

  hasAdvancedFiltersActive = computed(() => {
    return !!(
      this.priceMin() !== null ||
      this.priceMax() !== null ||
      this.selectedSizes().length > 0 ||
      this.selectedColors().length > 0 ||
      this.inStockOnly()
    );
  });

  filterCountBadge = computed(() => {
    let count = 0;
    if (this.priceMin() !== null) count++;
    if (this.priceMax() !== null) count++;
    if (this.selectedSizes().length > 0) count++;
    if (this.selectedColors().length > 0) count++;
    if (this.inStockOnly()) count++;
    return count;
  });

  pageNumbers = computed(() => {
    const delta = 3;
    const start = Math.max(0, this.currentPage() - delta);
    const end = Math.min(this.totalPages() - 1, this.currentPage() + delta);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });

  ngOnInit(): void {
    this.seo.set({
      title: 'Catálogo',
      description: 'Explorá toda la colección de ropa personalizable de Solder Studio. Remeras, buzos, accesorios y más. Envío a todo Argentina.',
      keywords: 'ropa personalizada, remeras, buzos, catálogo, tienda online Argentina',
      canonicalPath: '/',
    });
    this.seo.reset();

    // Load categories
    this.categoryService.listRoots().subscribe({
      next: cats => this.categories.set(cats),
      error: () => {},
    });

    // Load filter options
    this.loadFilterOptions();

    // Load recently viewed (for authenticated users)
    if (this.isAuthenticated()) {
      this.recentlyViewedService.getRecentlyViewed().subscribe({
        next: items => this.recentlyViewedProducts.set(items.slice(0, 10)),
        error: () => {},
      });
    }

    // Restore URL params
    const params = this.route.snapshot.queryParamMap;
    this.searchText.set(params.get('q') ?? '');
    this.selectedCategoryId.set(params.get('categoryId') ? Number(params.get('categoryId')) : null);
    this.selectedSort.set(params.get('sort') ?? '');
    this.currentPage.set(params.get('page') ? Number(params.get('page')) : 0);

    // Debounced search
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.currentPage.set(0);
      this.loadProducts();
    });

    this.loadProducts();
  }

  // Sidebar
  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  // Search
  onSearchChange(value: string): void {
    this.searchText.set(value);
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.searchText.set('');
    this.currentPage.set(0);
    this.loadProducts();
  }

  // Filters
  toggleSize(size: string): void {
    const current = this.selectedSizes();
    if (current.includes(size)) {
      this.selectedSizes.set(current.filter(s => s !== size));
    } else {
      this.selectedSizes.set([...current, size]);
    }
    this.currentPage.set(0);
    this.onFilterChange();
  }

  toggleColor(color: string): void {
    const current = this.selectedColors();
    if (current.includes(color)) {
      this.selectedColors.set(current.filter(c => c !== color));
    } else {
      this.selectedColors.set([...current, color]);
    }
    this.currentPage.set(0);
    this.onFilterChange();
  }

  onFilterChange(): void {
    this.currentPage.set(0);
    this.loadProducts();
  }

  clearAllFilters(): void {
    this.searchText.set('');
    this.selectedCategoryId.set(null);
    this.selectedSort.set('');
    this.clearAdvancedFilters();
    this.currentPage.set(0);
    this.loadProducts();
  }

  clearAdvancedFilters(): void {
    this.priceMin.set(null);
    this.priceMax.set(null);
    this.selectedSizes.set([]);
    this.selectedColors.set([]);
    this.inStockOnly.set(false);
    this.currentPage.set(0);
    this.loadProducts();
  }

  removeSize(size: string): void {
    this.selectedSizes.update(current => current.filter(s => s !== size));
    this.onFilterChange();
  }

  removeColor(color: string): void {
    this.selectedColors.update(current => current.filter(c => c !== color));
    this.onFilterChange();
  }

  // Pagination
  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.currentPage.set(page);
    this.loadProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Wishlist
  isWishlisted(productId: number): boolean {
    return this.wishlistedItems().has(productId);
  }

  toggleWishlist(event: Event, product: Product): void {
    event.preventDefault();
    event.stopPropagation();
    this.wishlistService.toggle(product.id).subscribe({
      next: () => {
        const current = this.wishlistedItems();
        if (current.has(product.id)) {
          current.delete(product.id);
        } else {
          current.add(product.id);
        }
        this.wishlistedItems.set(new Set(current));
      },
      error: () => {},
    });
  }

  // Quick Buy Modal
  openQuickBuy(event: Event, product: Product): void {
    event.preventDefault();
    event.stopPropagation();
    this.quickBuyProduct.set(product);
    this.showQuickBuyModal.set(true);
  }

  closeQuickBuy(): void {
    this.showQuickBuyModal.set(false);
    this.quickBuyProduct.set(null);
  }

  onQuickBuyAddToCart(event: { productVariantId: number; quantity: number }): void {
    if (!this.isAuthenticated()) {
      this.cartService.savePendingItem(event);
      this.closeQuickBuy();
      this.router.navigate(['/auth']);
      return;
    }

    this.cartService.addItem(event).subscribe({
      next: () => {
        this.closeQuickBuy();
      },
      error: () => {
        alert('Error al agregar al carrito');
      },
    });
  }

  isInCompareList(product: Product): boolean {
    return this.compareList().some(p => p.id === product.id);
  }

  isCompareDisabled(product: Product): boolean {
    return !this.compareList().some(p => p.id === product.id) && this.compareList().length >= 3;
  }

  // Comparador
  toggleCompare(product: Product): void {
    const current = this.compareList();
    if (current.some(p => p.id === product.id)) {
      this.compareList.set(current.filter(p => p.id !== product.id));
    } else if (current.length < 3) {
      this.compareList.set([...current, product]);
    }
    this.saveCompareList();
  }

  goToCompare(): void {
    this.router.navigate(['/compare']);
  }

  openComparador(): void {
    this.showComparadorModal.set(true);
  }

  closeComparador(): void {
    this.showComparadorModal.set(false);
  }

  // Persist compare list to localStorage
  private saveCompareList(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const productIds = this.compareList().map(p => p.id);
      localStorage.setItem('compare_products_catalog', JSON.stringify(productIds));
    } catch (e) {
      console.error('Error saving compare list:', e);
    }
  }

  private loadCompareList(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const stored = localStorage.getItem('compare_products_catalog');
      if (stored) {
        const ids = JSON.parse(stored) as number[];
        // Filter products that are currently loaded
        const currentProducts = this.products();
        const matchingProducts = currentProducts.filter(p => ids.includes(p.id));
        if (matchingProducts.length > 0) {
          this.compareList.set(matchingProducts);
        }
      }
    } catch (e) {
      console.error('Error loading compare list:', e);
    }
  }

  getProductColors(product: Product): string[] {
    return Array.from(new Set(product.variants.map(v => v.color).filter(Boolean)));
  }

  getProductSizes(product: Product): string[] {
    return Array.from(new Set(product.variants.map(v => v.size).filter(Boolean)));
  }

  getProductInStock(product: Product): boolean {
    return product.variants.some(v => v.stockAvailable > 0);
  }

  // Data loading
  private loadFilterOptions(): void {
    this.productService.getFilterOptions(this.selectedCategoryId() ?? undefined).subscribe({
      next: opts => this.filterOptions.set(opts),
      error: () => {},
    });
  }

  private loadProducts(): void {
    this.loading.set(true);
    this.error.set('');
    this.syncUrlParams();
    this.sidebarOpen.set(false);

    // Convert price from pesos to centavos for API
    const priceMinCentavos = this.priceMin() !== null ? this.priceMin()! * 100 : null;
    const priceMaxCentavos = this.priceMax() !== null ? this.priceMax()! * 100 : null;

    this.productService.listAdvanced({
      q: this.searchText(),
      categoryId: this.selectedCategoryId(),
      priceMin: priceMinCentavos,
      priceMax: priceMaxCentavos,
      sizes: this.selectedSizes(),
      colors: this.selectedColors(),
      inStockOnly: this.inStockOnly(),
      sort: this.selectedSort(),
      page: this.currentPage(),
      size: this.pageSize,
    }).subscribe({
      next: page => {
        this.products.set(page.content);
        this.totalElements.set(page.totalElements);
        this.totalPages.set(page.totalPages);
        this.loading.set(false);
        // Restore compare list with newly loaded products
        this.loadCompareList();
      },
      error: () => {
        this.error.set('No se pudo cargar el catálogo. Intentá de nuevo.');
        this.loading.set(false);
      },
    });
  }

  private syncUrlParams(): void {
    const queryParams: Record<string, string | number | null> = {};
    if (this.searchText().trim()) queryParams['q'] = this.searchText().trim();
    if (this.selectedCategoryId() != null) queryParams['categoryId'] = this.selectedCategoryId();
    if (this.selectedSort()) queryParams['sort'] = this.selectedSort();
    if (this.currentPage() > 0) queryParams['page'] = this.currentPage();

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }
}
