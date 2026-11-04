import { Component, OnInit, OnDestroy, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProductService } from '@core/services/product.service';
import { DesignService } from '@core/services/design.service';
import { CartService } from '@core/services/cart.service';
import { VariantDetail } from '@core/models/product.model';
import { AssetPlacement, TextLayerPlacement } from '@core/models/design.model';
import { KonvaCanvasService } from './konva-canvas.service';

@Component({
  selector: 'app-customizer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [KonvaCanvasService],
  template: `
    <div class="customizer-layout">
      <div class="canvas-area">
        <div #konvaContainer class="konva-container"></div>
      </div>
      <div class="controls">
        <h2>Personalizar</h2>
        @if (variantDetail) {
          <p class="product-name">{{ variantDetail.productName }}</p>
          <p class="variant-info">{{ variantDetail.color }} — {{ variantDetail.size }}</p>
        }

        <!-- Tab navigation -->
        <div class="tab-bar">
          <button class="tab-btn" [class.active]="activeTab === 'image'" (click)="activeTab = 'image'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Imagen
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'text'" (click)="activeTab = 'text'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
            Texto
          </button>
        </div>

        <!-- Image upload tab -->
        @if (activeTab === 'image') {
          <div class="tab-content">
            <label class="upload-btn" [class.disabled]="canvas.assets.length >= maxFiles">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Subir imagen
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                (change)="onFileSelected($event)"
                hidden
                [disabled]="canvas.assets.length >= maxFiles"
              />
            </label>
            <p class="hint">PNG, JPG o WebP. Min 1000px. Max 10MB. ({{ canvas.assets.length }}/{{ maxFiles }})</p>

            @if (canvas.assets.length > 0) {
              <div class="layer-list">
                <div class="layer-list-header">Imágenes ({{ canvas.assets.length }})</div>
                @for (asset of canvas.assets; track $index; let i = $index) {
                  <div class="layer-item" (click)="canvas.selectAsset(i)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <span>Imagen {{ i + 1 }}</span>
                    <span class="layer-status" [class.uploaded]="asset.uploaded">
                      {{ asset.uploaded ? '✓' : '◌' }}
                    </span>
                    <button class="btn-remove" (click)="canvas.removeAsset(i); $event.stopPropagation()">✕</button>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Text layer tab -->
        @if (activeTab === 'text') {
          <div class="tab-content">
            <div class="form-group">
              <label class="form-label">Texto</label>
              <textarea
                class="text-input"
                rows="2"
                [(ngModel)]="newText"
                placeholder="Ej: ¡Tu nombre aquí!"
                maxlength="100"
              ></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Fuente</label>
              <select class="form-select" [(ngModel)]="newFontFamily">
                @for (f of fontFamilies; track f) {
                  <option [value]="f">{{ f }}</option>
                }
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Tamaño ({{ newFontSize }}px)</label>
              <input type="range" min="12" max="120" step="2" [(ngModel)]="newFontSize" class="range-input" />
            </div>

            <div class="form-group">
              <label class="form-label">Color</label>
              <div class="color-row">
                <input type="color" [(ngModel)]="newFill" class="color-picker" />
                <div class="color-swatches">
                  @for (c of colorSwatches; track c) {
                    <button
                      class="color-swatch"
                      [style.background]="c"
                      [class.selected]="newFill === c"
                      (click)="newFill = c"
                    ></button>
                  }
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Estilo</label>
              <div class="style-row">
                <button class="style-btn" [class.active]="isBold" (click)="isBold = !isBold">
                  <strong>B</strong>
                </button>
                <button class="style-btn" [class.active]="isItalic" (click)="isItalic = !isItalic">
                  <em>I</em>
                </button>
              </div>
            </div>

            <button class="btn-add-text" [disabled]="!newText.trim()" (click)="addTextLayer()">
              + Agregar al canvas
            </button>

            @if (canvas.textLayers.length > 0) {
              <div class="layer-list" style="margin-top: 1rem;">
                <div class="layer-list-header">Textos ({{ canvas.textLayers.length }})</div>
                @for (tl of canvas.textLayers; track tl.id; let i = $index) {
                  <div class="layer-item" (click)="canvas.selectTextLayer(i)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                    <span class="layer-preview">{{ tl.konvaNode.text() | slice:0:18 }}{{ tl.konvaNode.text().length > 18 ? '…' : '' }}</span>
                    <button class="btn-remove" (click)="canvas.removeTextLayer(i); $event.stopPropagation()">✕</button>
                  </div>
                }
              </div>
            }
          </div>
        }

        @if (errorMessage) {
          <div class="error">{{ errorMessage }}</div>
        }

        <button
          class="btn-primary"
          (click)="saveAndAddToCart()"
          [disabled]="saving || (canvas.assets.length === 0 && canvas.textLayers.length === 0)"
        >
          @if (saving) { {{ savingStep }} } @else { Guardar y agregar al carrito }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .customizer-layout { display: grid; grid-template-columns: 1fr 320px; height: calc(100vh - 60px); }
    .canvas-area { display: flex; align-items: center; justify-content: center; background: var(--bg-secondary); overflow: hidden; }
    .konva-container { width: 600px; height: 600px; background: var(--bg-card); border: 1px solid var(--border); box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .controls { padding: 1.25rem; border-left: 1px solid var(--border); overflow-y: auto; display: flex; flex-direction: column; gap: 0; }
    .product-name { font-weight: 600; margin: 0 0 2px; }
    .variant-info { font-size: 0.82rem; color: var(--text-secondary); margin: 0 0 1rem; }
    .tab-bar { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 1rem; }
    .tab-btn { flex: 1; padding: 0.5rem; background: none; border: none; border-bottom: 2px solid transparent; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.35rem; color: var(--text-secondary); margin-bottom: -1px; transition: all .15s; }
    .tab-btn.active { border-bottom-color: var(--primary); color: var(--primary); font-weight: 600; }
    .tab-content { display: flex; flex-direction: column; gap: 0.75rem; }
    .upload-btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.9rem; background: var(--primary-light); color: var(--primary); border: 1px solid var(--primary-light); border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 500; transition: background .15s; align-self: flex-start; }
    .upload-btn:hover { background: #f8e4f8; } /* brand light pink hover */
    .upload-btn.disabled { opacity: 0.5; cursor: not-allowed; }
    .hint { font-size: 0.75rem; color: var(--text-secondary); margin: 0; }
    .layer-list { border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
    .layer-list-header { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); padding: 0.4rem 0.75rem; background: var(--bg-secondary); text-transform: uppercase; letter-spacing: .04em; }
    .layer-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.75rem; border-top: 1px solid var(--border); font-size: 0.82rem; cursor: pointer; transition: background .1s; }
    .layer-item:hover { background: var(--bg-secondary); }
    .layer-item svg { flex-shrink: 0; color: var(--text-secondary); }
    .layer-item span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .layer-status { font-size: 0.75rem; color: var(--text-secondary); }
    .layer-status.uploaded { color: var(--success-text); }
    .layer-preview { color: var(--text); }
    .form-group { display: flex; flex-direction: column; gap: 0.3rem; }
    .form-label { font-size: 0.78rem; font-weight: 600; color: var(--text); }
    .text-input { width: 100%; padding: 0.45rem 0.6rem; border: 1px solid var(--border); border-radius: 6px; font-size: 0.85rem; resize: vertical; font-family: inherit; box-sizing: border-box; }
    .text-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-light); }
    .form-select { width: 100%; padding: 0.4rem 0.6rem; border: 1px solid var(--border); border-radius: 6px; font-size: 0.85rem; background: var(--bg-card); box-sizing: border-box; }
    .range-input { width: 100%; accent-color: var(--primary); }
    .color-row { display: flex; align-items: center; gap: 0.5rem; }
    .color-picker { width: 36px; height: 36px; padding: 0; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; background: none; }
    .color-swatches { display: flex; flex-wrap: wrap; gap: 4px; }
    .color-swatch { width: 22px; height: 22px; border-radius: 4px; border: 2px solid transparent; cursor: pointer; transition: transform .1s; }
    .color-swatch:hover { transform: scale(1.15); }
    .color-swatch.selected { border-color: var(--primary); }
    .style-row { display: flex; gap: 0.4rem; }
    .style-btn { width: 36px; height: 36px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card); cursor: pointer; font-size: 1rem; transition: all .1s; }
    .style-btn.active { background: var(--primary-light); border-color: var(--primary); color: var(--primary); }
    .btn-add-text { width: 100%; padding: 0.5rem; background: var(--primary); color: white; border: none; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: background .15s; margin-top: 0.25rem; }
    .btn-add-text:hover { background: var(--primary-dark); }
    .btn-add-text:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-remove { background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 0.9rem; padding: 0 2px; flex-shrink: 0; }
    .btn-remove:hover { color: var(--danger); }
    .btn-primary { width: 100%; padding: 0.75rem; margin-top: auto; padding-top: 1rem; background: var(--primary); color: white; border: none; border-radius: var(--radius); font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: background .15s; }
    .btn-primary:hover { background: var(--primary-dark); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .error { background: var(--danger-bg); color: var(--danger); padding: 0.75rem; border-radius: var(--radius); margin: 0.5rem 0; font-size: 0.85rem; }
  `],
})
export class CustomizerComponent implements OnInit, OnDestroy {
  @ViewChild('konvaContainer', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private designService = inject(DesignService);
  private cartService = inject(CartService);
  readonly canvas = inject(KonvaCanvasService);

  variantDetail: VariantDetail | null = null;
  variantId!: number;
  saving = false;
  savingStep = '';
  errorMessage = '';
  maxFiles = 5;

  activeTab: 'image' | 'text' = 'image';

  // ── Text form state ──────────────────────────────────────────────────────
  newText = '';
  newFontFamily = 'Arial';
  newFontSize = 36;
  newFill = '#1a1a1a';
  isBold = false;
  isItalic = false;

  readonly fontFamilies = ['Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New', 'Impact', 'Trebuchet MS'];
  readonly colorSwatches = ['#1a1a1a', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#e020c8', '#a855f7'];

  ngOnInit(): void {
    this.variantId = Number(this.route.snapshot.paramMap.get('variantId'));
    this.canvas.init(this.containerRef.nativeElement);
    this.loadVariant(this.variantId);
  }

  ngOnDestroy(): void {
    this.canvas.ngOnDestroy();
  }

  private loadVariant(variantId: number): void {
    this.productService.getVariantDetail(variantId).subscribe({
      next: (detail) => {
        this.variantDetail = detail;
        if (detail.printArea) {
          this.canvas.updatePrintArea(detail.printArea);
        }
        const primaryImg = detail.images.find(img => img.primary) ?? detail.images[0];
        this.canvas.loadMockup(primaryImg?.imageUrl ?? null);
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar el producto. Verificá que la variante exista.';
      },
    });
  }

  // ── File upload ──────────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    this.errorMessage = '';
    input.value = '';

    if (this.canvas.assets.length >= this.maxFiles) {
      this.errorMessage = `Máximo ${this.maxFiles} imágenes por diseño`;
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.errorMessage = 'El archivo excede 10MB';
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.errorMessage = 'Formato no soportado. Usa PNG, JPG o WebP.';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageObj = new Image();
      imageObj.onload = () => {
        if (Math.max(imageObj.width, imageObj.height) < 1000) {
          this.errorMessage = 'La imagen debe tener al menos 1000px en su lado más largo';
          return;
        }
        this.canvas.addImage(imageObj, file);
      };
      imageObj.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  // ── Text layer ───────────────────────────────────────────────────────────

  addTextLayer(): void {
    const text = this.newText.trim();
    if (!text) return;
    this.errorMessage = '';
    this.canvas.addText(text, this.newFontFamily, this.newFontSize, this.currentFontStyle, this.newFill);
    this.newText = '';
  }

  get currentFontStyle(): string {
    if (this.isBold && this.isItalic) return 'bold italic';
    if (this.isBold) return 'bold';
    if (this.isItalic) return 'italic';
    return 'normal';
  }

  // ── Save flow ────────────────────────────────────────────────────────────

  async saveAndAddToCart(): Promise<void> {
    if (this.canvas.assets.length === 0 && this.canvas.textLayers.length === 0) return;

    this.saving = true;
    this.errorMessage = '';
    let createdDesignId: number | null = null;

    try {
      this.savingStep = 'Creando diseño...';
      const design = await firstValueFrom(this.designService.create({
        productVariantId: this.variantId,
        assets: [],
      }));
      if (!design) throw new Error('No se pudo crear el diseño');
      createdDesignId = design.designId;

      for (let i = 0; i < this.canvas.assets.length; i++) {
        const asset = this.canvas.assets[i];
        this.savingStep = `Subiendo imagen ${i + 1} de ${this.canvas.assets.length}...`;
        let uploadResult;
        try {
          uploadResult = await firstValueFrom(this.designService.uploadAsset(design.designId, asset.file));
        } catch {
          throw new Error(`No se pudo subir la imagen ${i + 1} de ${this.canvas.assets.length}. Verificá tu conexión e intentá de nuevo.`);
        }
        if (!uploadResult) throw new Error(`Error al subir imagen ${i + 1}`);
        asset.uploaded = true;
        asset.backendAssetId = uploadResult.assetId;
      }

      this.savingStep = 'Guardando diseño...';
      const assetPlacements: AssetPlacement[] = this.canvas.assets.map((asset, i) => ({
        assetId: asset.backendAssetId!,
        x: asset.konvaNode.x(),
        y: asset.konvaNode.y(),
        scaleX: asset.konvaNode.scaleX(),
        scaleY: asset.konvaNode.scaleY(),
        rotation: asset.konvaNode.rotation(),
        zIndex: i,
      }));

      const textLayerPlacements: TextLayerPlacement[] = this.canvas.textLayers.map((tl, i) => ({
        text: tl.konvaNode.text(),
        fontFamily: tl.konvaNode.fontFamily(),
        fontSize: tl.konvaNode.fontSize(),
        fontStyle: tl.konvaNode.fontStyle(),
        fill: tl.konvaNode.fill() as string,
        x: tl.konvaNode.x(),
        y: tl.konvaNode.y(),
        scaleX: tl.konvaNode.scaleX(),
        scaleY: tl.konvaNode.scaleY(),
        rotation: tl.konvaNode.rotation(),
        zIndex: this.canvas.assets.length + i,
      }));

      await firstValueFrom(this.designService.updateScene(design.designId, {
        assets: assetPlacements,
        textLayers: textLayerPlacements,
      }));

      this.savingStep = 'Agregando al carrito...';
      await firstValueFrom(this.cartService.addItem({
        productVariantId: this.variantId,
        quantity: 1,
        customDesignId: design.designId,
      }));

      this.router.navigate(['/cart']);
    } catch (err: unknown) {
      if (createdDesignId !== null) {
        this.designService.delete(createdDesignId).subscribe({ error: () => {} });
      }
      this.canvas.assets.forEach(a => { a.uploaded = false; a.backendAssetId = null; });
      this.saving = false;
      this.savingStep = '';
      const e = err as any;
      this.errorMessage = e?.message || e?.error?.error || 'Error al guardar el diseño. Intentá de nuevo.';
    }
  }
}
