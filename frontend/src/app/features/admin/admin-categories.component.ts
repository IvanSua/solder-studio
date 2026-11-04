import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { ToastService } from '../../core/services/toast.service';

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: number | null;
  parentName: string | null;
  sortOrder: number | null;
  active: boolean;
}

const EMPTY_FORM = (): Partial<Category> => ({
  name: '', slug: '', description: '', imageUrl: '',
  parentId: null, sortOrder: 0, active: true,
});

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>Categorías</h2>
        <button class="btn-primary" (click)="openCreate()">+ Nueva categoría</button>
      </div>

      <!-- Table -->
      @if (loading()) {
        <div class="skeleton-rows">
          @for (_ of [1,2,3,4,5]; track $index) {
            <div class="skeleton sk-row"></div>
          }
        </div>
      } @else if (categories().length === 0) {
        <div class="empty">No hay categorías creadas aún.</div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Slug</th>
                <th>Parent</th>
                <th>Orden</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (cat of categories(); track cat.id) {
                <tr [class.inactive]="!cat.active">
                  <td class="name-cell">
                    @if (cat.imageUrl) {
                      <img [src]="cat.imageUrl" alt="" class="cat-img" />
                    }
                    <span>{{ cat.name }}</span>
                  </td>
                  <td class="slug">{{ cat.slug }}</td>
                  <td>{{ cat.parentName || '—' }}</td>
                  <td>{{ cat.sortOrder ?? '—' }}</td>
                  <td>
                    <span class="badge" [class.badge-active]="cat.active" [class.badge-inactive]="!cat.active">
                      {{ cat.active ? 'Activa' : 'Inactiva' }}
                    </span>
                  </td>
                  <td class="actions">
                    <button class="btn-icon" title="Editar" (click)="openEdit(cat)">✏️</button>
                    <button class="btn-icon" title="{{ cat.active ? 'Desactivar' : 'Activar' }}"
                            (click)="toggleActive(cat)">
                      {{ cat.active ? '🚫' : '✅' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Modal -->
      @if (showModal()) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>{{ editingId() ? 'Editar categoría' : 'Nueva categoría' }}</h3>
              <button class="close-btn" (click)="closeModal()">✕</button>
            </div>
            <form (ngSubmit)="save()" class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label>Nombre *</label>
                  <input [(ngModel)]="form.name" name="name" required
                         (input)="autoSlug()" placeholder="Ej: Remeras" />
                </div>
                <div class="form-group">
                  <label>Slug *</label>
                  <input [(ngModel)]="form.slug" name="slug" required placeholder="ej: remeras" />
                </div>
              </div>

              <div class="form-group">
                <label>Descripción</label>
                <textarea [(ngModel)]="form.description" name="description" rows="2"
                          placeholder="Descripción opcional"></textarea>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>URL de imagen</label>
                  <input [(ngModel)]="form.imageUrl" name="imageUrl" placeholder="https://..." />
                </div>
                <div class="form-group">
                  <label>Orden</label>
                  <input type="number" [(ngModel)]="form.sortOrder" name="sortOrder" min="0" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Categoría padre</label>
                  <select [(ngModel)]="form.parentId" name="parentId">
                    <option [ngValue]="null">Sin padre (raíz)</option>
                    @for (cat of rootCategories(); track cat.id) {
                      @if (cat.id !== editingId()) {
                        <option [ngValue]="cat.id">{{ cat.name }}</option>
                      }
                    }
                  </select>
                </div>
                <div class="form-group">
                  <label>Estado</label>
                  <select [(ngModel)]="form.active" name="active">
                    <option [ngValue]="true">Activa</option>
                    <option [ngValue]="false">Inactiva</option>
                  </select>
                </div>
              </div>

              @if (formError()) {
                <div class="alert-error">{{ formError() }}</div>
              }

              <div class="modal-footer">
                <button type="button" class="btn-secondary" (click)="closeModal()">Cancelar</button>
                <button type="submit" class="btn-primary" [disabled]="saving()">
                  {{ saving() ? 'Guardando…' : 'Guardar' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .page { padding: 2rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-header h2 { font-size: 1.4rem; font-weight: 700; color: var(--text); margin: 0; }

    .btn-primary {
      background: var(--primary); color: white; border: none;
      padding: 0.55rem 1.25rem; border-radius: 8px; font-weight: 600;
      font-size: 0.875rem; cursor: pointer;
    }
    .btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary {
      background: var(--bg-card); color: var(--text); border: 1.5px solid var(--border);
      padding: 0.55rem 1.25rem; border-radius: 8px; font-weight: 600;
      font-size: 0.875rem; cursor: pointer;
    }
    .btn-secondary:hover { background: var(--bg-secondary); }

    /* Table */
    .table-wrap { background: var(--bg-card); border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.07); }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      background: var(--bg-secondary); padding: 0.75rem 1rem; text-align: left;
      font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);
      text-transform: uppercase; letter-spacing: 0.04em;
      border-bottom: 1px solid var(--border);
    }
    tbody tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
    tbody tr:hover { background: var(--bg-secondary); }
    tbody tr.inactive { opacity: 0.55; }
    tbody td { padding: 0.8rem 1rem; font-size: 0.875rem; color: var(--text); }
    .name-cell { display: flex; align-items: center; gap: 0.6rem; font-weight: 600; }
    .cat-img { width: 32px; height: 32px; border-radius: 6px; object-fit: cover; }
    .slug { color: var(--text-secondary); font-family: monospace; font-size: 0.82rem; }

    .badge {
      display: inline-block; padding: 0.2rem 0.6rem; border-radius: 99px;
      font-size: 0.75rem; font-weight: 600;
    }
    .badge-active   { background: var(--success-bg); color: var(--success-text); border: 1px solid var(--success-border); }
    .badge-inactive { background: var(--danger-bg);  color: var(--danger-text);  border: 1px solid var(--danger-border); }

    .actions { display: flex; gap: 0.5rem; }
    .btn-icon {
      background: none; border: none; cursor: pointer;
      font-size: 1rem; padding: 0.25rem; border-radius: 4px;
      transition: background 0.1s;
    }
    .btn-icon:hover { background: var(--bg-secondary); }

    /* Skeleton */
    .skeleton-rows { display: flex; flex-direction: column; gap: 0.5rem; }
    .skeleton { background: var(--border); border-radius: 8px; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .sk-row { height: 52px; }

    .empty { text-align: center; padding: 3rem; color: var(--text-secondary); font-size: 0.9rem; background: var(--bg-card); border-radius: 12px; }

    /* Modal */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; padding: 1rem;
    }
    .modal {
      background: var(--bg-card); border-radius: 14px; width: 100%; max-width: 580px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border);
    }
    .modal-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .close-btn { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: var(--text-secondary); padding: 0.25rem; }
    .close-btn:hover { color: var(--text); }
    .modal-body { padding: 1.5rem; }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 0.75rem;
      padding: 1rem 1.5rem; border-top: 1px solid var(--border);
    }

    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }
    label { font-size: 0.82rem; font-weight: 600; color: var(--text); }
    input, select, textarea {
      padding: 0.55rem 0.8rem; border: 1.5px solid var(--border); border-radius: 8px;
      font-size: 0.875rem; outline: none; font-family: inherit; resize: vertical;
    }
    input:focus, select:focus, textarea:focus { border-color: var(--primary); }

    .alert-error {
      background: var(--danger-bg); color: var(--danger-text);
      border: 1px solid var(--danger-border); border-radius: 8px;
      padding: 0.65rem 0.9rem; font-size: 0.85rem; margin-bottom: 0.75rem;
    }
  `]
})
export class AdminCategoriesComponent implements OnInit {
  private readonly apiUrl = `${environment.apiUrl}/admin/categories`;

  categories = signal<Category[]>([]);
  loading = signal(true);
  showModal = signal(false);
  editingId = signal<number | null>(null);
  saving = signal(false);
  formError = signal<string | null>(null);

  form: Partial<Category> = EMPTY_FORM();

  rootCategories = signal<Category[]>([]);

  constructor(private http: HttpClient, private toast: ToastService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.http.get<Category[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.categories.set(data);
        this.rootCategories.set(data.filter(c => !c.parentId && c.active));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form = EMPTY_FORM();
    this.formError.set(null);
    this.showModal.set(true);
  }

  openEdit(cat: Category): void {
    this.editingId.set(cat.id);
    this.form = { ...cat };
    this.formError.set(null);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  autoSlug(): void {
    if (!this.editingId()) {
      this.form.slug = (this.form.name || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim().replace(/\s+/g, '-');
    }
  }

  save(): void {
    if (!this.form.name || !this.form.slug) {
      this.formError.set('Nombre y slug son obligatorios');
      return;
    }
    this.saving.set(true);
    this.formError.set(null);

    const req = this.editingId()
      ? this.http.put<Category>(`${this.apiUrl}/${this.editingId()}`, this.form)
      : this.http.post<Category>(this.apiUrl, this.form);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.load();
        this.toast.success(this.editingId() ? 'Categoría actualizada' : 'Categoría creada');
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err?.error?.message || 'Error al guardar');
      },
    });
  }

  toggleActive(cat: Category): void {
    const updated = { ...cat, active: !cat.active };
    this.http.put<Category>(`${this.apiUrl}/${cat.id}`, updated).subscribe({
      next: () => {
        this.load();
        this.toast.success(updated.active ? 'Categoría activada' : 'Categoría desactivada');
      },
      error: () => this.toast.error('Error al actualizar la categoría'),
    });
  }
}
