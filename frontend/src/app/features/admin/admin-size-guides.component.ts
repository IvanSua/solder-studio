import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

interface SizeGuideResponse {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  sizes: string[];
  measurements: Record<string, Record<string, string>>;
  instructions: string | null;
  active: boolean;
}

interface SizeGuideRequest {
  categoryId: number;
  name: string;
  sizes: string[];
  measurements: Record<string, Record<string, string>>;
  instructions: string | null;
  active: boolean;
}

interface Category {
  id: number;
  name: string;
}

@Component({
  selector: 'app-admin-size-guides',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-size-guides">
      <div class="page-header">
        <h1>Guía de Talles</h1>
        <button class="btn-primary" (click)="openModal()">+ Nueva Guía</button>
      </div>

      @if (sizeGuides().length === 0) {
        <div class="empty-state">
          <p>No hay guías de talles configuradas.</p>
        </div>
      } @else {
        <div class="guides-list">
          @for (guide of sizeGuides(); track guide.id) {
            <div class="guide-card" [class.inactive]="!guide.active">
              <div class="guide-info">
                <div class="guide-header">
                  <h3>{{ guide.name }}</h3>
                  <span class="category-badge">{{ guide.categoryName }}</span>
                  @if (!guide.active) {
                    <span class="inactive-badge">Inactiva</span>
                  }
                </div>
                <p class="sizes-preview">
                  Talles: {{ guide.sizes.join(', ') }}
                </p>
                <p class="measurements-preview">
                  Medidas: {{ getMeasurementCount(guide) }} columnas
                </p>
              </div>
              <div class="guide-actions">
                <button class="btn-edit" (click)="editGuide(guide)">Editar</button>
                <button class="btn-delete" (click)="deleteGuide(guide.id)">Eliminar</button>
              </div>
            </div>
          }
        </div>
      }

      <!-- Modal -->
      @if (showModal()) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>{{ editingGuide() ? 'Editar Guía' : 'Nueva Guía de Talles' }}</h2>
              <button class="close-btn" (click)="closeModal()">×</button>
            </div>

            <div class="modal-body">
              <div class="form-group">
                <label>Categoría *</label>
                <select [(ngModel)]="formData.categoryId" required>
                  <option value="">Seleccionar categoría</option>
                  @for (cat of categories(); track cat.id) {
                    <option [value]="cat.id">{{ cat.name }}</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label>Nombre *</label>
                <input type="text" [(ngModel)]="formData.name" placeholder="Ej: Remeras / Buzos / Tazas" required>
              </div>

              <div class="form-group">
                <label>Talles * (separados por coma)</label>
                <input type="text" [(ngModel)]="sizesInput" placeholder="Ej: XS, S, M, L, XL">
              </div>

              <div class="form-group">
                <label>Medidas a incluir</label>
                <div class="measurement-inputs">
                  @for (m of measurementInputs; track m) {
                    <div class="measurement-row">
                      <span class="measurement-name">{{ getMeasurementLabel(m) }}</span>
                      <span class="measurement-key">({{ m }})</span>
                    </div>
                  }
                </div>
                <p class="help-text">
                  Completá los valores para cada talle en la tabla que aparece abajo.
                </p>
              </div>

              <div class="form-group">
                <label>Instrucciones (opcional)</label>
                <textarea 
                  [(ngModel)]="formData.instructions" 
                  placeholder="Ej: Medí tu contorno de pecho con la cinta sin apretar."
                  rows="2"
                ></textarea>
              </div>

              <div class="form-group">
                <label>Activo</label>
                <label class="toggle">
                  <input type="checkbox" [(ngModel)]="formData.active">
                  <span class="slider"></span>
                </label>
              </div>

              @if (sizesArray.length > 0) {
                <div class="table-editor">
                  <label>Valores por Talle</label>
                  <div class="table-wrapper">
                    <table class="size-editor-table">
                      <thead>
                        <tr>
                          <th>Medida</th>
                          @for (size of sizesArray; track size) {
                            <th>{{ size }}</th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (m of measurementInputs; track m) {
                          <tr>
                            <td>{{ getMeasurementLabel(m) }}</td>
                            @for (size of sizesArray; track size) {
                              <td>
                                <input 
                                  type="text" 
                                  [value]="getMeasurementValue(size, m)"
                                  (change)="setMeasurementValue(size, m, $event)"
                                  [placeholder]="m"
                                >
                              </td>
                            }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }
            </div>

            <div class="modal-footer">
              <button class="btn-cancel" (click)="closeModal()">Cancelar</button>
              <button class="btn-primary" (click)="saveGuide()" [disabled]="!isFormValid()">
                {{ editingGuide() ? 'Guardar Cambios' : 'Crear Guía' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .admin-size-guides {
      padding: 1.5rem;
      max-width: 100%;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .page-header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text);
      margin: 0;
    }

    .btn-primary {
      background: var(--primary);
      color: white;
      border: none;
      padding: 0.6rem 1.25rem;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--primary-dark);
    }

    .btn-primary:disabled {
      background: var(--text-secondary);
      cursor: not-allowed;
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-secondary);
    }

    .guides-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .guide-card {
      background: var(--bg-card);
      border-radius: 8px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .guide-card.inactive {
      opacity: 0.7;
      border-left: 4px solid var(--danger);
    }

    .guide-info {
      flex: 1;
    }

    .guide-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .guide-header h3 {
      margin: 0;
      font-size: 1rem;
      color: var(--text);
    }

    .category-badge {
      background: var(--info-bg);
      color: var(--info-text);
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }

    .inactive-badge {
      background: var(--danger-bg);
      color: var(--danger-text);
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }

    .sizes-preview, .measurements-preview {
      margin: 0.25rem 0;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .guide-actions {
      display: flex;
      gap: 0.5rem;
    }

    .btn-edit, .btn-delete {
      padding: 0.4rem 0.75rem;
      border-radius: 4px;
      font-size: 0.8rem;
      cursor: pointer;
      border: none;
    }

    .btn-edit {
      background: var(--bg-secondary);
      color: var(--text);
    }

    .btn-edit:hover {
      background: var(--border);
    }

    .btn-delete {
      background: var(--danger-bg);
      color: var(--danger-text);
    }

    .btn-delete:hover {
      background: var(--danger-bg);
      opacity: 0.8;
    }

    /* Modal */
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
      padding: 1rem;
    }

    .modal-content {
      background: var(--bg-card);
      border-radius: 12px;
      max-width: 800px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border);
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.25rem;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.75rem;
      color: var(--text-secondary);
      cursor: pointer;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .form-group {
      margin-bottom: 1.25rem;
    }

    .form-group label {
      display: block;
      font-weight: 500;
      margin-bottom: 0.5rem;
      color: var(--text);
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 0.6rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.9rem;
    }

    .form-group textarea {
      resize: vertical;
    }

    .help-text {
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-top: 0.5rem;
    }

    .measurement-inputs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .measurement-row {
      background: var(--bg-secondary);
      padding: 0.35rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
    }

    .measurement-key {
      color: var(--text-secondary);
      margin-left: 0.25rem;
    }

    .toggle {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 24px;
    }

    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--border);
      transition: 0.3s;
      border-radius: 24px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.3s;
      border-radius: 50%;
    }

    .toggle input:checked + .slider {
      background-color: var(--primary);
    }

    .toggle input:checked + .slider:before {
      transform: translateX(24px);
    }

    .table-editor {
      margin-top: 1rem;
    }

    .table-editor label {
      display: block;
      font-weight: 500;
      margin-bottom: 0.5rem;
      color: var(--text);
    }

    .table-wrapper {
      overflow-x: auto;
    }

    .size-editor-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }

    .size-editor-table th,
    .size-editor-table td {
      border: 1px solid var(--border);
      padding: 0.5rem;
      text-align: center;
    }

    .size-editor-table th {
      background: var(--bg-secondary);
      font-weight: 600;
    }

    .size-editor-table td:first-child {
      text-align: left;
      font-weight: 500;
      background: var(--bg-secondary);
    }

    .size-editor-table input {
      width: 70px;
      padding: 0.35rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      text-align: center;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border);
    }

    .btn-cancel {
      background: var(--bg-secondary);
      color: var(--text);
      border: none;
      padding: 0.6rem 1.25rem;
      border-radius: 6px;
      cursor: pointer;
    }

    .btn-cancel:hover {
      background: var(--border);
    }
  `],
})
export class AdminSizeGuidesComponent implements OnInit {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  sizeGuides = signal<SizeGuideResponse[]>([]);
  categories = signal<Category[]>([]);
  showModal = signal(false);
  editingGuide = signal<SizeGuideResponse | null>(null);

  sizesInput = '';
  measurementInputs = ['chest', 'waist', 'length', 'width', 'height', 'inseam', 'sleeve', 'shoulder'];
  
  formData: SizeGuideRequest = {
    categoryId: 0,
    name: '',
    sizes: [],
    measurements: {},
    instructions: null,
    active: true
  };

  get sizesArray(): string[] {
    return this.sizesInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  ngOnInit(): void {
    this.loadSizeGuides();
    this.loadCategories();
  }

  loadSizeGuides(): void {
    this.http.get<SizeGuideResponse[]>(`${this.apiUrl}/size-guides`)
      .subscribe({
        next: (data) => this.sizeGuides.set(data),
        error: (err) => console.error('Error loading guides:', err),
      });
  }

  loadCategories(): void {
    this.http.get<Category[]>(`${this.apiUrl}/categories`)
      .subscribe({
        next: (data) => this.categories.set(data),
        error: (err) => console.error('Error loading categories:', err),
      });
  }

  openModal(): void {
    this.editingGuide.set(null);
    this.formData = {
      categoryId: 0,
      name: '',
      sizes: [],
      measurements: {},
      instructions: null,
      active: true
    };
    this.sizesInput = '';
    this.showModal.set(true);
  }

  editGuide(guide: SizeGuideResponse): void {
    this.editingGuide.set(guide);
    this.formData = {
      categoryId: guide.categoryId,
      name: guide.name,
      sizes: guide.sizes,
      measurements: guide.measurements,
      instructions: guide.instructions,
      active: guide.active
    };
    this.sizesInput = guide.sizes.join(', ');
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingGuide.set(null);
  }

  getMeasurementLabel(key: string): string {
    const labels: Record<string, string> = {
      'chest': 'Contorno pecho',
      'waist': 'Contorno cintura',
      'hips': 'Contorno cadera',
      'length': 'Largo total',
      'width': 'Ancho',
      'height': 'Alto',
      'inseam': 'Entrepierna',
      'sleeve': 'Largo manga',
      'shoulder': 'Ancho hombro',
    };
    return labels[key] || key;
  }

  getMeasurementCount(guide: SizeGuideResponse): number {
    if (!guide.measurements) return 0;
    const firstSize = guide.sizes[0];
    if (!firstSize) return 0;
    return Object.keys(guide.measurements[firstSize] || {}).length;
  }

  getMeasurementValue(size: string, measurement: string): string {
    return this.formData.measurements[size]?.[measurement] || '';
  }

  setMeasurementValue(size: string, measurement: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!this.formData.measurements[size]) {
      this.formData.measurements[size] = {};
    }
    this.formData.measurements[size][measurement] = value;
  }

  isFormValid(): boolean {
    return this.formData.categoryId > 0 &&
           this.formData.name.trim().length > 0 &&
           this.sizesArray.length > 0;
  }

  saveGuide(): void {
    if (!this.isFormValid()) return;

    this.formData.sizes = this.sizesArray;

    const editing = this.editingGuide();
    const request = this.http.request<SizeGuideResponse>(
      editing ? 'put' : 'post',
      `${this.apiUrl}/size-guides${editing ? '/' + editing.id : ''}`,
      { body: this.formData }
    );

    request.subscribe({
      next: () => {
        this.loadSizeGuides();
        this.closeModal();
      },
      error: (err) => console.error('Error saving guide:', err),
    });
  }

  deleteGuide(id: number): void {
    if (!confirm('¿Estás seguro de eliminar esta guía?')) return;

    this.http.delete(`${this.apiUrl}/size-guides/${id}`).subscribe({
      next: () => this.loadSizeGuides(),
      error: (err) => console.error('Error deleting guide:', err),
    });
  }
}
