import { Component, signal, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from '@env/environment';
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
  videoUrl: string | null;
  featured: boolean;
  createdAt: string;
  publishedAt: string;
}

@Component({
  selector: 'app-blog-post',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="post-page">
      @if (loading()) {
        <div class="loading">
          <div class="spinner"></div>
          <p>Cargando artículo...</p>
        </div>
      } @else if (error()) {
        <div class="error-state">
          <h2>Artículo no encontrado</h2>
          <p>El artículo que buscás no existe o fue eliminado.</p>
          <a routerLink="/blog" class="btn-primary">Volver al blog</a>
        </div>
      } @else if (post()) {
        <article class="post-article">
          <!-- Back link -->
          <a routerLink="/blog" class="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Volver al blog
          </a>

          <!-- Post Header -->
          <header class="post-header">
            <span class="post-category">{{ post()!.category }}</span>
            <h1>{{ post()!.title }}</h1>
            <div class="post-meta">
              <div class="author-info">
                <div class="author-avatar">{{ getInitials(post()!.author) }}</div>
                <span>{{ post()!.author }}</span>
              </div>
              <span class="separator">•</span>
              <span class="post-date">{{ formatDate(post()!.publishedAt || post()!.createdAt) }}</span>
            </div>
          </header>

          <!-- Featured Image -->
          @if (post()!.imageUrl) {
            <div class="post-image">
              <img [src]="post()!.imageUrl" [alt]="post()!.title" loading="lazy" />
            </div>
          }

          <!-- Video embed -->
          @if (post()!.videoUrl) {
            <div class="post-video">
              @if (isYouTube(post()!.videoUrl!)) {
                <iframe
                  [src]="youtubeEmbedUrl(post()!.videoUrl!)"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen
                ></iframe>
              } @else {
                <video controls [src]="post()!.videoUrl!" preload="metadata"></video>
              }
            </div>
          }

          <!-- Post Content -->
          <div class="post-content" [innerHTML]="safeContent()"></div>

          <!-- Share -->
          <div class="share-section">
            <span class="share-label">Compartir:</span>
            <button class="share-btn" (click)="shareOnTwitter()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </button>
          </div>

          <!-- Related Posts placeholder -->
          <div class="related-section">
            <h3>Más artículos</h3>
            <a routerLink="/blog" class="btn-outline">Ver todos los artículos</a>
          </div>
        </article>
      }
    </div>
  `,
  styles: [`
    .post-page {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    .loading, .error-state {
      text-align: center;
      padding: 4rem 2rem;
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
    .error-state h2 {
      font-size: 1.5rem;
      color: var(--text);
      margin: 0 0 0.5rem;
    }
    .error-state p {
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

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.9rem;
      margin-bottom: 2rem;
      transition: color 0.15s;
    }
    .back-link:hover {
      color: var(--primary);
    }

    .post-header {
      margin-bottom: 2rem;
    }
    .post-category {
      display: inline-block;
      background: var(--info-bg);
      color: var(--info-text);
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.35rem 0.85rem;
      border-radius: 16px;
      margin-bottom: 1rem;
    }
    .post-header h1 {
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--text);
      margin: 0 0 1.5rem;
      line-height: 1.2;
    }
    .post-meta {
      display: flex;
      align-items: center;
      gap: 1rem;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }
    .author-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .author-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--primary);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .separator {
      color: var(--border);
    }

    .post-image {
      margin-bottom: 2.5rem;
      border-radius: 16px;
      overflow: hidden;
    }
    .post-image img {
      width: 100%;
      height: auto;
      display: block;
    }

    .post-video {
      margin-bottom: 2.5rem;
      border-radius: 12px;
      overflow: hidden;
      background: #000;
      aspect-ratio: 16/9;
    }
    .post-video iframe, .post-video video {
      width: 100%;
      height: 100%;
      display: block;
      border: none;
    }

    .post-content {
      font-size: 1.05rem;
      line-height: 1.8;
      color: var(--text);
    }
    .post-content :deep(h2) {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text);
      margin: 2rem 0 1rem;
    }
    .post-content :deep(h3) {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text);
      margin: 1.5rem 0 0.75rem;
    }
    .post-content :deep(p) {
      margin: 0 0 1.25rem;
    }
    .post-content :deep(ul), .post-content :deep(ol) {
      margin: 0 0 1.25rem;
      padding-left: 1.5rem;
    }
    .post-content :deep(li) {
      margin-bottom: 0.5rem;
    }
    .post-content :deep(blockquote) {
      border-left: 4px solid var(--primary);
      padding-left: 1.5rem;
      margin: 1.5rem 0;
      font-style: italic;
      color: var(--text-secondary);
    }
    .post-content :deep(code) {
      background: var(--bg-secondary);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .post-content :deep(pre) {
      background: #1f2937;
      color: #f9fafb;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1.5rem 0;
    }
    .post-content :deep(pre code) {
      background: none;
      padding: 0;
    }

    .share-section {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1.5rem 0;
      border-top: 1px solid var(--border);
      margin-top: 2rem;
    }
    .share-label {
      font-size: 0.9rem;
      color: var(--text-secondary);
    }
    .share-btn {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--text);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }
    .share-btn:hover {
      background: var(--bg-secondary);
      border-color: var(--border);
    }

    .related-section {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 2rem;
      text-align: center;
      margin-top: 3rem;
    }
    .related-section h3 {
      font-size: 1.25rem;
      color: var(--text);
      margin: 0 0 1rem;
    }
    .btn-outline {
      display: inline-block;
      padding: 0.6rem 1.25rem;
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text);
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      transition: all 0.15s;
    }
    .btn-outline:hover {
      border-color: var(--primary);
      color: var(--primary);
    }

    @media (max-width: 600px) {
      .post-header h1 {
        font-size: 1.75rem;
      }
    }
  `],
})
export class BlogPostComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private seo = inject(SeoService);
  private sanitizer = inject(DomSanitizer);
  private readonly apiUrl = environment.apiUrl;

  post = signal<BlogPost | null>(null);
  safeContent = signal<SafeHtml | null>(null);
  loading = signal(true);
  error = signal(false);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.loadPost(slug);
  }

  private loadPost(slug: string): void {
    this.loading.set(true);
    this.error.set(false);

    this.http.get<BlogPost>(`${this.apiUrl}/blog/slug/${slug}`).subscribe({
      next: (post) => {
        this.post.set(post);
        this.safeContent.set(this.sanitizer.sanitize(SecurityContext.HTML, post.content));
        this.loading.set(false);
        
        // SEO
        this.seo.set({
          title: `${post.title} - Blog Solder Studio`,
          description: post.excerpt,
          canonicalPath: `/blog/${slug}`,
        });
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
        this.seo.set({ title: 'Artículo no encontrado', description: '' });
      },
    });
  }

  isYouTube(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
  }

  youtubeEmbedUrl(url: string): SafeResourceUrl {
    let videoId = '';
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) {
        videoId = u.pathname.slice(1);
      } else {
        videoId = u.searchParams.get('v') ?? '';
      }
    } catch { /* ignore */ }
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  shareOnTwitter(): void {
    const post = this.post();
    if (!post) return;
    
    const text = encodeURIComponent(post.title);
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  }
}
