import { Component, signal, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { RouterLink } from '@angular/router';
import { SeoService } from '@core/services/seo.service';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  category: string;
  imageUrl: string | null;
  featured: boolean;
  createdAt: string;
  publishedAt: string;
}

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="blog-page">
      <div class="blog-header">
        <h1>Blog de Solder Studio</h1>
        <p>Noticias, consejos y tendencias en moda personalizada</p>
      </div>

      @if (loading()) {
        <div class="loading">
          <div class="spinner"></div>
          <p>Cargando artículos...</p>
        </div>
      } @else if (apiError()) {
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2>No se pudo cargar el blog</h2>
          <p>Verificá que el servidor esté activo e intentá de nuevo.</p>
          <button class="btn-primary" (click)="loadPosts()">Reintentar</button>
        </div>
      } @else if (posts().length === 0 && !featuredPost()) {
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"/>
              <path d="M21 12l-4-4m0 0l-4 4m4-4v11"/>
            </svg>
          </div>
          <h2>Próximamente</h2>
          <p>Estamos preparando contenido interesante para vos. ¡Volvé pronto!</p>
          <a routerLink="/" class="btn-primary">Volver al catálogo</a>
        </div>
      } @else {
        <!-- Featured Post -->
        @if (featuredPost()) {
          <a [routerLink]="['/blog', featuredPost()!.slug]" class="featured-post">
            <div class="featured-image">
              @if (featuredPost()!.imageUrl) {
                <img [src]="featuredPost()!.imageUrl" [alt]="featuredPost()!.title" loading="eager" />
              } @else {
                <div class="image-placeholder">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
              }
              <span class="featured-badge">⭐ Destacado</span>
            </div>
            <div class="featured-content">
              <span class="post-category">{{ featuredPost()!.category }}</span>
              <h2>{{ featuredPost()!.title }}</h2>
              <p class="post-excerpt">{{ featuredPost()!.excerpt }}</p>
              <div class="post-meta">
                <span class="post-author">Por {{ featuredPost()!.author }}</span>
                <span class="post-date">{{ formatDate(featuredPost()!.publishedAt || featuredPost()!.createdAt) }}</span>
              </div>
            </div>
          </a>
        }

        <!-- Category Filter -->
        @if (categories().length > 0) {
          <div class="category-filter">
            <button 
              class="category-btn" 
              [class.active]="selectedCategory() === null"
              (click)="filterByCategory(null)">
              Todos
            </button>
            @for (cat of categories(); track cat) {
              <button 
                class="category-btn" 
                [class.active]="selectedCategory() === cat"
                (click)="filterByCategory(cat)">
                {{ cat }}
              </button>
            }
          </div>
        }

        <!-- Posts Grid -->
        <div class="posts-grid">
          @for (post of regularPosts; track post.id) {
            <a [routerLink]="['/blog', post.slug]" class="post-card">
              <div class="post-image">
                @if (post.imageUrl) {
                  <img [src]="post.imageUrl" [alt]="post.title" loading="lazy" />
                } @else {
                  <div class="image-placeholder">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                }
              </div>
              <div class="post-content">
                <span class="post-category">{{ post.category }}</span>
                <h3>{{ post.title }}</h3>
                <p class="post-excerpt">{{ post.excerpt }}</p>
                <div class="post-meta">
                  <span class="post-author">{{ post.author }}</span>
                  <span class="post-date">{{ formatDate(post.publishedAt || post.createdAt) }}</span>
                </div>
              </div>
            </a>
          }
        </div>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div class="pagination">
            <button (click)="goToPage(currentPage() - 1)" [disabled]="currentPage() === 0">
              ← Anterior
            </button>
            <span class="page-info">Página {{ currentPage() + 1 }} de {{ totalPages() }}</span>
            <button (click)="goToPage(currentPage() + 1)" [disabled]="currentPage() >= totalPages() - 1">
              Siguiente →
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .blog-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    .blog-header {
      text-align: center;
      margin-bottom: 3rem;
    }
    .blog-header h1 {
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--text);
      margin: 0 0 0.5rem;
    }
    .blog-header p {
      font-size: 1.1rem;
      color: var(--text-secondary);
      margin: 0;
    }

    .loading {
      text-align: center;
      padding: 4rem;
      color: var(--text-secondary);
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
    }
    .empty-icon {
      margin-bottom: 1.5rem;
    }
    .empty-state h2 {
      font-size: 1.5rem;
      color: var(--text);
      margin: 0 0 0.5rem;
    }
    .empty-state p {
      color: var(--text-secondary);
      margin: 0 0 1.5rem;
    }
    .btn-primary {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: var(--primary);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      transition: background 0.15s;
    }
    .btn-primary:hover {
      background: var(--primary-dark);
    }

    /* Featured Post */
    .featured-post {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      background: var(--bg-card);
      border-radius: 16px;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      margin-bottom: 3rem;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .featured-post:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
    }

    .featured-image {
      position: relative;
      aspect-ratio: 4/3;
    }
    .featured-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .image-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-secondary);
    }
    .featured-badge {
      position: absolute;
      top: 1rem;
      left: 1rem;
      background: linear-gradient(135deg, var(--warning), var(--warning));
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .featured-content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 2rem 2rem 2rem 0;
    }
    .post-category {
      display: inline-block;
      background: var(--info-bg);
      color: var(--info-text);
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      margin-bottom: 1rem;
      width: fit-content;
    }
    .featured-content h2 {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text);
      margin: 0 0 1rem;
      line-height: 1.3;
    }

    .post-excerpt {
      color: var(--text-secondary);
      font-size: 1rem;
      line-height: 1.6;
      margin: 0 0 1.5rem;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .post-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    /* Category Filter */
    .category-filter {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 2rem;
      justify-content: center;
    }
    .category-btn {
      padding: 0.5rem 1rem;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 20px;
      font-size: 0.875rem;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s;
    }
    .category-btn:hover {
      border-color: var(--primary);
      color: var(--primary);
    }
    .category-btn.active {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
    }

    /* Posts Grid */
    .posts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 2rem;
    }

    .post-card {
      background: var(--bg-card);
      border-radius: 12px;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .post-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    }

    .post-image {
      aspect-ratio: 16/9;
      overflow: hidden;
    }
    .post-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }
    .post-card:hover .post-image img {
      transform: scale(1.05);
    }

    .post-content {
      padding: 1.25rem;
    }
    .post-content h3 {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text);
      margin: 0.5rem 0;
      line-height: 1.4;
    }
    .post-content .post-excerpt {
      font-size: 0.9rem;
      -webkit-line-clamp: 2;
    }

    /* Pagination */
    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      margin-top: 3rem;
    }
    .pagination button {
      padding: 0.5rem 1rem;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .pagination button:hover:not(:disabled) {
      background: var(--bg-secondary);
    }
    .pagination button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .page-info {
      font-size: 0.9rem;
      color: var(--text-secondary);
    }

    @media (max-width: 768px) {
      .featured-post {
        grid-template-columns: 1fr;
      }
      .featured-content {
        padding: 1.5rem;
      }
      .featured-content h2 {
        font-size: 1.4rem;
      }
    }
  `],
})
export class BlogComponent implements OnInit {
  private http = inject(HttpClient);
  private seo = inject(SeoService);
  private readonly apiUrl = environment.apiUrl;

  posts = signal<BlogPost[]>([]);
  featuredPost = signal<BlogPost | null>(null);
  categories = signal<string[]>([]);
  loading = signal(true);
  apiError = signal(false);

  currentPage = signal(0);
  totalPages = signal(0);
  selectedCategory = signal<string | null>(null);

  ngOnInit(): void {
    this.seo.set({
      title: 'Blog - Solder Studio',
      description: 'Noticias, consejos y tendencias en moda personalizada. Enterate de las últimas novedades en ropa customizable.',
      canonicalPath: '/blog',
    });

    this.loadCategories();
    this.loadPosts();
  }

  private loadCategories(): void {
    this.http.get<string[]>(`${this.apiUrl}/blog/categories`).subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {},
    });
  }

  loadPosts(): void {
    this.loading.set(true);
    this.apiError.set(false);
    
    const category = this.selectedCategory();
    let url = `${this.apiUrl}/blog?page=${this.currentPage()}&size=9`;
    
    if (category) {
      url = `${this.apiUrl}/blog/category/${encodeURIComponent(category)}?page=${this.currentPage()}&size=9`;
    }

    this.http.get<{ content: BlogPost[]; totalPages: number }>(url).subscribe({
      next: (page) => {
        this.posts.set(page.content);
        this.totalPages.set(page.totalPages);

        // Set featured post if on first page with no filter
        if (this.currentPage() === 0 && !category) {
          this.http.get<BlogPost[]>(`${this.apiUrl}/blog/featured`).subscribe({
            next: (featured) => {
              if (featured.length > 0) {
                this.featuredPost.set(featured[0]);
                this.posts.update(list => list.filter(p => p.id !== featured[0].id));
              } else {
                this.featuredPost.set(null);
              }
              this.loading.set(false);
            },
            error: () => {
              this.featuredPost.set(null);
              this.loading.set(false);
            },
          });
        } else {
          this.featuredPost.set(null);
          this.loading.set(false);
        }
      },
      error: () => {
        this.loading.set(false);
        this.apiError.set(true);
      },
    });
  }

  filterByCategory(category: string | null): void {
    this.selectedCategory.set(category);
    this.currentPage.set(0);
    this.loadPosts();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.currentPage.set(page);
    this.loadPosts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  get regularPosts(): BlogPost[] {
    return this.posts();
  }
}
