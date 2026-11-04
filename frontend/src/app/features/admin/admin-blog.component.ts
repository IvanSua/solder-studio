import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

interface BlogPostResponse {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  author: string;
  category: string;
  imageUrl: string | null;    // presigned URL for display
  imageKey: string | null;    // raw MinIO key for persistence
  videoUrl: string | null;
  published: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BlogPostRequest {
  title: string;
  content: string;
  excerpt?: string;
  author: string;
  category: string;
  imageUrl?: string;
  videoUrl?: string;
  published: boolean;
  featured: boolean;
}

interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}

const EMPTY_FORM = (): BlogPostRequest => ({
  title: '',
  content: '',
  excerpt: '',
  author: '',
  category: '',
  imageUrl: '',
  videoUrl: '',
  published: false,
  featured: false,
});

@Component({
  selector: 'app-admin-blog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Blog</h1>
          <p class="subtitle">Gestión de posts y contenido editorial</p>
        </div>
        <div class="header-actions">
          <!-- Social account buttons -->
          <div class="social-btns">
            <button class="btn-social instagram" [class.connected]="igConnected()" (click)="connectInstagram()" [title]="igConnected() ? 'Instagram conectado' : 'Conectar Instagram'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
              </svg>
              <span class="social-label">{{ igConnected() ? 'IG conectado' : 'Conectar IG' }}</span>
            </button>
            <button class="btn-social facebook" [class.connected]="fbConnected()" (click)="connectFacebook()" [title]="fbConnected() ? 'Facebook conectado' : 'Conectar Facebook'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
              <span class="social-label">{{ fbConnected() ? 'FB conectado' : 'Conectar FB' }}</span>
            </button>
          </div>
          @if (totalElements() > 0) {
            <span class="total-badge">{{ totalElements() }} posts</span>
          }
          <button class="btn-primary" (click)="openNew()">+ Nuevo Post</button>
        </div>
      </div>

      <!-- Social info modal -->
      @if (showSocialModal()) {
        <div class="social-modal-overlay" (click)="showSocialModal.set(false)">
          <div class="social-modal" (click)="$event.stopPropagation()">
            <h3>Conectar {{ socialModalPlatform() }}</h3>
            @if (socialModalPlatform() === 'Instagram') {
              <p>Para publicar automáticamente en Instagram necesitás:</p>
              <ol>
                <li>Una cuenta <strong>Instagram Business</strong> o Creator</li>
                <li>Vincularla a una <strong>Página de Facebook</strong></li>
                <li>Obtener un <strong>Access Token</strong> desde <em>Meta for Developers</em></li>
                <li>Configurar <code>INSTAGRAM_ACCESS_TOKEN</code> e <code>INSTAGRAM_PAGE_ID</code> en el servidor</li>
              </ol>
            } @else {
              <p>Para publicar automáticamente en Facebook necesitás:</p>
              <ol>
                <li>Una <strong>Página de Facebook</strong> (no perfil personal)</li>
                <li>Obtener un <strong>Page Access Token</strong> desde <em>Meta for Developers</em></li>
                <li>Configurar <code>FACEBOOK_PAGE_ACCESS_TOKEN</code> y <code>FACEBOOK_PAGE_ID</code> en el servidor</li>
              </ol>
            }
            <p class="modal-note">Una vez configurado en el servidor, el botón se activará automáticamente.</p>
            <div class="modal-actions">
              <button class="btn-secondary" (click)="showSocialModal.set(false)">Cerrar</button>
            </div>
          </div>
        </div>
      }

      <!-- FORM INLINE -->
      @if (showForm()) {
        <div class="form-card">
          <h2 class="form-title">{{ editingId() ? 'Editar Post' : 'Nuevo Post' }}</h2>

          <div class="form-grid">
            <div class="form-field">
              <label>Título *</label>
              <input [(ngModel)]="form().title" placeholder="Título del post" />
            </div>
            <div class="form-field">
              <label>Autor *</label>
              <input [(ngModel)]="form().author" placeholder="Nombre del autor" />
            </div>
            <div class="form-field">
              <label>Categoría *</label>
              <select [(ngModel)]="form().category" class="cat-select">
                <option value="">— Seleccioná una —</option>
                <option value="Bandas">Bandas</option>
                <option value="Cine">Cine</option>
                <option value="Promociones">Promociones</option>
                <option value="Información">Información</option>
                <option value="Eventos">Eventos</option>
                <option value="Novedades">Novedades</option>
              </select>
            </div>
            <div class="form-field">
              <label>Imagen</label>
              <div class="image-upload-row">
                <input [(ngModel)]="form().imageUrl" placeholder="https://... o subí un archivo" class="image-url-input" />
                <label class="btn-upload" [class.uploading]="uploadingImage()">
                  <input type="file" accept="image/png,image/jpeg,image/webp" (change)="onImageFile($event)" hidden />
                  @if (uploadingImage()) { Subiendo... } @else { Subir foto }
                </label>
              </div>
              @if (imagePreviewUrl() || form().imageUrl) {
                <img [src]="imagePreviewUrl() || form().imageUrl!" class="image-preview" alt="preview" (error)="clearImageUrl()" />
              }
            </div>
            <div class="form-field">
              <label>Video (URL de YouTube o MP4)</label>
              <input [(ngModel)]="form().videoUrl" placeholder="https://www.youtube.com/watch?v=..." />
            </div>
            <div class="form-field form-field--full">
              <label>Resumen (excerpt)</label>
              <input [(ngModel)]="form().excerpt" placeholder="Breve descripción para listados" />
            </div>
            <div class="form-field form-field--full">
              <label>Contenido *</label>
              <textarea [(ngModel)]="form().content" rows="10" placeholder="Contenido completo del post..."></textarea>
            </div>
            <div class="form-field form-field--checks">
              <label class="check-label">
                <input type="checkbox" [(ngModel)]="form().published" />
                <span>Publicado</span>
              </label>
              <label class="check-label">
                <input type="checkbox" [(ngModel)]="form().featured" />
                <span>Destacado</span>
              </label>
            </div>

            <!-- Social publishing -->
            <div class="form-field form-field--full">
              <label>Publicar también en:</label>
              <div class="publish-channels">
                <label class="channel-opt always-checked">
                  <input type="checkbox" checked disabled />
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  Blog (tienda.com/blog)
                </label>
                <label class="channel-opt" [class.disabled]="!igConnected()">
                  <input type="checkbox" [(ngModel)]="publishToInstagram" [disabled]="!igConnected()" />
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                  Instagram
                  @if (!igConnected()) { <span class="not-connected">(no conectado)</span> }
                </label>
                <label class="channel-opt" [class.disabled]="!fbConnected()">
                  <input type="checkbox" [(ngModel)]="publishToFacebook" [disabled]="!fbConnected()" />
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                  Facebook
                  @if (!fbConnected()) { <span class="not-connected">(no conectado)</span> }
                </label>
              </div>
            </div>
          </div>

          @if (formError()) {
            <p class="form-error">{{ formError() }}</p>
          }

          <div class="form-actions">
            <button class="btn-secondary" (click)="cancelForm()">Cancelar</button>
            <button class="btn-primary" [disabled]="saving()" (click)="save()">
              {{ saving() ? 'Guardando...' : editingId() ? 'Guardar cambios' : 'Crear post' }}
            </button>
          </div>
        </div>
      }

      <!-- TABLE -->
      @if (loading()) {
        <div class="loading">Cargando posts...</div>
      } @else if (posts().length === 0) {
        <div class="empty">
          <p>No hay posts todavía. ¡Creá el primero!</p>
        </div>
      } @else {
        <div class="table-wrap">
          <table class="blog-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Categoría</th>
                <th>Autor</th>
                <th>Estado</th>
                <th>Destacado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (post of posts(); track post.id) {
                <tr>
                  <td class="id-cell">{{ post.id }}</td>
                  <td class="title-cell">{{ post.title }}</td>
                  <td><span class="category-badge">{{ post.category }}</span></td>
                  <td class="author-cell">{{ post.author }}</td>
                  <td>
                    <button
                      class="status-badge"
                      [class.published]="post.published"
                      [class.draft]="!post.published"
                      [disabled]="togglingId() === post.id"
                      (click)="togglePublished(post)">
                      {{ post.published ? 'Publicado' : 'Borrador' }}
                    </button>
                  </td>
                  <td>
                    @if (post.featured) {
                      <span class="featured-badge">Destacado</span>
                    } @else {
                      <span class="no-featured">—</span>
                    }
                  </td>
                  <td class="date">{{ post.createdAt | date:'dd/MM/yyyy' }}</td>
                  <td class="actions-cell">
                    <button class="btn-edit" (click)="openEdit(post)">Editar</button>
                    <button class="btn-delete" [disabled]="deletingId() === post.id" (click)="deletePost(post)">
                      {{ deletingId() === post.id ? '...' : 'Eliminar' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (totalPages() > 1) {
          <div class="pagination">
            <button [disabled]="currentPage() === 0" (click)="loadPage(currentPage() - 1)">Anterior</button>
            <span>Página {{ currentPage() + 1 }} de {{ totalPages() }}</span>
            <button [disabled]="currentPage() >= totalPages() - 1" (click)="loadPage(currentPage() + 1)">Siguiente</button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .page { padding: 1.5rem; }
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 1.5rem;
    }
    .page-header h1 { margin: 0 0 4px; font-size: 1.4rem; color: var(--text); }
    .subtitle { margin: 0; font-size: 0.85rem; color: var(--text-secondary); }

    .header-actions { display: flex; align-items: center; gap: 0.75rem; }
    .total-badge {
      background: var(--bg-secondary); color: var(--primary); font-size: 0.82rem; font-weight: 700;
      padding: 4px 12px; border-radius: 20px;
    }

    /* FORM */
    .form-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
      padding: 1.5rem; margin-bottom: 1.5rem;
    }
    .form-title { margin: 0 0 1.25rem; font-size: 1.1rem; color: var(--text); font-weight: 700; }
    .form-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
    }
    .form-field { display: flex; flex-direction: column; gap: 0.35rem; }
    .form-field--full { grid-column: 1 / -1; }
    .form-field--checks { grid-column: 1 / -1; display: flex; flex-direction: row; gap: 2rem; align-items: center; }
    .form-field label { font-size: 0.78rem; font-weight: 600; color: var(--text); text-transform: uppercase; letter-spacing: 0.04em; }
    .form-field input, .form-field textarea {
      border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem 0.75rem;
      font-size: 0.9rem; color: var(--text); outline: none;
      transition: border-color 0.15s;
    }
    .form-field input:focus, .form-field textarea:focus { border-color: var(--primary); }
    .form-field textarea { resize: vertical; font-family: inherit; }
    .check-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem; color: var(--text); font-weight: 500; }
    .check-label input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
    .form-error { color: var(--danger); font-size: 0.85rem; margin: 0.75rem 0 0; }
    .form-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.25rem; }

    .cat-select {
      border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem 0.75rem;
      font-size: 0.9rem; color: var(--text); background: var(--bg-card); outline: none;
      transition: border-color 0.15s; cursor: pointer;
    }
    .cat-select:focus { border-color: var(--primary); }

    .image-upload-row { display: flex; gap: 0.5rem; align-items: stretch; }
    .image-url-input { flex: 1; border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.9rem; color: var(--text); outline: none; transition: border-color 0.15s; }
    .image-url-input:focus { border-color: var(--primary); }
    .btn-upload {
      padding: 0.5rem 0.85rem; background: var(--bg-secondary); color: var(--text);
      border: 1px solid var(--border); border-radius: 6px; font-size: 0.78rem; font-weight: 600;
      cursor: pointer; white-space: nowrap; transition: border-color 0.15s;
    }
    .btn-upload:hover:not(.uploading) { border-color: var(--primary); color: var(--primary); }
    .btn-upload.uploading { opacity: 0.6; cursor: not-allowed; }
    .image-preview { margin-top: 0.5rem; max-height: 120px; border-radius: 6px; border: 1px solid var(--border); object-fit: cover; display: block; }

    /* BUTTONS */
    .btn-primary {
      padding: 0.5rem 1.1rem; background: var(--primary); color: white;
      border: none; border-radius: 7px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    .btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-secondary {
      padding: 0.5rem 1.1rem; background: var(--bg-card); color: var(--text);
      border: 1px solid var(--border); border-radius: 7px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    .btn-secondary:hover { background: var(--bg-secondary); }

    /* TABLE */
    .table-wrap { overflow-x: auto; }
    .blog-table {
      width: 100%; border-collapse: collapse; font-size: 0.875rem;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden;
    }
    .blog-table thead th {
      padding: 0.65rem 1rem; text-align: left;
      font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);
      text-transform: uppercase; letter-spacing: 0.04em;
      background: var(--bg-secondary); border-bottom: 1px solid var(--border);
    }
    .blog-table tbody td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
    .blog-table tbody tr:last-child td { border-bottom: none; }
    .blog-table tbody tr:hover { background: var(--bg-secondary); }

    .id-cell { color: var(--text-secondary); font-size: 0.8rem; }
    .title-cell { font-weight: 600; color: var(--text); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .author-cell { color: var(--text); }
    .date { color: var(--text-secondary); white-space: nowrap; }

    .category-badge {
      background: var(--bg-secondary); color: var(--text); font-size: 0.72rem; font-weight: 600;
      padding: 2px 8px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.03em;
    }

    .status-badge {
      font-size: 0.72rem; font-weight: 700; padding: 3px 10px;
      border-radius: 10px; border: none; cursor: pointer; transition: opacity 0.15s;
      letter-spacing: 0.03em;
    }
    .status-badge.published { background: var(--success-bg); color: var(--success-text); border: 1px solid var(--success-border); }
    .status-badge.draft     { background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border); }
    .status-badge:disabled  { opacity: 0.5; cursor: not-allowed; }
    .status-badge:hover:not(:disabled) { opacity: 0.75; }

    .featured-badge {
      font-size: 0.72rem; font-weight: 700; padding: 3px 10px;
      background: var(--warning-bg); color: var(--warning-text);
      border: 1px solid var(--warning-border); border-radius: 10px;
    }
    .no-featured { color: var(--text-secondary); opacity: 0.4; }

    .actions-cell { display: flex; gap: 0.5rem; align-items: center; }
    .btn-edit {
      font-size: 0.78rem; font-weight: 600; padding: 0.3rem 0.75rem;
      background: var(--bg-secondary); color: var(--primary); border: 1px solid var(--border);
      border-radius: 6px; cursor: pointer; transition: border-color 0.15s;
    }
    .btn-edit:hover { border-color: var(--primary); }
    .btn-delete {
      font-size: 0.78rem; font-weight: 600; padding: 0.3rem 0.75rem;
      background: var(--danger-bg); color: var(--danger-text); border: 1px solid var(--danger-border);
      border-radius: 6px; cursor: pointer; transition: background 0.15s;
    }
    .btn-delete:hover:not(:disabled) { background: var(--danger); color: white; }
    .btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }

    .pagination {
      display: flex; align-items: center; justify-content: center;
      gap: 1rem; margin-top: 1.5rem;
    }
    .pagination button {
      padding: 0.5rem 1rem; border: 1px solid var(--border);
      border-radius: 6px; background: var(--bg-card); cursor: pointer;
    }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
    .pagination span { font-size: 0.9rem; color: var(--text-secondary); }

    .loading, .empty { text-align: center; padding: 3rem; color: var(--text-secondary); }

    /* Social buttons */
    .social-btns { display: flex; gap: 0.4rem; align-items: center; }
    .btn-social {
      display: flex; align-items: center; gap: 0.35rem; padding: 0.38rem 0.75rem;
      border-radius: 7px; font-size: 0.78rem; font-weight: 600; cursor: pointer;
      border: 1.5px solid var(--border); background: var(--bg-secondary);
      color: var(--text-secondary); transition: all 0.15s; white-space: nowrap;
    }
    .btn-social svg { width: 15px; height: 15px; flex-shrink: 0; }
    .social-label { display: none; }
    @media (min-width: 900px) { .social-label { display: inline; } }
    .btn-social:hover:not(.connected) { border-color: var(--primary); color: var(--primary); background: var(--bg-card); }
    .btn-social.instagram.connected { border-color: #e1306c; color: #e1306c; background: rgba(225,48,108,0.08); }
    .btn-social.facebook.connected  { border-color: #1877f2; color: #1877f2; background: rgba(24,119,242,0.08); }

    /* Publish channels */
    .publish-channels { display: flex; flex-wrap: wrap; gap: 1.25rem; padding: 0.5rem 0; }
    .channel-opt {
      display: flex; align-items: center; gap: 0.4rem;
      font-size: 0.875rem; cursor: pointer; color: var(--text); font-weight: 500;
    }
    .channel-opt input { width: 15px; height: 15px; cursor: pointer; }
    .channel-opt.always-checked { opacity: 0.75; }
    .channel-opt.disabled { opacity: 0.5; cursor: not-allowed; }
    .channel-opt.disabled input { cursor: not-allowed; }
    .not-connected { font-size: 0.72rem; color: var(--text-secondary); font-style: italic; margin-left: 2px; }

    /* Social info modal */
    .social-modal-overlay {
      position: fixed; inset: 0; background: var(--overlay); z-index: 1000;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .social-modal {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px;
      padding: 2rem; max-width: 480px; width: 100%;
      box-shadow: 0 16px 48px rgba(0,0,0,0.2);
    }
    .social-modal h3 { margin: 0 0 1rem; font-size: 1.1rem; color: var(--text); }
    .social-modal p { color: var(--text-secondary); font-size: 0.9rem; margin: 0 0 0.75rem; }
    .social-modal ol { padding-left: 1.25rem; color: var(--text); font-size: 0.875rem; line-height: 2; margin: 0 0 0.75rem; }
    .social-modal code { background: var(--bg-secondary); padding: 1px 6px; border-radius: 4px; font-size: 0.82rem; }
    .modal-note { font-size: 0.82rem; font-style: italic; color: var(--text-secondary); }
    .modal-actions { display: flex; justify-content: flex-end; margin-top: 1.25rem; }
  `],
})
export class AdminBlogComponent implements OnInit {
  private http = inject(HttpClient);

  posts         = signal<BlogPostResponse[]>([]);
  loading       = signal(true);
  totalElements = signal(0);
  totalPages    = signal(0);
  currentPage   = signal(0);

  showForm   = signal(false);
  editingId  = signal<number | null>(null);
  form       = signal<BlogPostRequest>(EMPTY_FORM());
  saving     = signal(false);
  formError  = signal<string | null>(null);

  togglingId = signal<number | null>(null);
  deletingId = signal<number | null>(null);

  uploadingImage = signal(false);
  imagePreviewUrl = signal<string>('');

  // Social media integration
  igConnected       = signal(false);
  fbConnected       = signal(false);
  publishToInstagram = false;
  publishToFacebook  = false;
  showSocialModal   = signal(false);
  socialModalPlatform = signal<'Instagram' | 'Facebook'>('Instagram');

  ngOnInit(): void {
    this.loadPage(0);
    this.checkSocialConnections();
  }

  private checkSocialConnections(): void {
    // Check localStorage for saved social tokens
    try {
      this.igConnected.set(!!localStorage.getItem('blog_ig_connected'));
      this.fbConnected.set(!!localStorage.getItem('blog_fb_connected'));
    } catch { /* ignore */ }
  }

  clearImageUrl(): void {
    this.form.update(f => ({ ...f, imageUrl: '' }));
    this.imagePreviewUrl.set('');
  }

  onImageFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingImage.set(true);
    const formData = new FormData();
    formData.append('file', file);

    this.http.post<{ key: string; previewUrl: string }>(
      `${environment.apiUrl}/admin/blog/upload-image`, formData
    ).subscribe({
      next: (res) => {
        // Store the raw MinIO key in the form (sent to backend for persistence)
        this.form.update(f => ({ ...f, imageUrl: res.key }));
        // Store the presigned URL only for immediate preview
        this.imagePreviewUrl.set(res.previewUrl);
        this.uploadingImage.set(false);
        input.value = '';
      },
      error: () => {
        this.uploadingImage.set(false);
        this.formError.set('Error al subir la imagen. Intentá de nuevo.');
      },
    });
  }

  connectInstagram(): void {
    this.socialModalPlatform.set('Instagram');
    this.showSocialModal.set(true);
  }

  connectFacebook(): void {
    this.socialModalPlatform.set('Facebook');
    this.showSocialModal.set(true);
  }

  loadPage(page: number): void {
    this.loading.set(true);
    this.http.get<Page<BlogPostResponse>>(
      `${environment.apiUrl}/admin/blog?page=${page}&size=20`
    ).subscribe({
      next: (data) => {
        this.posts.set(data.content);
        this.totalElements.set(data.totalElements);
        this.totalPages.set(data.totalPages);
        this.currentPage.set(data.number);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
  }

  openNew(): void {
    this.editingId.set(null);
    this.form.set(EMPTY_FORM());
    this.formError.set(null);
    this.imagePreviewUrl.set('');
    this.showForm.set(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }

  openEdit(post: BlogPostResponse): void {
    this.editingId.set(post.id);
    this.form.set({
      title:     post.title,
      content:   post.content,
      excerpt:   post.excerpt ?? '',
      author:    post.author,
      category:  post.category,
      // Use the raw MinIO key for persistence; fall back to imageUrl if no key
      imageUrl:  post.imageKey ?? post.imageUrl ?? '',
      videoUrl:  post.videoUrl ?? '',
      published: post.published,
      featured:  post.featured,
    });
    // imageUrl from the API is a presigned URL, use it for display
    this.imagePreviewUrl.set(post.imageUrl ?? '');
    this.formError.set(null);
    this.showForm.set(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.form.set(EMPTY_FORM());
    this.formError.set(null);
    this.imagePreviewUrl.set('');
  }

  save(): void {
    const f = this.form();
    if (!f.title.trim() || !f.content.trim() || !f.author.trim() || !f.category.trim()) {
      this.formError.set('Título, contenido, autor y categoría son obligatorios.');
      return;
    }
    this.formError.set(null);
    this.saving.set(true);

    const payload: BlogPostRequest = {
      title:     f.title.trim(),
      content:   f.content.trim(),
      author:    f.author.trim(),
      category:  f.category.trim(),
      published: f.published,
      featured:  f.featured,
      ...(f.excerpt?.trim()   ? { excerpt:  f.excerpt.trim() }   : {}),
      ...(f.imageUrl?.trim()  ? { imageUrl: f.imageUrl.trim() }  : {}),
      ...(f.videoUrl?.trim()  ? { videoUrl: f.videoUrl.trim() }  : {}),
    };

    const id = this.editingId();
    const req$ = id
      ? this.http.put<BlogPostResponse>(`${environment.apiUrl}/admin/blog/${id}`, payload)
      : this.http.post<BlogPostResponse>(`${environment.apiUrl}/admin/blog`, payload);

    req$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        // Publish to social media if requested
        if ((this.publishToInstagram || this.publishToFacebook) && saved.published) {
          this.http.post(`${environment.apiUrl}/admin/blog/${saved.id}/publish-social`, {
            instagram: this.publishToInstagram,
            facebook:  this.publishToFacebook,
          }).subscribe();
        }
        this.publishToInstagram = false;
        this.publishToFacebook  = false;
        this.cancelForm();
        if (id) {
          this.posts.update(list => list.map(p => p.id === saved.id ? saved : p));
        } else {
          this.loadPage(this.currentPage());
        }
      },
      error: () => {
        this.saving.set(false);
        this.formError.set('Ocurrió un error al guardar. Intentá de nuevo.');
      },
    });
  }

  togglePublished(post: BlogPostResponse): void {
    this.togglingId.set(post.id);
    const payload: BlogPostRequest = {
      title:     post.title,
      content:   post.content,
      author:    post.author,
      category:  post.category,
      published: !post.published,
      featured:  post.featured,
      ...(post.excerpt   ? { excerpt:  post.excerpt }   : {}),
      ...(post.imageUrl  ? { imageUrl: post.imageUrl }  : {}),
    };
    this.http.put<BlogPostResponse>(`${environment.apiUrl}/admin/blog/${post.id}`, payload).subscribe({
      next: (updated) => {
        this.posts.update(list => list.map(p => p.id === updated.id ? updated : p));
        this.togglingId.set(null);
      },
      error: () => { this.togglingId.set(null); },
    });
  }

  deletePost(post: BlogPostResponse): void {
    if (!confirm(`¿Eliminar el post "${post.title}"? Esta acción no se puede deshacer.`)) return;
    this.deletingId.set(post.id);
    this.http.delete(`${environment.apiUrl}/admin/blog/${post.id}`).subscribe({
      next: () => {
        this.posts.update(list => list.filter(p => p.id !== post.id));
        this.totalElements.update(n => n - 1);
        this.deletingId.set(null);
      },
      error: () => { this.deletingId.set(null); },
    });
  }
}
