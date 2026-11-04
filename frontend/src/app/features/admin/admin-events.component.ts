import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

interface CalendarEvent {
  id: number;
  title: string;
  subtitle: string | null;
  type: string;
  category: string;
  eventDate: string;
  eventTime: string | null;
  venue: string | null;
  city: string | null;
  description: string | null;
  imageUrl: string | null;
  ticketUrl: string | null;
  active: boolean;
}

interface ImportResult {
  created: number;
  merged: number;
  skipped: number;
  events: CalendarEvent[];
  errors: string[];
}

const TYPE_OPTIONS  = ['CONCERT', 'PREMIERE', 'OTHER'];
const CAT_OPTIONS   = ['ROCK', 'POP', 'METAL', 'LATIN', 'DISNEY', 'ANIME', 'MARVEL', 'OTHER'];
const TYPE_LABELS: Record<string, string> = {
  CONCERT:  '🎵 Concierto',
  PREMIERE: '🎬 Estreno',
  OTHER:    '📅 Otro',
};
const CAT_COLORS: Record<string, string> = {
  ROCK: 'var(--danger)', POP: 'var(--info-text)', METAL: '#374151', LATIN: 'var(--warning)',
  DISNEY: 'var(--primary)', ANIME: '#db2777', MARVEL: '#b91c1c', OTHER: '#6b7280',
};

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Eventos</h1>
        <div class="header-actions">
          <button class="btn-import" (click)="openImport()">⬇ Importar eventos</button>
          <button class="btn-primary" (click)="openCreate()">+ Nuevo evento</button>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar">
        <div class="filter-group">
          <select class="filter-select" [(ngModel)]="filterType" (ngModelChange)="applyFilter()">
            <option value="">Todos los tipos</option>
            @for (t of typeOptions; track t) {
              <option [value]="t">{{ typeLabel(t) }}</option>
            }
          </select>
          <input class="filter-search" type="text" placeholder="Buscar evento..."
                 [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()">
        </div>
        <span class="result-count">{{ filtered().length }} eventos</span>
      </div>

      @if (loading()) {
        <div class="loading">Cargando...</div>
      } @else if (filtered().length === 0) {
        <div class="empty">No hay eventos que coincidan con la búsqueda.</div>
      } @else {
        <div class="events-table-wrap">
          <table class="events-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Evento</th>
                <th>Tipo</th>
                <th>Venue</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (ev of filtered(); track ev.id) {
                <tr [class.inactive]="!ev.active">
                  <td class="date-cell">
                    <span class="date-badge">{{ formatDate(ev.eventDate) }}</span>
                  </td>
                  <td>
                    <div class="event-info">
                      <span class="event-name">{{ ev.title }}</span>
                      @if (ev.subtitle) {
                        <span class="event-sub">{{ ev.subtitle }}</span>
                      }
                    </div>
                  </td>
                  <td>
                    <span class="type-tag" [style.background]="catColor(ev.category) + '20'"
                          [style.color]="catColor(ev.category)">
                      {{ typeLabel(ev.type) }}
                    </span>
                  </td>
                  <td class="venue-cell">{{ ev.venue ?? '—' }}</td>
                  <td>
                    <span class="status-dot" [class.active]="ev.active" [class.inactive]="!ev.active">
                      {{ ev.active ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td class="actions-cell">
                    <button class="btn-icon" (click)="openEdit(ev)" title="Editar">✏️</button>
                    <button class="btn-icon danger" (click)="deleteEvent(ev)" title="Eliminar">🗑️</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- ── Import Modal ─────────────────────────────────────────────────── -->
    @if (showImport()) {
      <div class="modal-overlay" (click)="closeImport()">
        <div class="modal import-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>⬇ Importar eventos automáticamente</h2>
            <button class="modal-close" (click)="closeImport()">✕</button>
          </div>
          <div class="modal-body">

            @if (!importResult()) {
              <!-- Step 1: date range -->
              <p class="import-hint">
                Seleccioná el rango de fechas. El sistema consulta la API de
                <strong>Ticketmaster</strong> y importa conciertos y estrenos en Argentina
                automáticamente. Los eventos duplicados se fusionan en uno solo.
              </p>

              <div class="source-tip tip-info">
                🔑 <strong>Configuración requerida:</strong> registrate gratis en
                <a href="https://developer.ticketmaster.com/" target="_blank">developer.ticketmaster.com</a>,
                creá una app y configurá la variable de entorno
                <code>TM_API_KEY</code> con tu Consumer Key antes de importar.
              </div>

              <div class="form-grid-2">
                <div class="form-row">
                  <label>Desde</label>
                  <input type="date" [(ngModel)]="importForm.dateFrom">
                </div>
                <div class="form-row">
                  <label>Hasta</label>
                  <input type="date" [(ngModel)]="importForm.dateTo">
                </div>
              </div>
            } @else {
              <!-- Step 2: results -->
              <div class="import-stats">
                <div class="stat created">
                  <span class="stat-num">{{ importResult()!.created }}</span>
                  <span class="stat-lbl">Nuevos</span>
                </div>
                <div class="stat merged">
                  <span class="stat-num">{{ importResult()!.merged }}</span>
                  <span class="stat-lbl">Fusionados</span>
                </div>
                <div class="stat skipped">
                  <span class="stat-num">{{ importResult()!.skipped }}</span>
                  <span class="stat-lbl">Ya existían</span>
                </div>
              </div>

              @if (importResult()!.errors.length > 0) {
                <div class="import-errors">
                  @for (err of importResult()!.errors; track err) {
                    <p class="import-error">⚠ {{ err }}</p>
                  }
                </div>
              }

              @if (importResult()!.events.length > 0) {
                <div class="import-event-list">
                  @for (ev of importResult()!.events; track ev.id) {
                    <div class="import-event-row">
                      @if (ev.imageUrl) {
                        <img class="ev-thumb" [src]="ev.imageUrl" [alt]="ev.title">
                      } @else {
                        <div class="ev-thumb ev-thumb-placeholder">{{ ev.type === 'PREMIERE' ? '🎬' : '🎵' }}</div>
                      }
                      <div class="ev-info">
                        <span class="ev-name">{{ ev.title }}</span>
                        <span class="ev-meta">{{ formatDate(ev.eventDate) }} · {{ ev.venue ?? ev.city }}</span>
                      </div>
                      <span class="type-tag"
                            [style.background]="catColor(ev.category) + '20'"
                            [style.color]="catColor(ev.category)">
                        {{ typeLabel(ev.type) }}
                      </span>
                    </div>
                  }
                </div>
              } @else if (importResult()!.errors.length === 0) {
                <p class="import-empty">No se encontraron eventos nuevos en ese rango de fechas.</p>
              }
            }
          </div>

          <div class="modal-footer">
            @if (!importResult()) {
              <button class="btn-secondary" (click)="closeImport()">Cancelar</button>
              <button class="btn-primary" (click)="runImport()"
                      [disabled]="importing() || !importForm.dateFrom || !importForm.dateTo">
                @if (importing()) {
                  <span class="spinner"></span> Importando...
                } @else {
                  ⬇ Importar
                }
              </button>
            } @else {
              <button class="btn-secondary" (click)="resetImport()">← Importar más</button>
              <button class="btn-primary" (click)="closeImport()">Listo</button>
            }
          </div>
        </div>
      </div>
    }

    <!-- Create / Edit Modal -->
    @if (showForm()) {
      <div class="modal-overlay" (click)="closeForm()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editing() ? 'Editar evento' : 'Nuevo evento' }}</h2>
            <button class="modal-close" (click)="closeForm()">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <label>Título *</label>
              <input type="text" [(ngModel)]="form.title" placeholder="Nombre del evento">
            </div>
            <div class="form-row">
              <label>Subtítulo</label>
              <input type="text" [(ngModel)]="form.subtitle" placeholder="Descripción corta">
            </div>
            <div class="form-grid-2">
              <div class="form-row">
                <label>Tipo *</label>
                <select [(ngModel)]="form.type">
                  @for (t of typeOptions; track t) {
                    <option [value]="t">{{ typeLabel(t) }}</option>
                  }
                </select>
              </div>
              <div class="form-row">
                <label>Categoría</label>
                <select [(ngModel)]="form.category">
                  @for (c of catOptions; track c) {
                    <option [value]="c">{{ c }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-row">
                <label>Fecha *</label>
                <input type="date" [(ngModel)]="form.eventDate">
              </div>
              <div class="form-row">
                <label>Hora</label>
                <input type="time" [(ngModel)]="form.eventTime">
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-row">
                <label>Venue / Cine</label>
                <input type="text" [(ngModel)]="form.venue" placeholder="Estadio Monumental">
              </div>
              <div class="form-row">
                <label>Ciudad</label>
                <input type="text" [(ngModel)]="form.city" placeholder="Buenos Aires">
              </div>
            </div>
            <div class="form-row">
              <label>Descripción</label>
              <textarea [(ngModel)]="form.description" rows="3" placeholder="Descripción del evento..."></textarea>
            </div>
            <div class="form-row">
              <label>URL Entradas / Cines</label>
              <input type="url" [(ngModel)]="form.ticketUrl" placeholder="https://ticketek.com.ar/...">
            </div>
            <div class="form-row">
              <label>URL Imagen</label>
              <input type="url" [(ngModel)]="form.imageUrl" placeholder="https://...">
            </div>
            <div class="form-row checkbox-row">
              <input type="checkbox" id="activeChk" [(ngModel)]="form.active">
              <label for="activeChk">Evento activo (visible en el calendario público)</label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeForm()">Cancelar</button>
            <button class="btn-primary" (click)="saveEvent()" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : (editing() ? 'Guardar cambios' : 'Crear evento') }}
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
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
    .page-header h1 { margin: 0; font-size: 1.4rem; font-weight: 700; color: var(--text); }
    .header-actions { display: flex; gap: 0.6rem; align-items: center; }

    .btn-import {
      background: var(--bg-card); color: var(--text); border: 1.5px solid var(--border);
      border-radius: 8px; padding: 8px 16px; font-size: 0.85rem; font-weight: 600; cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .btn-import:hover { background: var(--bg-secondary); border-color: var(--info); color: var(--info); }

    .btn-primary {
      background: var(--info); color: white; border: none; border-radius: 8px;
      padding: 8px 18px; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    .btn-primary:hover:not(:disabled) { background: var(--info-text); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary {
      background: var(--bg-card); color: var(--text); border: 1.5px solid var(--border); border-radius: 8px;
      padding: 8px 18px; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    .btn-secondary:hover { background: var(--bg-secondary); }

    /* Filter bar */
    .filter-bar { display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem; }
    .filter-group { display: flex; gap: 0.5rem; }
    .filter-select, .filter-search {
      border: 1.5px solid var(--border); border-radius: 8px; padding: 7px 12px;
      font-size: 0.85rem; color: var(--text); background: var(--bg-card); outline: none;
    }
    .filter-select:focus, .filter-search:focus { border-color: var(--info); }
    .filter-search { min-width: 200px; }
    .result-count { font-size: 0.82rem; color: var(--text-secondary); }

    .loading, .empty {
      text-align: center; padding: 3rem; color: var(--text-secondary); font-size: 0.9rem;
    }

    /* Table */
    .events-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }
    .events-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: var(--bg-card); }
    .events-table thead th {
      padding: 0.6rem 0.9rem; text-align: left; font-size: 0.75rem; font-weight: 600;
      color: var(--text-secondary); text-transform: uppercase; border-bottom: 1px solid var(--border); background: var(--bg-secondary);
    }
    .events-table tbody td {
      padding: 0.8rem 0.9rem; border-bottom: 1px solid var(--border); vertical-align: middle;
    }
    .events-table tbody tr:last-child td { border-bottom: none; }
    .events-table tbody tr.inactive { opacity: 0.55; }

    .date-badge { font-size: 0.78rem; color: var(--text); font-weight: 500; white-space: nowrap; }
    .event-info { display: flex; flex-direction: column; }
    .event-name { font-weight: 600; color: var(--text); }
    .event-sub { font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px; }
    .type-tag { font-size: 0.72rem; font-weight: 600; padding: 3px 9px; border-radius: 12px; white-space: nowrap; }
    .venue-cell { color: var(--text-secondary); font-size: 0.82rem; max-width: 180px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .status-dot {
      font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 12px;
    }
    .status-dot.active   { background: var(--success-bg); color: var(--success-text); }
    .status-dot.inactive { background: var(--danger-bg); color: var(--danger-text); }

    .actions-cell { display: flex; gap: 0.3rem; align-items: center; }
    .btn-icon {
      width: 30px; height: 30px; border: none; background: none; cursor: pointer;
      border-radius: 6px; font-size: 0.9rem; transition: background 0.12s;
    }
    .btn-icon:hover { background: var(--bg-secondary); }
    .btn-icon.danger:hover { background: var(--danger-bg); }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: var(--overlay); z-index: 999;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .modal {
      background: var(--bg-card); border-radius: 14px; max-width: 600px; width: 100%;
      max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border);
    }
    .modal-header h2 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .modal-close {
      background: none; border: none; cursor: pointer; font-size: 1.1rem; color: var(--text-secondary);
      width: 28px; height: 28px; border-radius: 50%;
    }
    .modal-close:hover { background: var(--bg-secondary); color: var(--text); }
    .modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.9rem; }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 0.75rem;
      padding: 1rem 1.5rem; border-top: 1px solid var(--border);
    }

    .form-row { display: flex; flex-direction: column; gap: 0.35rem; }
    .form-row label { font-size: 0.8rem; font-weight: 600; color: var(--text); }
    .form-row input, .form-row select, .form-row textarea {
      border: 1.5px solid var(--border); border-radius: 8px; padding: 8px 12px;
      font-size: 0.85rem; color: var(--text); outline: none; font-family: inherit;
    }
    .form-row input:focus, .form-row select:focus, .form-row textarea:focus { border-color: var(--info); }
    .form-row textarea { resize: vertical; }
    .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .checkbox-row { flex-direction: row; align-items: center; gap: 0.5rem; }
    .checkbox-row label { margin: 0; font-weight: 400; }

    /* ── Import modal ─────────────────────────────────────────────────────── */
    .import-modal { max-width: 640px; }
    .import-hint { font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 1rem; line-height: 1.5; }

    .source-tip {
      font-size: 0.82rem; padding: 0.6rem 0.85rem; border-radius: 8px; line-height: 1.5;
    }
    .source-tip a { color: inherit; font-weight: 600; }
    .source-tip code { background: rgba(0,0,0,0.08); padding: 1px 5px; border-radius: 4px; font-size: 0.78rem; }
    .tip-info    { background: var(--info-bg); color: var(--info-text); }
    .tip-warning { background: var(--warning-bg); color: var(--warning-text); }
    .tip-ok      { background: var(--success-bg); color: var(--success-text); }
    [data-theme="dark"] .tip-info    { background: #1e3a5f40; color: #93c5fd; }
    [data-theme="dark"] .tip-warning { background: #78350f40; color: #fde68a; }
    [data-theme="dark"] .tip-ok      { background: #14532d40; color: #86efac; }

    /* Results */
    .import-stats { display: flex; gap: 1rem; margin-bottom: 1.25rem; }
    .stat {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      padding: 1rem; border-radius: 10px; gap: 0.25rem;
    }
    .stat.created { background: var(--success-bg); }
    .stat.merged  { background: var(--info-bg); }
    .stat.skipped { background: var(--bg-secondary); }
    [data-theme="dark"] .stat.created { background: #14532d40; }
    [data-theme="dark"] .stat.merged  { background: #1e3a5f40; }
    .stat-num { font-size: 1.8rem; font-weight: 700; color: var(--text); line-height: 1; }
    .stat-lbl { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }

    .import-errors { margin-bottom: 1rem; }
    .import-error { font-size: 0.82rem; color: var(--danger); padding: 0.5rem 0.75rem; background: var(--danger-bg); border-radius: 6px; margin: 0 0 0.4rem; }

    .import-event-list { display: flex; flex-direction: column; gap: 0.4rem; max-height: 320px; overflow-y: auto; }
    .import-event-row {
      display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.6rem;
      border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card);
    }
    .ev-thumb { width: 44px; height: 44px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
    .ev-thumb-placeholder {
      width: 44px; height: 44px; border-radius: 6px; background: var(--bg-secondary);
      display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;
    }
    .ev-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .ev-name { font-size: 0.85rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ev-meta { font-size: 0.75rem; color: var(--text-secondary); }
    .import-empty { text-align: center; color: var(--text-secondary); font-size: 0.88rem; padding: 1.5rem; }

    /* Spinner */
    .spinner {
      display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4);
      border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 4px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class AdminEventsComponent implements OnInit {
  private http = inject(HttpClient);

  events     = signal<CalendarEvent[]>([]);
  filtered   = signal<CalendarEvent[]>([]);
  loading    = signal(true);
  showForm   = signal(false);
  editing    = signal(false);
  saving     = signal(false);
  editingId  = signal<number | null>(null);

  // Import
  showImport   = signal(false);
  importing    = signal(false);
  importResult = signal<ImportResult | null>(null);
  importForm   = { dateFrom: '', dateTo: '' };

  filterType = '';
  searchTerm = '';

  readonly typeOptions = TYPE_OPTIONS;
  readonly catOptions  = CAT_OPTIONS;

  form = this.emptyForm();

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.http.get<CalendarEvent[]>(`${environment.apiUrl}/admin/events`).subscribe({
      next: (data) => { this.events.set(data); this.applyFilter(); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  applyFilter(): void {
    let list = this.events();
    if (this.filterType) list = list.filter(e => e.type === this.filterType);
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q) || (e.subtitle ?? '').toLowerCase().includes(q));
    }
    this.filtered.set(list);
  }

  openCreate(): void {
    this.form = this.emptyForm();
    this.editing.set(false);
    this.editingId.set(null);
    this.showForm.set(true);
  }

  openEdit(ev: CalendarEvent): void {
    this.form = {
      title: ev.title,
      subtitle: ev.subtitle ?? '',
      type: ev.type,
      category: ev.category,
      eventDate: ev.eventDate,
      eventTime: ev.eventTime ? ev.eventTime.substring(0, 5) : '',
      venue: ev.venue ?? '',
      city: ev.city ?? 'Buenos Aires',
      description: ev.description ?? '',
      imageUrl: ev.imageUrl ?? '',
      ticketUrl: ev.ticketUrl ?? '',
      active: ev.active,
    };
    this.editingId.set(ev.id);
    this.editing.set(true);
    this.showForm.set(true);
  }

  closeForm(): void { this.showForm.set(false); }

  saveEvent(): void {
    if (!this.form.title || !this.form.type || !this.form.eventDate) return;
    this.saving.set(true);

    const payload = {
      ...this.form,
      subtitle:    this.form.subtitle    || null,
      eventTime:   this.form.eventTime   ? this.form.eventTime + ':00' : null,
      venue:       this.form.venue       || null,
      city:        this.form.city        || 'Buenos Aires',
      description: this.form.description || null,
      imageUrl:    this.form.imageUrl    || null,
      ticketUrl:   this.form.ticketUrl   || null,
    };

    const req$ = this.editing()
      ? this.http.put<CalendarEvent>(`${environment.apiUrl}/admin/events/${this.editingId()}`, payload)
      : this.http.post<CalendarEvent>(`${environment.apiUrl}/admin/events`, payload);

    req$.subscribe({
      next: () => { this.saving.set(false); this.showForm.set(false); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  deleteEvent(ev: CalendarEvent): void {
    if (!confirm(`¿Eliminar "${ev.title}"?`)) return;
    this.http.delete(`${environment.apiUrl}/admin/events/${ev.id}`).subscribe({
      next: () => this.load(),
    });
  }

  // ── Import ──────────────────────────────────────────────────────────────

  openImport(): void {
    const today = new Date().toISOString().split('T')[0];
    const inSixMonths = new Date(Date.now() + 180 * 86400_000).toISOString().split('T')[0];
    this.importForm = { dateFrom: today, dateTo: inSixMonths };
    this.importResult.set(null);
    this.showImport.set(true);
  }

  closeImport(): void {
    this.showImport.set(false);
    if (this.importResult()?.created || this.importResult()?.merged) this.load();
  }

  resetImport(): void { this.importResult.set(null); }

  runImport(): void {
    if (!this.importForm.dateFrom || !this.importForm.dateTo) return;
    this.importing.set(true);
    this.http.post<ImportResult>(`${environment.apiUrl}/admin/events/import`, {
      dateFrom: this.importForm.dateFrom,
      dateTo:   this.importForm.dateTo,
    }).subscribe({
      next: (res) => { this.importResult.set(res); this.importing.set(false); },
      error: (err) => {
        this.importResult.set({
          created: 0, merged: 0, skipped: 0, events: [],
          errors: [err?.error?.message ?? 'Error al conectar con el servidor'],
        });
        this.importing.set(false);
      },
    });
  }

  typeLabel(t: string): string  { return TYPE_LABELS[t] ?? t; }
  catColor(cat: string): string { return CAT_COLORS[cat] ?? '#6b7280'; }

  formatDate(date: string): string {
    const d = new Date(date + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private emptyForm() {
    return {
      title: '', subtitle: '', type: 'CONCERT', category: 'ROCK',
      eventDate: '', eventTime: '', venue: '', city: 'Buenos Aires',
      description: '', imageUrl: '', ticketUrl: '', active: true,
    };
  }
}
