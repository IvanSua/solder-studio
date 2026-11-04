import { Component, Input, Output, EventEmitter, signal, computed, ChangeDetectionStrategy, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '@core/models/product.model';
import { PricePipe } from '@shared/pipes/price.pipe';

@Component({
  selector: 'app-quick-buy-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (product) {
      <div class="modal-overlay" (click)="close.emit()">
        <div class="modal-content" role="dialog" aria-modal="true" [attr.aria-label]="'Compra rápida: ' + product.name" (click)="$event.stopPropagation()">
          <button class="modal-close" type="button" (click)="close.emit()" aria-label="Cerrar">✕</button>
          <div class="modal-body">
            <div class="qb-image-section">
              @if (product.images.length > 0) {
                <img [src]="product.images[0].imageUrl" [alt]="product.name" loading="lazy" />
              } @else {
                <div class="qb-img-placeholder">
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--border)">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
              }
            </div>
            <div class="qb-info-section">
              <h3 class="qb-title">{{ product.name }}</h3>
              @if (product.variants.length > 0) {
                <p class="qb-price">{{ product.variants[0].priceAmount | price }}</p>
              }

              <!-- Color Selector -->
              @if (availableColors().length > 0) {
                <div class="qb-selector">
                  <label class="qb-label">Color</label>
                  <div class="qb-options">
                    @for (color of availableColors(); track color) {
                      <button
                        class="qb-option"
                        [class.active]="selectedColor() === color"
                        (click)="selectedColor.set(color)">
                        {{ color }}
                      </button>
                    }
                  </div>
                </div>
              }

              <!-- Size Selector -->
              @if (availableSizes().length > 0) {
                <div class="qb-selector">
                  <label class="qb-label">Talle</label>
                  <div class="qb-options">
                    @for (size of availableSizes(); track size) {
                      <button
                        class="qb-option"
                        [class.active]="selectedSize() === size"
                        (click)="selectedSize.set(size)">
                        {{ size }}
                      </button>
                    }
                  </div>
                </div>
              }

              <!-- Quantity -->
              <div class="qb-selector">
                <label class="qb-label">Cantidad</label>
                <div class="qb-quantity">
                  <button type="button" (click)="decrementQty()" [disabled]="qty() <= 1" aria-label="Disminuir cantidad">−</button>
                  <input type="number" [ngModel]="qty()" (ngModelChange)="qty.set(+$event)" [ngModelOptions]="{updateOn: 'blur'}" class="qty-input" aria-label="Cantidad" />
                  <button type="button" (click)="incrementQty()" aria-label="Aumentar cantidad">+</button>
                </div>
              </div>

              <button class="qb-add-btn" (click)="onAddToCart()">Agregar al carrito</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
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
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .modal-content {
      background: var(--bg-card);
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      position: relative;
      animation: scaleIn 0.3s ease;
    }
    @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    .modal-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--text-secondary);
      z-index: 10;
      transition: color 0.2s;
    }
    .modal-close:hover { color: var(--text); }

    .modal-body {
      padding: 2rem;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }

    .qb-image-section {
      aspect-ratio: 1;
      background: var(--bg-secondary);
      border-radius: 8px;
      overflow: hidden;
    }
    .qb-image-section img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .qb-img-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .qb-info-section {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .qb-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0;
      line-height: 1.4;
    }

    .qb-price {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--primary);
      margin: 0;
    }

    .qb-selector {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .qb-label {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text);
    }

    .qb-options {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .qb-option {
      padding: 0.5rem 1rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg-card);
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
    }
    .qb-option:hover { border-color: var(--primary); background: var(--primary-soft, rgba(224,32,200,0.06)); }
    .qb-option.active {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
    }

    .qb-quantity {
      display: flex;
      align-items: center;
      border: 1px solid var(--border);
      border-radius: 8px;
      width: fit-content;
    }
    .qb-quantity button {
      background: none;
      border: none;
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      font-size: 1rem;
      color: var(--primary);
      transition: background 0.15s;
    }
    .qb-quantity button:hover:not(:disabled) { background: var(--bg-secondary); }
    .qb-quantity button:disabled { opacity: 0.4; cursor: not-allowed; }
    .qty-input {
      border: none;
      outline: none;
      width: 50px;
      text-align: center;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text);
    }

    .qb-add-btn {
      padding: 0.75rem 1.5rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 700;
      transition: background 0.2s;
      width: 100%;
      margin-top: 1rem;
    }
    .qb-add-btn:hover { background: var(--primary-dark); }

    @media (max-width: 600px) {
      .modal-body {
        grid-template-columns: 1fr;
        gap: 1rem;
      }
    }
  `],
})
export class QuickBuyModalComponent implements OnChanges {
  @Input() product: Product | null = null;
  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() close = new EventEmitter<void>();
  @Output() addToCart = new EventEmitter<{ productVariantId: number; quantity: number }>();

  selectedColor = signal('');
  selectedSize = signal('');
  qty = signal(1);

  availableColors = computed(() => {
    if (!this.product) return [];
    const variants = this.product.variants;
    return [...new Set(variants.map(v => v.color).filter(Boolean))];
  });

  availableSizes = computed(() => {
    if (!this.product || !this.selectedColor()) return [];
    const variants = this.product.variants;
    return [...new Set(variants.filter(v => v.color === this.selectedColor()).map(v => v.size).filter(Boolean))];
  });

  ngOnChanges(): void {
    if (this.product?.variants.length) {
      this.selectedColor.set(this.product.variants[0]?.color ?? '');
      this.selectedSize.set(this.product.variants[0]?.size ?? '');
      this.qty.set(1);
    }
  }

  incrementQty(): void {
    this.qty.update(q => q + 1);
  }

  decrementQty(): void {
    if (this.qty() > 1) {
      this.qty.update(q => q - 1);
    }
  }

  onAddToCart(): void {
    if (!this.product) return;

    const variant = this.product.variants.find(
      v => v.color === this.selectedColor() && v.size === this.selectedSize()
    );

    if (!variant) {
      alert('Por favor selecciona color y talle');
      return;
    }

    this.addToCart.emit({ productVariantId: variant.id, quantity: this.qty() });
    this.close.emit();
  }
}
