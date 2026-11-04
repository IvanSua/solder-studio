import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

interface Category {
  id: number;
  name: string;
  parentName: string | null;
}

interface UploadItem {
  id: string;
  file: File;
  preview: string;
  name: string;
  categoryId: number | null;
  price: number | null;         // en pesos
  status: 'pending' | 'uploading' | 'done' | 'error';
  error: string;
  productId: number | null;
}

@Component({
  selector: 'app-admin-bulk-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>⬆ Subida masiva de productos</h1>
          <p>Subí varias imágenes a la vez, asignalas a una categoría y creá los productos automáticamente.</p>
        </div>
      </div>

      <!-- STEP 1: Global settings -->
      <div class="settings-card">
        <h2>1. Configuración global</h2>
        <div class="settings-row">
          <div class="field">
            <label>Categoría por defecto *</label>
            <select [(ngModel)]="globalCategoryId">
              <option [ngValue]="null">— Seleccioná una categoría —</option>
              @for (cat of categories(); track cat.id) {
                <option [ngValue]="cat.id">
                  {{ cat.parentName ? cat.parentName + ' › ' : '' }}{{ cat.name }}
                </option>
              }
            </select>
          </div>
          <div class="field">
            <label>Precio por defecto (opcional, en $)</label>
            <input type="number" [(ngModel)]="globalPrice" placeholder="Ej: 15000" min="0" />
          </div>
          <div class="field apply-col">
            <label>&nbsp;</label>
            <button class="btn-apply" (click)="applyGlobalSettings()" [disabled]="items().length === 0">
              Aplicar a todos
            </button>
          </div>
        </div>
      </div>

      <!-- STEP 2: Drop zone -->
      <div class="settings-card">
        <h2>2. Seleccioná las imágenes</h2>
        <div
          class="drop-zone"
          [class.drag-over]="isDragging"
          (dragover)="onDragOver($event)"
          (dragleave)="isDragging = false"
          (drop)="onDrop($event)"
          (click)="fileInput.click()"
        >
          <div class="drop-icon">🖼️</div>
          <p class="drop-text">Arrastrá las imágenes acá o hacé clic para elegirlas</p>
          <p class="drop-sub">JPG, PNG, WEBP — Máximo 10 MB por imagen</p>
          <input #fileInput type="file" multiple accept="image/*" (change)="onFilesSelected($event)" hidden />
        </div>
        @if (items().length > 0) {
          <div class="items-count">
            <span>{{ items().length }} imagen{{ items().length !== 1 ? 'es' : '' }} seleccionada{{ items().length !== 1 ? 's' : '' }}</span>
            <button class="btn-clear" (click)="clearAll()">✕ Limpiar todo</button>
          </div>
        }
      </div>

      <!-- STEP 3: Preview grid -->
      @if (items().length > 0) {
        <div class="settings-card">
          <h2>3. Revisá y editá cada producto</h2>
          <p class="hint-text">Podés cambiar el nombre, categoría y precio de cada imagen antes de subir.</p>

          <div class="grid">
            @for (item of items(); track item.id) {
              <div class="item-card" [class.done]="item.status === 'done'" [class.error]="item.status === 'error'" [class.uploading]="item.status === 'uploading'">

                <!-- Status overlay -->
                @if (item.status === 'uploading') {
                  <div class="status-overlay uploading-overlay">
                    <div class="spinner-lg"></div>
                    <span>Subiendo...</span>
                  </div>
                }
                @if (item.status === 'done') {
                  <div class="status-overlay done-overlay">
                    <span class="check-icon">✓</span>
                    <span>¡Listo!</span>
                  </div>
                }
                @if (item.status === 'error') {
                  <div class="status-overlay error-overlay">
                    <span class="err-icon">✕</span>
                    <span>{{ item.error }}</span>
                  </div>
                }

                <img [src]="item.preview" [alt]="item.name" class="thumb" />

                <div class="item-fields">
                  <div class="item-field">
                    <label>Nombre del producto</label>
                    <input type="text" [(ngModel)]="item.name" placeholder="Nombre..." [disabled]="item.status === 'done'" />
                  </div>
                  <div class="item-field">
                    <label>Categoría</label>
                    <select [(ngModel)]="item.categoryId" [disabled]="item.status === 'done'">
                      <option [ngValue]="null">— Sin categoría —</option>
                      @for (cat of categories(); track cat.id) {
                        <option [ngValue]="cat.id">
                          {{ cat.parentName ? cat.parentName + ' › ' : '' }}{{ cat.name }}
                        </option>
                      }
                    </select>
                  </div>
                  <div class="item-field">
                    <label>Precio ($)</label>
                    <input type="number" [(ngModel)]="item.price" placeholder="Ej: 15000" min="0" [disabled]="item.status === 'done'" />
                  </div>
                </div>

                @if (item.status !== 'done') {
                  <button class="btn-remove" (click)="removeItem(item.id)" title="Quitar">✕</button>
                }
              </div>
            }
          </div>
        </div>

        <!-- STEP 4: Upload -->
        <div class="upload-bar">
          <div class="progress-info">
            @if (isUploading()) {
              <span>Subiendo {{ doneCount() }} de {{ items().length }}...</span>
              <div class="progress-track">
                <div class="progress-fill" [style.width.%]="progressPct()"></div>
              </div>
            } @else if (doneCount() > 0) {
              <span class="done-msg">
                ✓ {{ doneCount() }} producto{{ doneCount() !== 1 ? 's' : '' }} creado{{ doneCount() !== 1 ? 's' : '' }}
                @if (errorCount() > 0) { — {{ errorCount() }} con error }
              </span>
            }
          </div>

          <div class="upload-actions">
            @if (pendingCount() > 0) {
              <span class="pending-label">{{ pendingCount() }} pendiente{{ pendingCount() !== 1 ? 's' : '' }}</span>
            }
            <button
              class="btn-upload"
              (click)="uploadAll()"
              [disabled]="isUploading() || pendingCount() === 0"
            >
              @if (isUploading()) { ⏳ Subiendo... } @else { ⬆ Subir todo ({{ pendingCount() }}) }
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }

    .page-header { margin-bottom: 1.75rem; }
    .page-header h1 { font-size: 1.6rem; font-weight: 800; color: var(--text); margin: 0 0 0.3rem; }
    .page-header p { color: var(--text-secondary); margin: 0; font-size: 0.9rem; }

    .settings-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px;
      padding: 1.5rem 1.75rem; margin-bottom: 1.5rem;
    }
    .settings-card h2 { margin: 0 0 1.25rem; font-size: 1rem; font-weight: 700; color: var(--text); }

    /* Global settings row */
    .settings-row { display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
    .field { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; min-width: 180px; }
    .apply-col { flex: 0 0 auto; }
    label { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); }
    input[type="text"], input[type="number"], select {
      padding: 0.6rem 0.85rem; border: 1px solid var(--border); border-radius: 8px;
      font-size: 0.875rem; background: var(--bg-secondary); color: var(--text);
      font-family: inherit; box-sizing: border-box; width: 100%;
      transition: border-color 0.15s;
    }
    input:focus, select:focus { outline: none; border-color: var(--primary); }
    input:disabled, select:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-apply {
      padding: 0.6rem 1.25rem; background: var(--bg-secondary); border: 1px solid var(--border);
      border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer;
      color: var(--text); transition: all 0.15s; white-space: nowrap;
    }
    .btn-apply:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
    .btn-apply:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Drop zone */
    .drop-zone {
      border: 2px dashed var(--border); border-radius: 12px;
      padding: 2.5rem; text-align: center; cursor: pointer;
      transition: all 0.2s; background: var(--bg-secondary);
    }
    .drop-zone:hover, .drop-zone.drag-over {
      border-color: var(--primary); background: rgba(224,32,200,0.05);
    }
    .drop-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
    .drop-text { font-size: 1rem; font-weight: 600; color: var(--text); margin: 0 0 0.3rem; }
    .drop-sub { font-size: 0.82rem; color: var(--text-secondary); margin: 0; }

    .items-count {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 1rem; font-size: 0.875rem; color: var(--text-secondary);
    }
    .btn-clear {
      background: none; border: none; color: var(--text-secondary); cursor: pointer;
      font-size: 0.82rem; padding: 0.25rem 0.5rem;
    }
    .btn-clear:hover { color: var(--danger); }

    .hint-text { color: var(--text-secondary); font-size: 0.85rem; margin: -0.5rem 0 1.25rem; }

    /* Grid */
    .grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem;
    }
    .item-card {
      background: var(--bg-secondary); border: 1.5px solid var(--border); border-radius: 12px;
      overflow: hidden; position: relative; transition: border-color 0.15s;
    }
    .item-card.done { border-color: var(--success); }
    .item-card.error { border-color: var(--danger); }
    .item-card.uploading { border-color: var(--primary); }

    .status-overlay {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 0.5rem;
      font-size: 0.875rem; font-weight: 600; z-index: 10; border-radius: 11px;
    }
    .uploading-overlay { background: rgba(0,0,0,0.55); color: white; }
    .done-overlay { background: rgba(22,163,74,0.88); color: white; }
    .error-overlay { background: rgba(220,38,38,0.88); color: white; padding: 1rem; text-align: center; }
    .check-icon { font-size: 2.5rem; line-height: 1; }
    .err-icon { font-size: 2rem; line-height: 1; }

    .spinner-lg {
      width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.3);
      border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .thumb {
      width: 100%; height: 180px; object-fit: cover; display: block;
    }

    .item-fields { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .item-field { display: flex; flex-direction: column; gap: 0.2rem; }
    .item-field label { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); }
    .item-field input, .item-field select { font-size: 0.82rem; padding: 0.45rem 0.65rem; }

    .btn-remove {
      position: absolute; top: 0.5rem; right: 0.5rem; width: 26px; height: 26px;
      border-radius: 50%; border: none; background: rgba(0,0,0,0.55); color: white;
      font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.15s; z-index: 5;
    }
    .btn-remove:hover { background: var(--danger); }

    /* Upload bar */
    .upload-bar {
      position: sticky; bottom: 1rem;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px;
      padding: 1rem 1.5rem; display: flex; align-items: center; justify-content: space-between;
      gap: 1.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }
    .progress-info { flex: 1; display: flex; flex-direction: column; gap: 0.4rem; }
    .progress-info span { font-size: 0.875rem; color: var(--text-secondary); }
    .done-msg { color: var(--success) !important; font-weight: 600; }
    .progress-track {
      height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;
    }
    .progress-fill {
      height: 100%; background: linear-gradient(90deg, var(--primary), var(--primary-dark));
      border-radius: 3px; transition: width 0.3s ease;
    }

    .upload-actions { display: flex; align-items: center; gap: 1rem; flex-shrink: 0; }
    .pending-label { font-size: 0.82rem; color: var(--text-secondary); }

    .btn-upload {
      padding: 0.7rem 2rem; background: var(--primary); color: white; border: none;
      border-radius: 10px; font-size: 0.95rem; font-weight: 700; cursor: pointer;
      transition: all 0.15s; white-space: nowrap;
    }
    .btn-upload:hover:not(:disabled) { background: var(--primary-dark); transform: translateY(-1px); }
    .btn-upload:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  `],
})
export class AdminBulkUploadComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  categories = signal<Category[]>([]);
  items = signal<UploadItem[]>([]);
  isUploading = signal(false);
  isDragging = false;

  // Global defaults
  globalCategoryId: number | null = null;
  globalPrice: number | null = null;

  // Computed counts
  doneCount = () => this.items().filter(i => i.status === 'done').length;
  errorCount = () => this.items().filter(i => i.status === 'error').length;
  pendingCount = () => this.items().filter(i => i.status === 'pending').length;
  progressPct = () => {
    const total = this.items().length;
    return total === 0 ? 0 : Math.round(((this.doneCount() + this.errorCount()) / total) * 100);
  };

  ngOnInit(): void {
    this.http.get<Category[]>(`${this.api}/admin/categories`).subscribe({
      next: cats => this.categories.set(cats.filter(c => c.name)),
      error: () => {},
    });
  }

  // ── File handling ──────────────────────────────────────────────────────────

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = true;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = false;
    const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
    this.addFiles(files);
  }

  onFilesSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter(f => f.type.startsWith('image/'));
    this.addFiles(files);
    input.value = '';
  }

  private addFiles(files: File[]): void {
    const newItems: UploadItem[] = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      name: this.fileToProductName(file.name),
      categoryId: this.globalCategoryId,
      price: this.globalPrice,
      status: 'pending',
      error: '',
      productId: null,
    }));
    this.items.update(prev => [...prev, ...newItems]);
  }

  private fileToProductName(filename: string): string {
    return filename
      .replace(/\.[^.]+$/, '')          // remove extension
      .replace(/[-_]+/g, ' ')           // dashes/underscores → spaces
      .replace(/\b\w/g, c => c.toUpperCase()); // Title Case
  }

  removeItem(id: string): void {
    this.items.update(prev => prev.filter(i => i.id !== id));
  }

  clearAll(): void {
    this.items.set([]);
    this.globalCategoryId = null;
    this.globalPrice = null;
  }

  applyGlobalSettings(): void {
    this.items.update(prev =>
      prev.map(item =>
        item.status === 'pending'
          ? { ...item, categoryId: this.globalCategoryId, price: this.globalPrice }
          : item
      )
    );
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  async uploadAll(): Promise<void> {
    const pending = this.items().filter(i => i.status === 'pending');
    if (pending.length === 0) return;
    this.isUploading.set(true);

    for (const item of pending) {
      this.updateItem(item.id, { status: 'uploading' });
      try {
        // Step 1: create product
        const priceInCentavos = item.price ? Math.round(item.price * 100) : null;
        const productBody: Record<string, unknown> = {
          name: item.name || item.file.name,
          categoryId: item.categoryId ?? undefined,
          active: true,
        };
        const product = await this.http
          .post<{ id: number }>(`${this.api}/admin/products`, productBody)
          .toPromise();

        // Step 2: upload image
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('altText', item.name);
        formData.append('primary', 'true');

        await this.http
          .post(`${this.api}/admin/products/${product!.id}/images`, formData)
          .toPromise();

        // Step 3: set price if provided
        if (priceInCentavos && product!.id) {
          // Get first variant if it exists, or skip — price is per variant
          // For now: mark done; price is set later when creating variants
        }

        this.updateItem(item.id, { status: 'done', productId: product!.id });
      } catch (err: any) {
        const msg = err?.error?.error || err?.error?.message || 'Error al subir';
        this.updateItem(item.id, { status: 'error', error: msg });
      }
    }

    this.isUploading.set(false);
  }

  private updateItem(id: string, patch: Partial<UploadItem>): void {
    this.items.update(prev =>
      prev.map(i => i.id === id ? { ...i, ...patch } : i)
    );
  }
}
