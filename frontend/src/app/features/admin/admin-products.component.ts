import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { PricePipe } from '@shared/pipes/price.pipe';
import { Category, CategoryService } from '@core/services/category.service';

interface AdminProduct {
  id: number;
  name: string;
  slug: string;
  description: string;
  categoryId: number;
  categoryName: string;
  customizable: boolean;
  active: boolean;
  variants: AdminVariant[];
  images: AdminImage[];
}

interface AdminVariant {
  id: number;
  color: string;
  size: string;
  priceAmount: number;
  currencyCode: string;
  stockAvailable: number;
  stockTotal: number;
  stockReserved: number;
  sku: string;
}

interface AdminImage {
  id: number;
  imageUrl: string;
  altText: string | null;
  primary: boolean;
}

interface ProductForm {
  name: string;
  slug: string;
  description: string;
  categoryId: number | null;
  customizable: boolean;
  active: boolean;
}

interface VariantForm {
  color: string;
  size: string;
  priceAmount: number;  // pesos (UI), converted to centavos on save
  stockTotal: number;
  sku: string;
}

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule, PricePipe],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>Gestión de Productos</h2>
        <span class="count">{{ totalElements }} productos</span>
        <button class="btn-primary" (click)="openCreateModal()">+ Nuevo producto</button>
      </div>

      @if (errorMessage) {
        <div class="alert-error">{{ errorMessage }}</div>
      }
      @if (successMessage) {
        <div class="alert-success">{{ successMessage }}</div>
      }

      <!-- Product list -->
      <div class="product-list">
        @if (loading) {
          <div class="loading">Cargando productos...</div>
        }

        @for (product of products; track product.id) {
          <div class="product-card" [class.inactive]="!product.active">

            <!-- Product header -->
            <div class="product-header">
              <div class="product-title">
                <span class="product-name">{{ product.name }}</span>
                @if (!product.active) {
                  <span class="badge-inactive">Inactivo</span>
                }
                @if (product.customizable) {
                  <span class="badge-custom">Personalizable</span>
                }
                <span class="product-category">{{ product.categoryName }}</span>
              </div>
              <div class="product-actions">
                <button class="expand-btn" (click)="toggleExpand(product.id, 'variants')">
                  {{ expandedId === product.id && activeTab === 'variants' ? '▲ Variantes' : '▼ Variantes' }}
                </button>
                <button class="expand-btn" (click)="toggleExpand(product.id, 'images')">
                  {{ expandedId === product.id && activeTab === 'images' ? '▲ Imágenes' : '▼ Imágenes' }}
                </button>
                <button class="expand-btn btn-stock" (click)="toggleExpand(product.id, 'stock')">
                  {{ expandedId === product.id && activeTab === 'stock' ? '▲ Stock' : '▼ Stock' }}
                </button>
                <button class="btn-edit" (click)="openEditModal(product)">Editar</button>
                <button
                  class="btn-toggle"
                  [class.btn-activate]="!product.active"
                  [class.btn-deactivate]="product.active"
                  (click)="toggleActive(product)"
                >
                  {{ product.active ? 'Desactivar' : 'Activar' }}
                </button>
              </div>
            </div>

            <!-- Variants table -->
            @if (expandedId === product.id && activeTab === 'variants') {
              <div class="variants-section">
                <div class="variants-toolbar">
                  <button class="btn-add-variant" (click)="openAddVariantModal(product.id)">
                    + Agregar variante
                  </button>
                </div>
                <table class="variants-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Color</th>
                      <th>Talle</th>
                      <th>Precio (ARS)</th>
                      <th>Stock disponible</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (variant of product.variants; track variant.id) {
                      <tr>
                        <td class="sku">{{ variant.sku || '—' }}</td>
                        <td>{{ variant.color }}</td>
                        <td>{{ variant.size }}</td>
                        <td>
                          @if (editingVariantId === variant.id && editingField === 'price') {
                            <input
                              type="number"
                              [(ngModel)]="editValue"
                              class="edit-input"
                              (keydown.enter)="saveVariantPrice(product.id, variant)"
                              (keydown.escape)="cancelEdit()"
                              autofocus
                            />
                          } @else {
                            <span class="editable" (click)="startEditPrice(variant)">
                              {{ variant.priceAmount | price: variant.currencyCode }}
                            </span>
                          }
                        </td>
                        <td>
                          @if (editingVariantId === variant.id && editingField === 'stock') {
                            <input
                              type="number"
                              [(ngModel)]="editValue"
                              class="edit-input"
                              (keydown.enter)="saveVariantStock(product.id, variant)"
                              (keydown.escape)="cancelEdit()"
                              autofocus
                            />
                          } @else {
                            <span
                              class="editable"
                              [class.low-stock]="variant.stockAvailable <= 5"
                              (click)="startEditStock(variant)"
                            >
                              {{ variant.stockAvailable }}
                            </span>
                          }
                        </td>
                        <td class="variant-actions">
                          @if (editingVariantId === variant.id) {
                            <button class="btn-save" (click)="saveEdit(product.id, variant)">Guardar</button>
                            <button class="btn-cancel" (click)="cancelEdit()">✕</button>
                          }
                          <button class="btn-delete-variant" (click)="deleteVariant(product, variant)"
                            title="Desactivar variante">🗑</button>
                        </td>
                      </tr>
                    }
                    @if (product.variants.length === 0) {
                      <tr><td colspan="6" class="empty-variants">Sin variantes. Agregá una con el botón de arriba.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <!-- Stock panel -->
            @if (expandedId === product.id && activeTab === 'stock') {
              <div class="stock-section">
                <div class="stock-legend">
                  <span><span class="legend-dot dot-total"></span>Total en depósito</span>
                  <span><span class="legend-dot dot-reserved"></span>Reservado (pedidos)</span>
                  <span><span class="legend-dot dot-available"></span>Disponible</span>
                </div>
                <table class="stock-table">
                  <thead>
                    <tr>
                      <th>Variante</th>
                      <th>SKU</th>
                      <th class="text-center">Total</th>
                      <th class="text-center">Reservado</th>
                      <th class="text-center">Disponible</th>
                      <th>Ajuste de stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (variant of product.variants; track variant.id) {
                      <tr [class.low-row]="variant.stockAvailable <= 5">
                        <td class="variant-label">
                          <span class="color-pill">{{ variant.color }}</span>
                          <span class="size-pill">{{ variant.size }}</span>
                        </td>
                        <td class="sku">{{ variant.sku || '—' }}</td>
                        <td class="text-center stock-num">{{ variant.stockTotal }}</td>
                        <td class="text-center stock-reserved">{{ variant.stockReserved }}</td>
                        <td class="text-center">
                          <span class="stock-available" [class.low-stock]="variant.stockAvailable <= 5">
                            {{ variant.stockAvailable }}
                          </span>
                        </td>
                        <td class="adjust-cell">
                          <div class="adjust-row">
                            <button class="adj-btn minus" (click)="decrementAdj(variant.id)" title="Reducir cantidad">−</button>
                            <input
                              type="number"
                              class="adj-input"
                              [value]="getAdj(variant.id)"
                              (input)="setAdj(variant.id, $event)"
                              min="1"
                              placeholder="0"
                            />
                            <button class="adj-btn plus" (click)="incrementAdj(variant.id)" title="Aumentar cantidad">+</button>
                            <button
                              class="btn-reponer"
                              (click)="adjustStock(product.id, variant, +1)"
                              [disabled]="getAdj(variant.id) <= 0 || savingStockId === variant.id"
                              title="Reponer stock"
                            >
                              ✓ Reponer
                            </button>
                            <button
                              class="btn-descontar"
                              (click)="adjustStock(product.id, variant, -1)"
                              [disabled]="getAdj(variant.id) <= 0 || savingStockId === variant.id || variant.stockAvailable < getAdj(variant.id)"
                              title="Descontar stock"
                            >
                              − Descontar
                            </button>
                            @if (savingStockId === variant.id) {
                              <span class="saving-dot">…</span>
                            }
                          </div>
                          @if (variant.stockAvailable < getAdj(variant.id) && getAdj(variant.id) > 0) {
                            <span class="adj-warning">No hay suficiente stock disponible</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <!-- Images panel -->
            @if (expandedId === product.id && activeTab === 'images') {
              <div class="images-section">

                <!-- Upload area -->
                <div class="upload-row">
                  <label class="upload-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Subir imagen
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      hidden
                      (change)="onImageFileSelected($event, product.id)"
                    />
                  </label>
                  @if (uploadingForProductId === product.id) {
                    <span class="uploading-msg">Subiendo...</span>
                  }
                </div>

                <!-- Image grid -->
                @if (product.images && product.images.length > 0) {
                  <div class="image-grid">
                    @for (img of product.images; track img.id) {
                      <div class="image-card" [class.primary-card]="img.primary">
                        <img [src]="getImageUrl(img.imageUrl)" [alt]="img.altText || product.name" />
                        <div class="image-overlay">
                          @if (!img.primary) {
                            <button class="img-action" title="Establecer como principal"
                              (click)="setImagePrimary(product, img)">★</button>
                          } @else {
                            <span class="primary-badge">Principal</span>
                          }
                          <button class="img-action danger" title="Eliminar"
                            (click)="deleteImage(product, img)">🗑</button>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <p class="no-images">Sin imágenes. Subí la primera usando el botón de arriba.</p>
                }

              </div>
            }

          </div>
        }
      </div>

      <!-- Pagination -->
      @if (totalPages > 1) {
        <div class="pagination">
          <button (click)="loadPage(currentPage - 1)" [disabled]="currentPage === 0">‹</button>
          @for (p of pageNumbers(); track p) {
            <button (click)="loadPage(p)" [class.active]="p === currentPage">{{ p + 1 }}</button>
          }
          <button (click)="loadPage(currentPage + 1)" [disabled]="currentPage >= totalPages - 1">›</button>
        </div>
      }
    </div>

    <!-- ── Create / Edit Product Modal ──────────────────────────────────── -->
    @if (showProductModal) {
      <div class="modal-backdrop" (click)="closeProductModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingProductId ? 'Editar producto' : 'Nuevo producto' }}</h3>
            <button class="modal-close" (click)="closeProductModal()">✕</button>
          </div>
          <div class="modal-body">
            @if (modalError) {
              <div class="alert-error small">{{ modalError }}</div>
            }
            <div class="form-row">
              <label>Nombre *</label>
              <input type="text" [(ngModel)]="productForm.name" placeholder="Nombre del producto" />
            </div>
            <div class="form-row">
              <label>Slug (URL) <small>dejar vacío para auto-generar</small></label>
              <input type="text" [(ngModel)]="productForm.slug" placeholder="mi-producto-ejemplo" />
            </div>
            <div class="form-row">
              <label>Descripción</label>
              <textarea [(ngModel)]="productForm.description" rows="4"
                placeholder="Descripción del producto..."></textarea>
            </div>
            <div class="form-row">
              <label>Categoría</label>
              <select [(ngModel)]="productForm.categoryId">
                <option [ngValue]="null">— Sin categoría —</option>
                @for (cat of categories; track cat.id) {
                  <option [ngValue]="cat.id">{{ cat.name }}</option>
                  @for (child of cat.children; track child.id) {
                    <option [ngValue]="child.id">  ↳ {{ child.name }}</option>
                  }
                }
              </select>
            </div>
            <div class="form-row-check">
              <label>
                <input type="checkbox" [(ngModel)]="productForm.customizable" />
                Personalizable (permite diseño propio)
              </label>
            </div>
            <div class="form-row-check">
              <label>
                <input type="checkbox" [(ngModel)]="productForm.active" />
                Activo (visible en la tienda)
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeProductModal()" [disabled]="saving">Cancelar</button>
            <button class="btn-primary" (click)="saveProduct()" [disabled]="saving">
              {{ saving ? 'Guardando...' : (editingProductId ? 'Guardar cambios' : 'Crear producto') }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Add Variant Modal ─────────────────────────────────────────────── -->
    @if (showVariantModal) {
      <div class="modal-backdrop" (click)="closeVariantModal()">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Agregar variante</h3>
            <button class="modal-close" (click)="closeVariantModal()">✕</button>
          </div>
          <div class="modal-body">
            @if (modalError) {
              <div class="alert-error small">{{ modalError }}</div>
            }
            <div class="form-row">
              <label>Color *</label>
              <input type="text" [(ngModel)]="variantForm.color" placeholder="Ej: Negro" />
            </div>
            <div class="form-row">
              <label>Talle *</label>
              <input type="text" [(ngModel)]="variantForm.size" placeholder="Ej: M" />
            </div>
            <div class="form-row">
              <label>Precio (ARS) *</label>
              <input type="number" [(ngModel)]="variantForm.priceAmount" placeholder="15000" min="0.01" step="0.01" />
              <small>Ingresá el precio en pesos (ej: 15000 = $150.00)</small>
            </div>
            <div class="form-row">
              <label>Stock inicial</label>
              <input type="number" [(ngModel)]="variantForm.stockTotal" placeholder="0" min="0" />
            </div>
            <div class="form-row">
              <label>SKU</label>
              <input type="text" [(ngModel)]="variantForm.sku" placeholder="Ej: CAM-NEG-M" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeVariantModal()" [disabled]="saving">Cancelar</button>
            <button class="btn-primary" (click)="saveVariant()" [disabled]="saving">
              {{ saving ? 'Guardando...' : 'Agregar variante' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .page { padding: 1.5rem; }
    .page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .page-header h2 { margin: 0; font-size: 1.3rem; flex: 1; }
    .count { background: var(--bg-secondary); color: var(--text-secondary); font-size: 0.8rem; padding: 2px 8px; border-radius: 12px; }

    .alert-error { background: var(--danger-bg); border: 1px solid var(--danger-border); color: var(--danger-text);
      padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1rem; }
    .alert-error.small { padding: 0.5rem 0.75rem; font-size: 0.875rem; margin-bottom: 0.75rem; }
    .alert-success { background: var(--success-bg); border: 1px solid var(--success-border); color: var(--success-text);
      padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1rem; }

    .loading { text-align: center; padding: 3rem; color: var(--text-secondary); }

    /* Product card */
    .product-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .product-card {
      border: 1px solid var(--border); border-radius: 10px; overflow: hidden;
      transition: opacity 0.2s;
    }
    .product-card.inactive { opacity: 0.6; }

    .product-header {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;
      padding: 0.9rem 1.25rem; background: var(--bg-secondary);
    }
    .product-title { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .product-name { font-weight: 600; font-size: 0.95rem; }
    .product-category { font-size: 0.8rem; color: var(--text-secondary); }
    .badge-inactive { background: var(--danger-bg); color: var(--danger); font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; }
    .badge-custom { background: var(--info-bg); color: var(--info-text); font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; }

    .product-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .expand-btn { background: none; border: none; cursor: pointer; color: var(--primary);
      font-size: 0.82rem; padding: 4px 8px; border-radius: 6px; }
    .expand-btn:hover { background: var(--bg-secondary); }
    .btn-edit { font-size: 0.8rem; padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--bg-card); cursor: pointer; color: var(--text); }
    .btn-edit:hover { background: var(--bg-secondary); }
    .btn-toggle { font-size: 0.8rem; padding: 4px 12px; border-radius: 6px; border: 1px solid; cursor: pointer; }
    .btn-activate   { background: var(--success-bg); border-color: var(--success-border); color: var(--success); }
    .btn-deactivate { background: var(--danger-bg); border-color: var(--danger-border); color: var(--danger); }

    /* Variants table */
    .variants-section { border-top: 1px solid var(--border); }
    .variants-toolbar { padding: 0.6rem 1.25rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border); }
    .btn-add-variant {
      background: var(--success-bg); border: 1px solid var(--success-border); color: var(--success);
      font-size: 0.8rem; padding: 4px 12px; border-radius: 6px; cursor: pointer;
    }
    .btn-add-variant:hover { background: var(--success-bg); }
    .variants-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .variants-table thead { background: var(--bg-secondary); }
    .variants-table th { padding: 0.6rem 1rem; text-align: left; font-size: 0.78rem;
      color: var(--text-secondary); font-weight: 600; text-transform: uppercase; }
    .variants-table td { padding: 0.6rem 1rem; border-top: 1px solid var(--border); }
    .sku { font-family: monospace; font-size: 0.8rem; color: var(--text-secondary); }
    .empty-variants { text-align: center; color: var(--text-secondary); font-size: 0.875rem; padding: 1rem; }

    .editable { cursor: pointer; border-bottom: 1px dashed var(--info-border); padding-bottom: 1px; }
    .editable:hover { color: var(--primary); }
    .low-stock { color: var(--danger); font-weight: 600; }

    .edit-input { width: 80px; padding: 3px 6px; border: 1px solid var(--primary);
      border-radius: 4px; font-size: 0.875rem; }

    .variant-actions { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
    .btn-save { background: var(--primary); color: white; border: none;
      border-radius: 4px; padding: 3px 10px; cursor: pointer; font-size: 0.8rem; }
    .btn-cancel { background: none; border: 1px solid var(--border); border-radius: 4px;
      padding: 3px 6px; cursor: pointer; font-size: 0.8rem; }
    .btn-delete-variant { background: none; border: none; cursor: pointer;
      color: var(--text-secondary); font-size: 1rem; padding: 2px 4px; }
    .btn-delete-variant:hover { color: var(--danger); }

    /* Stock button accent */
    .btn-stock { color: var(--success) !important; }
    .btn-stock:hover { background: var(--success-bg) !important; }

    /* Stock section */
    .stock-section { border-top: 1px solid var(--border); padding: 1rem 1.25rem; }
    .stock-legend {
      display: flex; gap: 1.25rem; margin-bottom: 0.75rem;
      font-size: 0.75rem; color: var(--text-secondary);
    }
    .stock-legend span { display: flex; align-items: center; gap: 0.3rem; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .dot-total    { background: var(--text-secondary); }
    .dot-reserved { background: var(--warning); }
    .dot-available{ background: var(--success); }

    .stock-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .stock-table thead { background: var(--bg-secondary); }
    .stock-table th {
      padding: 0.6rem 0.75rem; text-align: left; font-size: 0.75rem;
      color: var(--text-secondary); font-weight: 600; text-transform: uppercase;
    }
    .stock-table th.text-center { text-align: center; }
    .stock-table td { padding: 0.6rem 0.75rem; border-top: 1px solid var(--border); vertical-align: middle; }
    .stock-table td.text-center { text-align: center; }
    .stock-table .low-row { background: var(--warning-bg); }

    .variant-label { display: flex; gap: 0.35rem; align-items: center; }
    .color-pill {
      background: var(--bg-secondary); color: var(--text); border-radius: 12px;
      padding: 2px 8px; font-size: 0.78rem;
    }
    .size-pill {
      background: var(--info-bg); color: var(--info-text); border-radius: 12px;
      padding: 2px 8px; font-size: 0.78rem; font-weight: 600;
    }

    .stock-num      { color: var(--text); font-weight: 600; }
    .stock-reserved { color: var(--warning); font-weight: 500; }
    .stock-available { font-weight: 700; color: var(--success); }
    .stock-available.low-stock { color: var(--danger); }

    .adjust-cell { min-width: 300px; }
    .adjust-row { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
    .adj-btn {
      width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--bg-card); cursor: pointer; font-size: 1rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center; color: var(--text);
      flex-shrink: 0;
    }
    .adj-btn.plus:hover  { background: var(--success-bg); border-color: var(--success-border); color: var(--success); }
    .adj-btn.minus:hover { background: var(--danger-bg); border-color: var(--danger-border); color: var(--danger); }
    .adj-input {
      width: 60px; height: 28px; border: 1px solid var(--border); border-radius: 6px;
      text-align: center; font-size: 0.875rem; padding: 0;
    }
    .adj-input:focus { outline: none; border-color: var(--primary); }
    .btn-reponer {
      padding: 4px 10px; border-radius: 6px; border: 1px solid var(--success-border);
      background: var(--success-bg); color: var(--success); font-size: 0.78rem; font-weight: 600;
      cursor: pointer; white-space: nowrap;
    }
    .btn-reponer:hover:not(:disabled) { background: var(--success-bg); }
    .btn-reponer:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-descontar {
      padding: 4px 10px; border-radius: 6px; border: 1px solid var(--danger-border);
      background: var(--danger-bg); color: var(--danger); font-size: 0.78rem; font-weight: 600;
      cursor: pointer; white-space: nowrap;
    }
    .btn-descontar:hover:not(:disabled) { background: var(--danger-bg); }
    .btn-descontar:disabled { opacity: 0.45; cursor: not-allowed; }
    .saving-dot { color: var(--text-secondary); font-size: 1rem; }
    .adj-warning { display: block; font-size: 0.72rem; color: var(--danger); margin-top: 3px; }

    /* Images section */
    .images-section { border-top: 1px solid var(--border); padding: 1rem 1.25rem; }
    .upload-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
    .upload-btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.4rem 0.85rem; background: var(--bg-secondary); color: var(--primary);
      border: 1px solid var(--border); border-radius: 6px; cursor: pointer;
      font-size: 0.82rem; font-weight: 500; transition: background .15s;
    }
    .upload-btn:hover { background: var(--bg-secondary); }
    .uploading-msg { font-size: 0.82rem; color: var(--text-secondary); }
    .no-images { color: var(--text-secondary); font-size: 0.875rem; padding: 1rem 0; }

    .image-grid { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .image-card {
      position: relative; width: 100px; height: 100px;
      border-radius: 8px; overflow: hidden; border: 2px solid var(--border);
      background: var(--bg-secondary);
    }
    .image-card.primary-card { border-color: var(--primary); }
    .image-card img { width: 100%; height: 100%; object-fit: cover; }
    .image-overlay {
      position: absolute; inset: 0;
      background: var(--overlay);
      display: flex; align-items: center; justify-content: center; gap: 0.4rem;
      opacity: 0; transition: opacity .15s;
    }
    .image-card:hover .image-overlay { opacity: 1; }
    .img-action {
      background: rgba(255,255,255,.9); border: none; border-radius: 4px;
      width: 28px; height: 28px; cursor: pointer; font-size: 0.8rem;
      display: flex; align-items: center; justify-content: center;
    }
    .img-action:hover { background: var(--bg-card); }
    .img-action.danger:hover { background: var(--danger-bg); }
    .primary-badge {
      background: var(--primary); color: white;
      font-size: 0.65rem; font-weight: 600; padding: 2px 6px; border-radius: 4px;
    }

    /* Pagination */
    .pagination { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 1rem; }
    .pagination button { width: 32px; height: 32px; border: 1px solid var(--border);
      border-radius: 6px; background: var(--bg-card); cursor: pointer; font-size: 0.85rem; }
    .pagination button.active { background: var(--primary); color: white; border-color: transparent; }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Modal */
    .modal-backdrop {
      position: fixed; inset: 0; background: var(--overlay);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
      padding: 1rem;
    }
    .modal {
      background: var(--bg-card); border-radius: 12px; width: 100%; max-width: 540px;
      max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.15);
    }
    .modal.modal-sm { max-width: 420px; }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border);
    }
    .modal-header h3 { margin: 0; font-size: 1.05rem; }
    .modal-close { background: none; border: none; cursor: pointer; font-size: 1.1rem; color: var(--text-secondary); }
    .modal-close:hover { color: var(--text); }
    .modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 0.75rem;
      padding: 1rem 1.5rem; border-top: 1px solid var(--border);
    }

    /* Form elements */
    .form-row { display: flex; flex-direction: column; gap: 4px; }
    .form-row label { font-size: 0.875rem; font-weight: 500; color: var(--text); }
    .form-row small { color: var(--text-secondary); font-size: 0.78rem; margin-top: 2px; }
    .form-row input,
    .form-row select,
    .form-row textarea {
      padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 6px;
      font-size: 0.9rem; outline: none; transition: border-color .15s;
      font-family: inherit;
    }
    .form-row input:focus,
    .form-row select:focus,
    .form-row textarea:focus { border-color: var(--primary); }
    .form-row textarea { resize: vertical; min-height: 80px; }
    .form-row-check label { display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.875rem; cursor: pointer; }
    .form-row-check input[type=checkbox] { width: 16px; height: 16px; cursor: pointer; }

    /* Buttons */
    .btn-primary {
      background: var(--primary); color: white; border: none;
      border-radius: 8px; padding: 0.5rem 1.25rem; cursor: pointer;
      font-size: 0.875rem; font-weight: 500; transition: background .15s;
    }
    .btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      background: var(--bg-card); color: var(--text); border: 1px solid var(--border);
      border-radius: 8px; padding: 0.5rem 1.25rem; cursor: pointer;
      font-size: 0.875rem; font-weight: 500;
    }
    .btn-secondary:hover:not(:disabled) { background: var(--bg-secondary); }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
  `],
})
export class AdminProductsComponent implements OnInit {
  private http = inject(HttpClient);
  private categoryService = inject(CategoryService);
  private readonly apiUrl = `${environment.apiUrl}/admin/products`;

  products: AdminProduct[] = [];
  categories: Category[] = [];
  loading = true;
  errorMessage = '';
  successMessage = '';
  currentPage = 0;
  totalPages = 0;
  totalElements = 0;
  pageSize = 10;

  expandedId: number | null = null;
  activeTab: 'variants' | 'images' | 'stock' = 'variants';
  editingVariantId: number | null = null;
  editingField: 'price' | 'stock' | null = null;
  editValue: number = 0;
  uploadingForProductId: number | null = null;

  // Stock adjustment state: variantId → quantity to adjust
  stockAdj: Map<number, number> = new Map();
  savingStockId: number | null = null;

  // Modal state
  showProductModal = false;
  showVariantModal = false;
  editingProductId: number | null = null;
  addVariantForProductId: number | null = null;
  saving = false;
  modalError = '';

  productForm: ProductForm = this.emptyProductForm();
  variantForm: VariantForm = this.emptyVariantForm();

  ngOnInit(): void {
    this.loadPage(0);
    this.loadCategories();
  }

  loadPage(page: number): void {
    this.loading = true;
    this.http.get<{ content: AdminProduct[]; totalElements: number; totalPages: number }>(
      `${this.apiUrl}?page=${page}&size=${this.pageSize}&sort=name,asc`
    ).subscribe({
      next: (r) => {
        this.products = r.content;
        this.totalElements = r.totalElements;
        this.totalPages = r.totalPages;
        this.currentPage = page;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.error || 'Error al cargar los productos';
        this.loading = false;
      },
    });
  }

  loadCategories(): void {
    this.categoryService.listRoots().subscribe({
      next: (cats) => { this.categories = cats; },
      error: () => {},
    });
  }

  // ── Create / Edit Product Modal ───────────────────────────────────────────

  openCreateModal(): void {
    this.editingProductId = null;
    this.productForm = this.emptyProductForm();
    this.modalError = '';
    this.showProductModal = true;
  }

  openEditModal(product: AdminProduct): void {
    this.editingProductId = product.id;
    this.productForm = {
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      categoryId: product.categoryId || null,
      customizable: product.customizable,
      active: product.active,
    };
    this.modalError = '';
    this.showProductModal = true;
  }

  closeProductModal(): void {
    this.showProductModal = false;
    this.editingProductId = null;
    this.modalError = '';
  }

  saveProduct(): void {
    if (!this.productForm.name?.trim()) {
      this.modalError = 'El nombre es obligatorio.';
      return;
    }
    this.saving = true;
    this.modalError = '';

    const req$ = this.editingProductId
      ? this.http.put<AdminProduct>(`${this.apiUrl}/${this.editingProductId}`, this.productForm)
      : this.http.post<AdminProduct>(this.apiUrl, this.productForm);

    req$.subscribe({
      next: (saved) => {
        this.saving = false;
        this.closeProductModal();
        if (this.editingProductId) {
          const idx = this.products.findIndex(p => p.id === saved.id);
          if (idx !== -1) this.products[idx] = { ...this.products[idx], ...saved };
          this.successMessage = 'Producto actualizado.';
        } else {
          this.loadPage(0); // refresh to show new product
          this.successMessage = 'Producto creado correctamente.';
        }
      },
      error: (err) => {
        this.saving = false;
        this.modalError = err.error?.error || 'Error al guardar el producto.';
      },
    });
  }

  // ── Add Variant Modal ─────────────────────────────────────────────────────

  openAddVariantModal(productId: number): void {
    this.addVariantForProductId = productId;
    this.variantForm = this.emptyVariantForm();
    this.modalError = '';
    this.showVariantModal = true;
  }

  closeVariantModal(): void {
    this.showVariantModal = false;
    this.addVariantForProductId = null;
    this.modalError = '';
  }

  saveVariant(): void {
    if (!this.variantForm.color?.trim() || !this.variantForm.size?.trim()) {
      this.modalError = 'Color y Talle son obligatorios.';
      return;
    }
    if (!this.variantForm.priceAmount || this.variantForm.priceAmount <= 0) {
      this.modalError = 'El precio debe ser mayor a cero.';
      return;
    }
    this.saving = true;
    this.modalError = '';

    const payload = {
      ...this.variantForm,
      priceAmount: Math.round(this.variantForm.priceAmount * 100), // pesos → centavos
    };

    this.http.post<AdminVariant>(
      `${this.apiUrl}/${this.addVariantForProductId}/variants`, payload
    ).subscribe({
      next: (variant) => {
        this.saving = false;
        const product = this.products.find(p => p.id === this.addVariantForProductId);
        if (product) {
          if (!product.variants) product.variants = [];
          product.variants.push(variant);
        }
        this.closeVariantModal();
        this.successMessage = `Variante ${variant.color}/${variant.size} agregada.`;
      },
      error: (err) => {
        this.saving = false;
        this.modalError = err.error?.error || 'Error al agregar variante.';
      },
    });
  }

  deleteVariant(product: AdminProduct, variant: AdminVariant): void {
    if (!confirm(`¿Desactivar la variante ${variant.color}/${variant.size}? No se eliminará del historial de pedidos.`)) return;
    this.clearMessages();
    this.http.delete(`${this.apiUrl}/${product.id}/variants/${variant.id}`).subscribe({
      next: () => {
        product.variants = product.variants.filter(v => v.id !== variant.id);
        this.successMessage = 'Variante desactivada.';
      },
      error: (err) => this.errorMessage = err.error?.error || 'Error al eliminar variante',
    });
  }

  // ── Expand / collapse ─────────────────────────────────────────────────────

  toggleExpand(id: number, tab: 'variants' | 'images' | 'stock'): void {
    if (this.expandedId === id && this.activeTab === tab) {
      this.expandedId = null;
    } else {
      this.expandedId = id;
      this.activeTab = tab;
      if (tab === 'images') {
        this.loadImages(id);
      }
    }
    this.cancelEdit();
  }

  loadImages(productId: number): void {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;
    this.http.get<AdminImage[]>(`${this.apiUrl}/${productId}/images`).subscribe({
      next: (images) => { product.images = images; },
      error: () => {},
    });
  }

  getImageUrl(path: string): string {
    return path;
  }

  onImageFileSelected(event: Event, productId: number): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    input.value = '';

    const formData = new FormData();
    formData.append('file', file);

    this.uploadingForProductId = productId;
    this.clearMessages();

    this.http.post<AdminImage>(`${this.apiUrl}/${productId}/images`, formData).subscribe({
      next: (uploaded) => {
        const product = this.products.find(p => p.id === productId);
        if (product) {
          if (!product.images) product.images = [];
          if (uploaded.primary) {
            product.images.forEach(img => img.primary = false);
          }
          product.images.push(uploaded);
        }
        this.uploadingForProductId = null;
        this.successMessage = 'Imagen subida correctamente.';
      },
      error: (err) => {
        this.uploadingForProductId = null;
        this.errorMessage = err.error?.error || 'Error al subir imagen';
      },
    });
  }

  setImagePrimary(product: AdminProduct, img: AdminImage): void {
    this.clearMessages();
    this.http.patch<AdminImage>(`${this.apiUrl}/${product.id}/images/${img.id}/primary`, {}).subscribe({
      next: () => {
        product.images.forEach(i => i.primary = false);
        img.primary = true;
        this.successMessage = 'Imagen principal actualizada.';
      },
      error: (err) => this.errorMessage = err.error?.error || 'Error al actualizar imagen',
    });
  }

  deleteImage(product: AdminProduct, img: AdminImage): void {
    if (!confirm('¿Eliminar esta imagen?')) return;
    this.clearMessages();
    this.http.delete(`${this.apiUrl}/${product.id}/images/${img.id}`).subscribe({
      next: () => {
        product.images = product.images.filter(i => i.id !== img.id);
        if (img.primary && product.images.length > 0) {
          product.images[0].primary = true;
        }
        this.successMessage = 'Imagen eliminada.';
      },
      error: (err) => this.errorMessage = err.error?.error || 'Error al eliminar imagen',
    });
  }

  toggleActive(product: AdminProduct): void {
    this.clearMessages();
    this.http.patch<AdminProduct>(`${this.apiUrl}/${product.id}/active`, { active: !product.active })
      .subscribe({
        next: (updated) => {
          const idx = this.products.findIndex(p => p.id === product.id);
          if (idx !== -1) this.products[idx] = { ...this.products[idx], ...updated };
          this.successMessage = `Producto ${updated.active ? 'activado' : 'desactivado'}.`;
        },
        error: (err) => this.errorMessage = err.error?.error || 'Error al cambiar estado',
      });
  }

  // ── Inline variant editing (price / stock) ────────────────────────────────

  startEditPrice(variant: AdminVariant): void {
    this.editingVariantId = variant.id;
    this.editingField = 'price';
    this.editValue = variant.priceAmount / 100;
  }

  startEditStock(variant: AdminVariant): void {
    this.editingVariantId = variant.id;
    this.editingField = 'stock';
    this.editValue = variant.stockAvailable;
  }

  cancelEdit(): void {
    this.editingVariantId = null;
    this.editingField = null;
  }

  saveEdit(productId: number, variant: AdminVariant): void {
    if (this.editingField === 'price') {
      this.saveVariantPrice(productId, variant);
    } else if (this.editingField === 'stock') {
      this.saveVariantStock(productId, variant);
    }
  }

  saveVariantPrice(productId: number, variant: AdminVariant): void {
    this.clearMessages();
    const priceCentavos = Math.round(this.editValue * 100);
    this.http.patch<AdminVariant>(
      `${this.apiUrl}/${productId}/variants/${variant.id}/price`,
      { price: priceCentavos }
    ).subscribe({
      next: (updated) => {
        variant.priceAmount = updated.priceAmount;
        this.cancelEdit();
        this.successMessage = 'Precio actualizado.';
      },
      error: (err) => this.errorMessage = err.error?.error || 'Error al actualizar precio',
    });
  }

  saveVariantStock(productId: number, variant: AdminVariant): void {
    this.clearMessages();
    this.http.patch<AdminVariant>(
      `${this.apiUrl}/${productId}/variants/${variant.id}/stock`,
      { stock: this.editValue }
    ).subscribe({
      next: (updated) => {
        variant.stockAvailable = updated.stockAvailable;
        this.cancelEdit();
        this.successMessage = 'Stock actualizado.';
      },
      error: (err) => this.errorMessage = err.error?.error || 'Error al actualizar stock',
    });
  }

  // ── Stock adjustment ──────────────────────────────────────────────────────

  getAdj(variantId: number): number {
    return this.stockAdj.get(variantId) ?? 0;
  }

  setAdj(variantId: number, event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    this.stockAdj.set(variantId, isNaN(val) || val < 0 ? 0 : val);
  }

  incrementAdj(variantId: number): void {
    this.stockAdj.set(variantId, this.getAdj(variantId) + 1);
  }

  decrementAdj(variantId: number): void {
    const cur = this.getAdj(variantId);
    if (cur > 0) this.stockAdj.set(variantId, cur - 1);
  }

  adjustStock(productId: number, variant: AdminVariant, sign: 1 | -1): void {
    const qty = this.getAdj(variant.id);
    if (qty <= 0) return;
    const delta = sign * qty;

    this.savingStockId = variant.id;
    this.clearMessages();

    this.http.patch<AdminVariant>(
      `${this.apiUrl}/${productId}/variants/${variant.id}/stock/adjust`,
      { delta }
    ).subscribe({
      next: (updated) => {
        variant.stockAvailable = updated.stockAvailable;
        variant.stockTotal     = updated.stockTotal;
        variant.stockReserved  = updated.stockReserved;
        this.stockAdj.set(variant.id, 0);
        this.savingStockId = null;
        this.successMessage = sign > 0
          ? `✓ Repuestas ${qty} unidades de ${variant.color}/${variant.size}.`
          : `✓ Descontadas ${qty} unidades de ${variant.color}/${variant.size}.`;
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.savingStockId = null;
        this.errorMessage = err.error?.error || 'Error al ajustar el stock';
      },
    });
  }

  // ── Pagination ────────────────────────────────────────────────────────────

  pageNumbers(): number[] {
    const start = Math.max(0, this.currentPage - 2);
    const end = Math.min(this.totalPages, start + 5);
    return Array.from({ length: end - start }, (_, i) => start + i);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private emptyProductForm(): ProductForm {
    return { name: '', slug: '', description: '', categoryId: null, customizable: false, active: true };
  }

  private emptyVariantForm(): VariantForm {
    return { color: '', size: '', priceAmount: 0, stockTotal: 0, sku: '' };
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }
}
